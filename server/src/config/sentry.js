import * as Sentry from "@sentry/node";

/**
 * Initialize Sentry error tracking
 * @param {Express} app - Express application instance
 */
export function initSentry(app) {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        console.log('ℹ️  Sentry disabled (no SENTRY_DSN configured)');
        return false;
    }

    Sentry.init({
        dsn: dsn,
        environment: process.env.NODE_ENV || 'production',
        release: `smartpos-pro@4.2.8`,
        tracesSampleRate: 0.2,
        // Сбор данных о пользователях для отладки
        sendDefaultPii: true,
    });

    console.log('✓ Sentry initialized');
    return true;
}

/**
 * Setup Sentry error handler for Express
 * @param {Express} app - Express application instance
 */
export function setupSentryErrorHandler(app) {
    if (process.env.SENTRY_DSN) {
        Sentry.setupExpressErrorHandler(app);
        
        // Кастомный обработчик для возврата ID ошибки клиенту
        app.use((err, req, res, next) => {
            res.statusCode = 500;
            res.end(res.sentry + "\n");
        });
        
        console.log('✓ Sentry Error Handler attached');
    }
}

export function captureException(error, context = {}) {
    if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            Sentry.captureException(error);
        });
    }
}

export default Sentry;
