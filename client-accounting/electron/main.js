const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const AutoUpdater = require('./auto-updater.js');

// Better detection: app.isPackaged is true when running from packaged EXE
const isDev = !app.isPackaged;
const PORT = process.env.PORT || 3000;
const SERVER_PORT = 5000;

let mainWindow = null;
let serverProcess = null;
let autoUpdater = null;
let serverStatus = 'stopped'; // 'running', 'stopped', 'error'
let serverStartTime = null;
let serverError = null;

// Logging setup
// Logging setup
let logFile;
try {
    logFile = path.join(app.getPath('userData'), 'app.log');
} catch (e) {
    logFile = path.join(os.tmpdir(), 'smartpos-pro-emergency.log');
}
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message, ...args) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;
    process.stdout.write(formatted);
    logStream.write(formatted);
}

function logError(message, ...args) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [ERROR] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}\n`;
    process.stderr.write(formatted);
    logStream.write(formatted);
}

// Redirect console to our log functions
console.log = log;
console.error = logError;
console.warn = log;
console.info = log;

log('--- APP START ---');
log('isDev:', isDev);
log('userData path:', app.getPath('userData'));
log('resources path:', process.resourcesPath);
log('appPath:', app.getAppPath());

// Файл хранения режима сервера
const getConfigPath = () => path.join(app.getPath('userData'), 'server-config.json');

function readServerMode() {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return data.server_mode || 'server';
        }
    } catch (e) {
        console.log('[Config] Error reading server mode:', e.message);
    }
    return 'server'; // по умолчанию — свой сервер
}

function writeServerMode(mode) {
    try {
        const configPath = getConfigPath();
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        config.server_mode = mode;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('[Config] Server mode saved:', mode);
    } catch (e) {
        console.log('[Config] Error saving server mode:', e.message);
    }
}

// Auto-setup: ensure .env exists and database is created
function ensureServerSetup(serverPath) {
    const crypto = require('crypto');
    const { execSync } = require('child_process');
    const envPath = path.join(serverPath, '.env');
    const templatePath = path.join(serverPath, '.env.template');

    // 1) Auto-generate .env if missing
    if (!fs.existsSync(envPath)) {
        console.log('[Setup] .env not found, generating from template...');
        let template = '';
        if (fs.existsSync(templatePath)) {
            template = fs.readFileSync(templatePath, 'utf8');
        } else {
            // Minimal fallback .env
            template = [
                'DATABASE_URL=postgresql://postgres:%%DB_PASSWORD%%@localhost:5432/accounting_db',
                'DB_HOST=localhost',
                'DB_PORT=5432',
                'DB_NAME=accounting_db',
                'DB_USER=postgres',
                'DB_PASSWORD=%%DB_PASSWORD%%',
                'DB_SSL=false',
                'PORT=5000',
                'SERVER_HOST=0.0.0.0',
                'NODE_ENV=production',
                'JWT_SECRET=%%JWT_SECRET%%',
                'JWT_EXPIRES_IN=24h',
                'SESSION_SECRET=%%SESSION_SECRET%%',
                'SESSION_MAX_AGE=86400000',
                'CORS_ORIGIN=http://localhost:3000,http://localhost:5000',
                'ENABLE_2FA=false',
                'ENABLE_REDIS_CACHE=false',
                'ENABLE_EMAIL_CAMPAIGNS=false',
                'ENABLE_TELEGRAM_BOT=false',
                'ENABLE_1C_SYNC=false',
                'LOG_LEVEL=info',
            ].join('\n');
        }

        // Replace secret placeholders with random values
        const jwtSecret = crypto.randomBytes(64).toString('hex');
        const sessionSecret = crypto.randomBytes(32).toString('base64');
        template = template.replace('%%JWT_SECRET%%', jwtSecret);
        template = template.replace('%%SESSION_SECRET%%', sessionSecret);

        // DB password: use system env or prompt-friendly default
        const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres';
        template = template.replace(/%%DB_PASSWORD%%/g, dbPassword);

        fs.writeFileSync(envPath, template, 'utf8');
        console.log('[Setup] .env created successfully');
    }

    // 2) Auto-create PostgreSQL database if it doesn't exist
    try {
        // Read DB credentials from the .env we just created/found
        const envContent = fs.readFileSync(envPath, 'utf8');
        const getEnv = (key) => {
            const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
            return match ? match[1].trim() : null;
        };

        const dbName = getEnv('DB_NAME') || 'accounting_db';
        const dbUser = getEnv('DB_USER') || 'postgres';
        const dbPassword = getEnv('DB_PASSWORD') || process.env.DB_PASSWORD || 'postgres';
        const dbHost = getEnv('DB_HOST') || 'localhost';
        const dbPort = getEnv('DB_PORT') || '5432';

        // Find psql executable
        const psqlPaths = [
            'psql',
            'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
            'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
            'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
            'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
        ];

        let psql = null;
        for (const p of psqlPaths) {
            try {
                execSync(`"${p}" --version`, { stdio: 'pipe', timeout: 5000 });
                psql = p;
                break;
            } catch (e) { /* try next */ }
        }

        if (psql) {
            const pgEnv = { ...process.env, PGPASSWORD: dbPassword };

            // Check if database exists
            try {
                const result = execSync(
                    `"${psql}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`,
                    { env: pgEnv, stdio: 'pipe', timeout: 10000 }
                ).toString().trim();

                if (result !== '1') {
                    console.log(`[Setup] Creating database '${dbName}'...`);
                    execSync(
                        `"${psql}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "CREATE DATABASE ${dbName} ENCODING 'UTF8'"`,
                        { env: pgEnv, stdio: 'pipe', timeout: 10000 }
                    );
                    console.log(`[Setup] Database '${dbName}' created!`);
                } else {
                    console.log(`[Setup] Database '${dbName}' already exists`);
                }
            } catch (dbErr) {
                console.warn('[Setup] Could not create database:', dbErr.message);
            }
        } else {
            console.warn('[Setup] psql not found — database will be created by server if PostgreSQL is running');
        }
    } catch (e) {
        console.warn('[Setup] Auto DB setup skipped:', e.message);
    }
}

// Start the embedded server
function startServer() {
    // Path to server folder - in production it's bundled with the app
    const serverPath = isDev
        ? path.join(__dirname, '../../server')
        : path.join(process.resourcesPath, 'server');

    // Auto-setup: create .env and database if needed
    ensureServerSetup(serverPath);

    // Writable path for .env (AppData, not the read-only resources folder)
    const userDataPath = app.getPath('userData');
    const writableEnvPath = path.join(userDataPath, 'server.env');

    // Copy/generate .env to writable location if not exists
    if (!fs.existsSync(writableEnvPath)) {
        const srcEnvPath = path.join(serverPath, '.env');
        const templatePath = path.join(serverPath, '.env.template');

        if (fs.existsSync(srcEnvPath)) {
            try { fs.copyFileSync(srcEnvPath, writableEnvPath); } catch (e) { console.log('[Server] Could not copy .env:', e.message); }
            console.log('[Server] Copied .env to writable path');
        } else if (fs.existsSync(templatePath)) {
            try {
                const crypto = require('crypto');
                let tpl = fs.readFileSync(templatePath, 'utf8');
                tpl = tpl.replace('%%JWT_SECRET%%', crypto.randomBytes(64).toString('hex'));
                tpl = tpl.replace('%%SESSION_SECRET%%', crypto.randomBytes(32).toString('base64'));
                fs.writeFileSync(writableEnvPath, tpl, 'utf8');
                console.log('[Server] Generated .env from template to writable path');
            } catch (e) { console.log('[Server] Could not generate .env:', e.message); }
        }
    }

    const serverEntry = path.join(serverPath, 'src/index.js');

    console.log('[Server] Starting embedded server...');
    console.log('[Server] Server path:', serverPath);
    console.log('[Server] Server entry:', serverEntry);
    console.log('[Server] Writable .env path:', writableEnvPath);

    // Check if server files exist
    if (!fs.existsSync(serverEntry)) {
        console.log('[Server] Server files not found, running in client-only mode');
        return;
    }

    // Load .env file — try writable path first, then source path
    let envVars = {};
    const envPathsToTry = [writableEnvPath, path.join(serverPath, '.env')];

    for (const tryPath of envPathsToTry) {
        if (fs.existsSync(tryPath)) {
            console.log('[Server] Loading .env from:', tryPath);
            try {
                const envContent = fs.readFileSync(tryPath, 'utf8');
                console.log('[Server] .env file size:', envContent.length, 'bytes');

                envContent.split(/\r?\n/).forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;
                    const eqIndex = trimmed.indexOf('=');
                    if (eqIndex > 0) {
                        envVars[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
                    }
                });

                console.log('[Server] Loaded env vars:', Object.keys(envVars).length, 'keys');
                if (Object.keys(envVars).length > 0) break;
            } catch (e) { console.log('[Server] Error reading .env:', e.message); }
        }
    }

    // CRITICAL: Always ensure DATABASE_URL and other DB vars are set
    const dbPwd = envVars.DB_PASSWORD || process.env.DB_PASSWORD || 'postgres';
    const defaultDbUrl = `postgresql://postgres:${dbPwd}@localhost:5432/accounting_db`;
    if (!envVars.DATABASE_URL) {
        console.log('[Server] DATABASE_URL not found in .env, using default');
        envVars.DATABASE_URL = defaultDbUrl;
    }
    if (!envVars.DB_HOST) envVars.DB_HOST = 'localhost';
    if (!envVars.DB_PORT) envVars.DB_PORT = '5432';
    if (!envVars.DB_NAME) envVars.DB_NAME = 'accounting_db';
    if (!envVars.DB_USER) envVars.DB_USER = 'postgres';
    if (!envVars.DB_PASSWORD) envVars.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

    // Compute client dist path for the server to serve static files
    let clientDistPath;
    if (isDev) {
        clientDistPath = path.join(__dirname, '..', 'dist');
    } else {
        const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
        const plainPath = path.join(process.resourcesPath, 'app', 'dist');
        const appPath = path.join(app.getAppPath(), 'dist');

        if (fs.existsSync(unpackedPath)) {
            clientDistPath = unpackedPath;
        } else if (fs.existsSync(plainPath)) {
            clientDistPath = plainPath;
        } else {
            clientDistPath = appPath;
        }
        console.log('[Server] Tried paths:', { unpackedPath, plainPath, appPath });
    }
    console.log('[Server] CLIENT_DIST_PATH:', clientDistPath, '| exists:', fs.existsSync(clientDistPath));

    // Set environment for server — ALWAYS include critical vars
    const serverEnv = {
        ...process.env,
        ...envVars,
        NODE_ENV: 'production',
        PORT: SERVER_PORT.toString(),
        CLIENT_DIST_PATH: clientDistPath,
        LOG_PATH: path.join(userDataPath, 'server.log')
    };

    console.log('[Server] DATABASE_URL set:', !!serverEnv.DATABASE_URL);


    // Start server process
    serverProcess = spawn('node', [serverEntry], {
        cwd: serverPath,
        env: serverEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false
    });

    serverProcess.stdout.on('data', (data) => {
        console.log('[Server]', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
        console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
        console.error('[Server] Failed to start:', err.message);
        serverStatus = 'error';
        serverError = err.message;
    });

    serverProcess.on('exit', (code) => {
        console.log('[Server] Process exited with code:', code);
        serverProcess = null;
        if (code !== 0 && code !== null) {
            serverStatus = 'error';
            serverError = `Сервер упал с кодом ${code}`;
        } else {
            serverStatus = 'stopped';
        }
    });

    serverStatus = 'running';
    serverStartTime = Date.now();
    serverError = null;
    console.log('[Server] Server started with PID:', serverProcess.pid);
}

// Stop the server
function stopServer() {
    if (serverProcess) {
        console.log('[Server] Stopping server...');
        serverProcess.kill('SIGTERM');
        serverProcess = null;
        serverStatus = 'stopped';
        serverStartTime = null;
    }
}

// Get local network IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false,  // НЕ показывать до ready-to-show (фикс бага с невидимым окном)
        minWidth: 1200,
        minHeight: 700,
        title: 'SmartPOS Pro',
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../build/icon.ico'),
        autoHideMenuBar: true,
        frame: true
    });

    // Всегда загружаем через HTTP сервер (localStorage работает только на одном origin)
    // Встроенный сервер всегда запускается первым и обслуживает dist
    const serverUrl = `http://localhost:${SERVER_PORT}`;
    console.log('[Electron] Loading from server:', serverUrl);
    mainWindow.loadURL(serverUrl);

    if (isDev) {
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    }

    // DevTools shortcuts disabled in production

    // Window event handlers
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        // Windows-фикс: принудительно вытащить окно на передний план
        if (process.platform === 'win32') {
            mainWindow.setAlwaysOnTop(true);
            setTimeout(() => mainWindow.setAlwaysOnTop(false), 300);
        }
    });

    mainWindow.on('closed', () => {
        app.quit();
    });
}

// Initialize export folders
function initializeExportFolders() {
    const userDataPath = app.getPath('userData');
    const exportsBasePath = path.join(userDataPath, 'exports');
    const folders = ['products', 'sales', 'zreports', 'shifts', 'dashboard'];

    console.log('[Exports] Initializing export folders at:', exportsBasePath);

    // Create base exports folder
    if (!fs.existsSync(exportsBasePath)) {
        fs.mkdirSync(exportsBasePath, { recursive: true });
        console.log('[Exports] Created base exports folder');
    }

    // Create subfolders
    folders.forEach(folder => {
        const folderPath = path.join(exportsBasePath, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`[Exports] Created folder: ${folder}`);
        }
    });
}

// IPC Handlers
ipcMain.handle('get-path', (event, name) => {
    return app.getPath(name);
});

ipcMain.handle('ensure-folder', async (event, folderPath) => {
    try {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        return { success: true, path: folderPath };
    } catch (error) {
        console.error('[IPC] Failed to create folder:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-file', async (event, { folder, filename, data, encoding }) => {
    try {
        const userDataPath = app.getPath('userData');
        const exportsPath = path.join(userDataPath, 'exports', folder);

        // Ensure folder exists
        if (!fs.existsSync(exportsPath)) {
            fs.mkdirSync(exportsPath, { recursive: true });
        }

        const filePath = path.join(exportsPath, filename);

        // Handle base64 data for PDF
        if (encoding === 'base64') {
            fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
        } else {
            fs.writeFileSync(filePath, data);
        }

        console.log('[IPC] File saved to:', filePath);
        return { success: true, path: filePath };
    } catch (error) {
        console.error('[IPC] Failed to save file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        const { shell } = require('electron');
        await shell.openPath(folderPath);
        return { success: true };
    } catch (error) {
        console.error('[IPC] Failed to open folder:', error);
        return { success: false, error: error.message };
    }
});

// Server status IPC handlers
ipcMain.handle('get-server-info', async () => {
    const localIPs = getLocalIPs();
    const primaryIP = localIPs.length > 0 ? localIPs[0].address : 'localhost';
    return {
        status: serverStatus,
        pid: serverProcess ? serverProcess.pid : null,
        port: SERVER_PORT,
        uptime: serverStartTime ? Math.floor((Date.now() - serverStartTime) / 1000) : 0,
        error: serverError,
        localIPs,
        primaryIP,
        connectionUrl: `http://${primaryIP}:${SERVER_PORT}`,
        apiUrl: `http://${primaryIP}:${SERVER_PORT}/api`,
        hostname: os.hostname()
    };
});

ipcMain.handle('restart-server', async () => {
    console.log('[Server] Restart requested...');
    stopServer();
    await new Promise(resolve => setTimeout(resolve, 2000));
    startServer();
    return { success: true, message: 'Сервер перезапущен' };
});

// Server mode IPC handlers
ipcMain.handle('get-server-mode', () => {
    return readServerMode();
});

ipcMain.handle('set-server-mode', (event, mode) => {
    writeServerMode(mode);
    // Если переключили на 'server' или 'hybrid' — запустить сервер
    if ((mode === 'server' || mode === 'hybrid') && serverStatus !== 'running') {
        startServer();
    }
    // Если переключили на client/cloud — остановить
    if (mode !== 'server' && mode !== 'hybrid' && serverProcess) {
        stopServer();
    }
    return { success: true, mode };
});

// Auto-update IPC handlers
ipcMain.handle('check-for-updates', async () => {
    if (autoUpdater) {
        return await autoUpdater.checkForUpdatesManually();
    }
    return { error: 'Auto-updater not initialized' };
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('quit-app', () => {
    console.log('[App] Quit requested via IPC');
    stopServer();
    app.quit();
});

ipcMain.handle('get-update-info', () => {
    if (autoUpdater) {
        return autoUpdater.getUpdateInfo();
    }
    return null;
});

// Ждать пока сервер будет готов (проверка /api/health)
async function waitForServer(maxAttempts = 15, intervalMs = 1000) {
    const http = require('http');
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const isAlive = await new Promise((resolve) => {
                const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
                    resolve(res.statusCode === 200);
                });
                req.on('error', () => resolve(false));
                req.setTimeout(2000, () => { req.destroy(); resolve(false); });
            });
            if (isAlive) {
                console.log(`[Server] Ready after ${i + 1} attempts`);
                return true;
            }
        } catch (e) { /* retry */ }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    console.log('[Server] Not ready after max attempts, opening window anyway');
    return false;
}

app.whenReady().then(async () => {
    // Initialize export folders
    initializeExportFolders();

    // Запускаем встроенный сервер в режимах 'server' и 'hybrid'
    const mode = readServerMode();
    if (mode === 'server' || mode === 'hybrid') {
        console.log('[App] Mode:', mode, '— starting embedded server...');
        startServer();
        // Ждём пока сервер реально ответит на /api/health
        await waitForServer();
    } else {
        console.log('[App] Mode:', mode, '— skipping embedded server (external)');
        serverStatus = 'external';
    }

    // Открыть окно
    createWindow();

    // Initialize auto-updater (only in production)
    if (!isDev) {
        autoUpdater = new AutoUpdater();
        autoUpdater.init();
        console.log('[AutoUpdater] Initialized');
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Unregister shortcuts and stop server on quit
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopServer();
});

app.on('before-quit', () => {
    stopServer();
});

app.on('window-all-closed', () => {
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
