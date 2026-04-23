import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';
import path from 'path';
import pool from './config/database.js';
import { initDatabase } from './config/initDatabase.js';
import { initGoogleSheets, syncAllData } from './services/googleSheets.js';

// Logging setup for production debugging
const logFile = process.env.LOG_PATH || path.resolve(process.cwd(), 'server.log');
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

console.log = log;
console.error = logError;
console.warn = log;
console.info = log;

console.log('--- SERVER START ---');
console.log('cwd:', process.cwd());
console.log('env.PORT:', process.env.PORT);
console.log('env.DATABASE_URL existing:', !!process.env.DATABASE_URL);

// Routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import purchasesRoutes from './routes/purchases.js';
import counterpartiesRoutes from './routes/counterparties.js';
import reportsRoutes from './routes/reports.js';
import syncRoutes from './routes/sync.js';
import financeRoutes from './routes/finance.js';
import warehousesRoutes from './routes/warehouses.js';
import employeesRoutes from './routes/employees.js';
import invoicesRoutes from './routes/invoices.js';
import crmRoutes from './routes/crm.js';
import configurationsRoutes from './routes/configurations.js';
import categoriesRoutes from './routes/categories.js';
import shiftsRoutes from './routes/shifts.js';
import returnsRoutes from './routes/returns.js';
import customersRoutes from './routes/customers.js';
import permissionsRoutes from './routes/permissions.js';
import auditRoutes from './routes/audit.js';
import barcodeRoutes from './routes/barcode.js';
import analyticsRoutes from './routes/analytics.js';
import wmsRoutes from './routes/wms.js';
import telegramRoutes from './routes/telegram.js';
import documentsRoutes from './routes/documents.js';
import sync1cRoutes from './routes/sync1c.js';
import healthRoutes from './routes/health.js';
import syncStatusRoutes from './routes/sync-status.js';
import licensingRoutes from './routes/licensing.js';
import loyaltyRoutes from './routes/loyalty.js';
import updatesRoutes from './routes/updates.js';
import extendedRoutes from './routes/extended.js';
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimiter.js';
import { setupSwagger } from './config/swagger.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import twoFactorRoutes from './routes/twoFactor.js';
import settingsRoutes from './routes/settings.js';
import notificationsRoutes from './routes/notifications.js';
import warehouseRoutes from './routes/warehouse.js';
import errorsRoutes from './routes/errors.js';
import systemRoutes from './routes/system.js';
import databaseRoutes from './routes/database.js';
import apiLogsRoutes from './routes/apiLogs.js';
import sessionsRoutes from './routes/sessions.js';
import alertsRoutes from './routes/alerts.js';
import backupRoutes from './routes/backup.js';
import organizationsRoutes from './routes/organizations.js';
import onboardingRoutes from './routes/onboarding.js';
import schedulerRoutes from './routes/scheduler.js';
import deliveriesRoutes from './routes/deliveries.js';
import contractsRoutes from './routes/contracts.js';
import emailCampaignsRoutes from './routes/emailCampaigns.js';
import payrollRoutes from './routes/payroll.js';
import inventoryRoutes from './routes/inventory.js';
import currenciesRoutes from './routes/currencies.js';

import { apiLogger } from './middleware/apiLogger.js';
import { initRedis } from './services/redis.js';
import { checkExpiredLicenses } from './middleware/license.js';
import { globalErrorHandler } from './middleware/errorMiddleware.js';
import { initSentry, sentryErrorHandler } from './config/sentry.js';
import { backupService } from './services/backup.js';
import schedulerService from './services/scheduler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Раздача клиентского приложения (client-accounting/dist) — ДО любых middleware
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === Мобильное PWA (mpos/dist) по пути /mobile ===
const mobileDistPath = process.env.MOBILE_DIST_PATH || path.resolve(__dirname, '..', '..', 'mpos', 'dist');
console.log('[Static] Mobile PWA path:', mobileDistPath, '| exists:', fs.existsSync(mobileDistPath));

if (fs.existsSync(mobileDistPath)) {
    // Статика для /mobile (JS бандл, шрифты, favicon, index.html)
    // Пути в index.html уже переписаны на /mobile/... после билда
    app.use('/mobile', express.static(mobileDistPath, { maxAge: '7d' }));
    
    // SPA fallback: любой маршрут без расширения → index.html
    app.use('/mobile', (req, res, next) => {
        if (req.path.match(/\.\w+$/)) {
            return res.status(404).send('Not found');
        }
        const indexPath = path.join(mobileDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Mobile app not found');
        }
    });

    // Expo загружает шрифты по абсолютному пути /assets/...
    app.use('/assets', (req, res, next) => {
        const mobilePath = path.join(mobileDistPath, 'assets', req.path);
        if (fs.existsSync(mobilePath)) {
            return res.sendFile(mobilePath);
        }
        next();
    });
}

// === Админ-панель (admin-panel/app) по пути /admin ===
const adminPanelPath = process.env.ADMIN_PANEL_PATH || path.resolve(__dirname, '..', '..', 'admin-panel', 'app');
console.log('[Static] Admin panel path:', adminPanelPath, '| exists:', fs.existsSync(adminPanelPath));

if (fs.existsSync(adminPanelPath)) {
    app.use('/admin', express.static(adminPanelPath, { 
        maxAge: 0,  // Без кэша — всегда свежие файлы
        setHeaders: (res) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
    }));
    console.log('[Static] ✅ Admin panel available at /admin');
}

// === Десктопное приложение (client-accounting/dist) ===
// Try multiple paths for client dist
let clientDistPath = process.env.CLIENT_DIST_PATH || '';
const fallbackPaths = [
    clientDistPath,
    path.resolve(__dirname, '..', '..', 'client-accounting', 'dist'),  // dev mode
    path.resolve(__dirname, '..', '..', 'dist'),                        // Electron production mode
    path.resolve(__dirname, '..', 'dist'),                              // adjacent dist
    path.resolve(process.cwd(), 'client-dist'),                         // Railway: client-dist в server/
    path.resolve(__dirname, '..', 'client-dist'),                       // Railway: альтернативный путь
    path.resolve(process.cwd(), 'dist'),                                // cwd/dist
];

// Find the first existing path
clientDistPath = fallbackPaths.find(p => p && fs.existsSync(p)) || fallbackPaths[1];
console.log('[Static] Serving client from:', clientDistPath, '| exists:', fs.existsSync(clientDistPath));

if (fs.existsSync(clientDistPath)) {
    // Статика с правильным кэшированием:
    // - assets/ (хешированные файлы) → кэш на 1 год
    // - index.html → без кэша (чтобы всегда загружались актуальные хеши)
    app.use(express.static(clientDistPath, {
        maxAge: '1y',
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                res.set('Pragma', 'no-cache');
                res.set('Expires', '0');
            }
        }
    }));
    // SPA fallback: serve index.html for any non-API, non-mobile, non-admin route
    app.get(/^(?!\/api|\/socket\.io|\/uploads|\/health|\/api-docs|\/mobile|\/admin|\/assets).*$/, (req, res, next) => {
        const indexPath = path.join(clientDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.sendFile(indexPath);
        } else {
            next();
        }
    });
} else {
    console.warn('[Static] WARNING: No client dist directory found! Tried:', fallbackPaths.filter(Boolean));
}

// Initialize Sentry (must be early)
initSentry(app);

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5000'];

const io = new Server(server, {
    cors: {
        origin: '*', // Allow mobile apps (Expo, React Native)
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
    }
});

// Make io accessible to routes via req.app.get('io')
app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Socket.IO] Client disconnected:', socket.id);
    });
    // Mobile device registration
    socket.on('register:device', (data) => {
        console.log('[Socket.IO] Device registered:', data?.device_id);
        socket.join(`device:${data?.device_id}`);
    });
    // Room subscription (dashboard, reports, etc.)
    socket.on('subscribe', (room) => {
        socket.join(room);
    });
});

// CORS Configuration - MUST BE BEFORE OTHER MIDDLEWARE

// Специальный CORS для лицензирования — доступен с любого origin
app.use('/api/license', cors({
    origin: true, // Разрешить все origins для лицензирования
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin) return callback(null, true);

        // Allow Electron apps (file:// protocol)
        if (origin === 'file://' || origin.startsWith('file://')) {
            return callback(null, true);
        }

        // Allow ALL localhost origins (any port) — for Electron and dev
        if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
            return callback(null, true);
        }

        // Allow LAN/private network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (origin.match(/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/)) {
            return callback(null, true);
        }

        // Allow ngrok tunnels and Railway deployments
        if (origin.match(/\.(ngrok-free\.dev|ngrok\.io|railway\.app)$/)) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
}));

// Security headers - configured to not interfere with CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Disable caching on API routes (no 304 responses)
app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Rate limiting
app.use('/api/', apiLimiter);

// Swagger Documentation
setupSwagger(app);

// Initialize Redis (optional)
try {
    initRedis();
} catch (error) {
    console.warn('Redis initialization failed (optional):', error.message);
}

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// API Logger (логирование в БД)
app.use(apiLogger({ logAll: false }));

// Organization middleware (multi-tenant)
import { attachOrganization } from './middleware/organization.js';


// Раздача статических файлов (изображения товаров)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/counterparties', counterpartiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/configurations', configurationsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wms', wmsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/sync1c', sync1cRoutes);
app.use('/api', healthRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/sync-status', syncStatusRoutes);
app.use('/api/license', licensingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/extended', extendedRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/errors', errorsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/api-logs', apiLogsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/email-campaigns', emailCampaignsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/currencies', currenciesRoutes);



// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});



// SPA fallback уже обработан выше (строка 130) через express.static + regex route

// Sentry error handler (before global error handler)
app.use(sentryErrorHandler());

// Глобальный обработчик ошибок (должен быть последним)
app.use(globalErrorHandler);

// Экспорт io для использования в других модулях
export { io };

// Функция для отправки обновлений клиентам
export function notifyClients(event, data) {
    io.emit(event, data);
}

// Инициализация базы данных и сервера
async function startServer() {
    try {
        // Проверка подключения к БД (с повторными попытками)
        let dbConnected = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                await pool.query('SELECT NOW()');
                dbConnected = true;
                console.log('✓ База данных подключена');
                break;
            } catch (dbErr) {
                console.warn(`⚠️ Попытка подключения к БД ${attempt}/5: ${dbErr.message}`);
                if (attempt < 5) await new Promise(r => setTimeout(r, 3000));
            }
        }
        if (!dbConnected) throw new Error('Не удалось подключиться к базе данных после 5 попыток');

        // Инициализация базы данных (создание таблиц если не существуют)
        try {
            await initDatabase(pool);
        } catch (initErr) {
            console.error('⚠️ Ошибка инициализации БД (не критично):', initErr.message);
        }

        // Инициализация Google Sheets API (необязательная)
        try {
            await initGoogleSheets();
        } catch (gsError) {
            console.warn('⚠️ Google Sheets не инициализирован (нет credentials):', gsError.message);
        }

        // Периодическая синхронизация с Google Sheets (каждые 5 минут)
        setInterval(async () => {
            try {
                await syncAllData();
            } catch (error) {
                console.error('Ошибка автоматической синхронизации:', error);
            }
        }, 5 * 60 * 1000);

        // Проверка истёкших лицензий — сразу при старте и каждые 10 минут
        try {
            await checkExpiredLicenses();
            console.log('✓ Initial expired licenses check completed');
        } catch (error) {
            console.error('Ошибка начальной проверки лицензий:', error);
        }
        setInterval(async () => {
            try {
                await checkExpiredLicenses();
            } catch (error) {
                console.error('Ошибка проверки лицензий:', error);
            }
        }, 10 * 60 * 1000);

        // Автоматический бэкап (каждые 24 часа)
        setInterval(async () => {
            try {
                console.log('⏰ Запуск автоматического бэкапа...');
                await backupService.createBackup();
            } catch (error) {
                console.error('Ошибка автобэкапа:', error);
            }
        }, 24 * 60 * 60 * 1000);

        // Выполнить бэкап при запуске (если прошло больше 24 часов)
        setTimeout(async () => {
            try {
                const status = await backupService.getStatus();
                const lastBackup = status.logs?.[0]?.created_at;
                const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

                if (!lastBackup || new Date(lastBackup) < new Date(dayAgo)) {
                    console.log('📦 Запуск стартового бэкапа...');
                    await backupService.createBackup();
                }
            } catch (error) {
                console.error('Ошибка стартового бэкапа:', error);
            }
        }, 10000); // Через 10 секунд после запуска

        // Инициализация планировщика синхронизации
        setTimeout(async () => {
            try {
                await schedulerService.init();
            } catch (error) {
                console.error('Ошибка инициализации планировщика:', error);
            }
        }, 5000); // Через 5 секунд после запуска

        // Миграции теперь применяются через initDatabase() выше

        const PORT = process.env.PORT || 5000;
        const HOST = process.env.SERVER_HOST || '0.0.0.0';

        server.listen(PORT, HOST, async () => {
            // Получение всех локальных IP-адресов для удобства подключения
            const os = await import('os');
            const nets = os.networkInterfaces();
            const addresses = [];
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        addresses.push(net.address);
                    }
                }
            }

            console.log('='.repeat(50));
            console.log(`🚀 SmartPOS Pro Server запущен!`);
            console.log(`📡 Локальный доступ: http://localhost:${PORT}`);
            
            if (addresses.length > 0) {
                console.log(`\n🌐 Доступ в WiFi сети:`);
                addresses.forEach(ip => {
                    console.log(`   👉 http://${ip}:${PORT}`);
                    console.log(`   🔗 API: http://${ip}:${PORT}/api`);
                });
                console.log(`\n💡 Введите один из этих адресов в мобильном приложении или на другом ПК.`);
            } else {
                console.log(`\n⚠️ Внешние IP-адреса не найдены. Проверьте подключение к WiFi.`);
            }
            
            console.log(`\n🔌 WebSocket сервер активен`);
            console.log('='.repeat(50));
        });
    } catch (error) {
        console.error('Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

startServer();
