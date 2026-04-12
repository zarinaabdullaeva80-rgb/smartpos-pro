/**
 * Logger Service
 * 
 * Централизованная система логирования для мобильного приложения.
 * Предоставляет различные уровни логирования и форматирование сообщений.
 */

import { LOG_CONFIG } from '../config/settings';

// Уровни логирования
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Цвета для разных уровней (для терминала/консоли)
const LOG_COLORS = {
    debug: '\x1b[36m',  // Cyan
    info: '\x1b[32m',   // Green
    warn: '\x1b[33m',   // Yellow
    error: '\x1b[31m',  // Red
    reset: '\x1b[0m',   // Reset
};

class Logger {
    constructor() {
        this.level = LOG_LEVELS[LOG_CONFIG.LEVEL] || LOG_LEVELS.info;
        this.consoleLogging = LOG_CONFIG.CONSOLE_LOGGING;
    }

    /**
     * Форматировать сообщение лога
     */
    formatMessage(level, module, message, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;

        if (data !== undefined) {
            return `${prefix} ${message}`;
        }
        return `${prefix} ${message}`;
    }

    /**
     * Проверить, должно ли сообщение быть залогировано
     */
    shouldLog(level) {
        return LOG_LEVELS[level] >= this.level;
    }

    /**
     * Логировать сообщение
     */
    log(level, module, message, data) {
        if (!this.consoleLogging || !this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, module, message, data);

        // Выбрать метод консоли
        const consoleMethod = level === 'error' ? console.error :
            level === 'warn' ? console.warn :
                console.log;

        if (data !== undefined) {
            consoleMethod(formattedMessage, data);
        } else {
            consoleMethod(formattedMessage);
        }
    }

    /**
     * Debug уровень
     */
    debug(module, message, data) {
        this.log('debug', module, message, data);
    }

    /**
     * Info уровень
     */
    info(module, message, data) {
        this.log('info', module, message, data);
    }

    /**
     * Warning уровень
     */
    warn(module, message, data) {
        this.log('warn', module, message, data);
    }

    /**
     * Error уровень
     */
    error(module, message, error) {
        this.log('error', module, message, error);

        // Можно добавить отправку ошибок в crash reporting (Sentry, Bugsnag)
        // if (production) {
        //     sendToErrorTracking(module, message, error);
        // }
    }

    /**
     * Логировать API запрос
     */
    apiRequest(method, url, data) {
        if (LOG_CONFIG.LOG_API_REQUESTS) {
            this.debug('API', `${method} ${url}`, data);
        }
    }

    /**
     * Логировать API ответ
     */
    apiResponse(method, url, status, data) {
        if (LOG_CONFIG.LOG_API_REQUESTS) {
            const level = status >= 400 ? 'error' : 'debug';
            this.log(level, 'API', `${method} ${url} - ${status}`, data);
        }
    }

    /**
     * Логировать offline операции
     */
    offline(operation, message, data) {
        if (LOG_CONFIG.LOG_OFFLINE_OPERATIONS) {
            this.info('Offline', `${operation}: ${message}`, data);
        }
    }

    /**
     * Логировать синхронизацию
     */
    sync(message, data) {
        this.info('Sync', message, data);
    }

    /**
     * Логировать действия пользователя
     */
    userAction(screen, action, data) {
        this.info('User', `${screen} - ${action}`, data);
    }
}

// Создать singleton instance
const logger = new Logger();

// Экспортировать готовый к использованию logger
export default logger;

// Экспортировать также класс для тестирования
export { Logger };
