const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        title: 'SmartPOS Admin Panel',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

    // Custom menu
    const menu = Menu.buildFromTemplate([
        {
            label: 'Файл',
            submenu: [
                { label: 'Обновить', accelerator: 'F5', click: () => mainWindow.reload() },
                { type: 'separator' },
                { label: 'Выход', accelerator: 'Alt+F4', click: () => app.quit() }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                { label: 'Полный экран', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
                { label: 'DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});
