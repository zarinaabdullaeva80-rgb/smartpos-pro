const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Модуль автообновления для SmartPOS Pro
 * Использует electron-updater (совместим с NSIS installer)
 * Проверяет GitHub Releases для обновлений
 */

class AutoUpdater {
    constructor() {
        this.updateCheckInterval = 4 * 60 * 60 * 1000; // 4 часа
        this.isUpdating = false;
        this.intervalId = null;

        // Настройки electron-updater
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.allowPrerelease = false;

        // Логирование
        autoUpdater.logger = {
            info: (msg) => console.log('[AutoUpdater]', msg),
            warn: (msg) => console.warn('[AutoUpdater]', msg),
            error: (msg) => console.error('[AutoUpdater]', msg),
            debug: (msg) => console.log('[AutoUpdater:debug]', msg)
        };
    }

    /**
     * Инициализация автообновления
     */
    init() {
        if (process.env.NODE_ENV === 'development') {
            console.log('[AutoUpdater] Отключен в режиме разработки');
            return;
        }

        try {
            this.setupEventHandlers();
            this.startPeriodicCheck();

            // Проверить обновления при запуске (с задержкой 15 сек)
            setTimeout(() => this.checkForUpdates(), 15000);

            console.log('[AutoUpdater] Инициализирован успешно');
        } catch (error) {
            console.error('[AutoUpdater] Ошибка инициализации:', error);
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventHandlers() {
        autoUpdater.on('error', (error) => {
            console.error('[AutoUpdater] Ошибка:', error.message);
            this.isUpdating = false;
            this.notifyRenderer('update-error', { message: error.message });
        });

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Проверка обновлений...');
            this.notifyRenderer('checking-for-update');
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[AutoUpdater] Доступно обновление:', info.version);
            this.notifyRenderer('update-available', {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes
            });

            // Показать диалог для скачивания
            this.showDownloadDialog(info);
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[AutoUpdater] Обновлений нет. Текущая версия:', info.version);
            this.notifyRenderer('update-not-available', {
                version: info.version
            });
        });

        autoUpdater.on('download-progress', (progress) => {
            const percent = Math.round(progress.percent);
            console.log(`[AutoUpdater] Загрузка: ${percent}%`);
            this.notifyRenderer('download-progress', {
                percent: percent,
                bytesPerSecond: progress.bytesPerSecond,
                transferred: progress.transferred,
                total: progress.total
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] Обновление загружено:', info.version);
            this.isUpdating = false;
            this.notifyRenderer('update-downloaded', {
                version: info.version,
                releaseNotes: info.releaseNotes
            });

            // Показать диалог установки
            this.showInstallDialog(info);
        });
    }

    /**
     * Проверить наличие обновлений
     */
    async checkForUpdates() {
        if (this.isUpdating) {
            console.log('[AutoUpdater] Обновление уже в процессе');
            return null;
        }

        try {
            const result = await autoUpdater.checkForUpdates();
            return result;
        } catch (error) {
            console.error('[AutoUpdater] Ошибка проверки:', error.message);
            return null;
        }
    }

    /**
     * Ручная проверка обновлений (по запросу пользователя)
     */
    async checkForUpdatesManually() {
        this.notifyRenderer('checking-for-update');

        try {
            const result = await autoUpdater.checkForUpdatesAndNotify();

            if (result && result.updateInfo) {
                const currentVersion = autoUpdater.currentVersion.version;
                const latestVersion = result.updateInfo.version;

                return {
                    updateAvailable: latestVersion !== currentVersion,
                    currentVersion,
                    latestVersion,
                    releaseNotes: result.updateInfo.releaseNotes || ''
                };
            }

            return {
                updateAvailable: false,
                currentVersion: autoUpdater.currentVersion.version
            };
        } catch (error) {
            this.notifyRenderer('update-error', { message: error.message });
            return { error: error.message };
        }
    }

    /**
     * Периодическая проверка обновлений
     */
    startPeriodicCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.checkForUpdates();
        }, this.updateCheckInterval);
    }

    /**
     * Показать диалог скачивания обновления
     */
    showDownloadDialog(info) {
        const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!mainWindow) return;

        const options = {
            type: 'info',
            buttons: ['Скачать', 'Позже'],
            defaultId: 0,
            cancelId: 1,
            title: 'Доступно обновление',
            message: `Доступна новая версия ${info.version}`,
            detail: `Текущая версия: ${autoUpdater.currentVersion.version}\nНовая версия: ${info.version}\n\nСкачать обновление?`
        };

        dialog.showMessageBox(mainWindow, options).then((response) => {
            if (response.response === 0) {
                this.isUpdating = true;
                autoUpdater.downloadUpdate();
            }
        });
    }

    /**
     * Показать диалог установки обновления
     */
    showInstallDialog(info) {
        const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!mainWindow) return;

        const options = {
            type: 'info',
            buttons: ['Установить и перезапустить', 'Позже'],
            defaultId: 0,
            cancelId: 1,
            title: 'Обновление готово',
            message: `Версия ${info.version} готова к установке`,
            detail: 'Приложение будет перезапущено для установки обновления.'
        };

        dialog.showMessageBox(mainWindow, options).then((response) => {
            if (response.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    }

    /**
     * Получить информацию о текущей версии
     */
    getUpdateInfo() {
        return {
            currentVersion: autoUpdater.currentVersion.version,
            isUpdating: this.isUpdating
        };
    }

    /**
     * Уведомить renderer процесс
     */
    notifyRenderer(channel, data = null) {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
            if (win && win.webContents) {
                win.webContents.send(channel, data);
            }
        });
    }

    /**
     * Остановить периодическую проверку
     */
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

module.exports = AutoUpdater;
