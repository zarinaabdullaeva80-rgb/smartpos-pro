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
        environment: process.env.NODE_ENV || 'development',
        release: process.env.npm_package_version || '1.0.0',

        // Performance monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Additional options
        integrations: [
            // HTTP integration for tracing
            Sentry.httpIntegration({ tracing: true }),
            // Express integration
            Sentry.expressIntegration({ app }),
        ],

        // Filter sensitive data
        beforeSend(event) {
            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
            }
            return event;
        },
    });

    console.log('✓ Sentry initialized');
    return true;
}

/**
 * Sentry request handler middleware
 */
export function sentryRequestHandler() {
    return Sentry.expressIntegration().requestHandler;
}

/**
 * Sentry error handler middleware
 */
export function sentryErrorHandler() {
    return Sentry.expressErrorHandler();
}

/**
 * Capture exception manually
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
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

/**
 * Capture message manually
 * @param {string} message - Message to capture
 * @param {string} level - Sentry level (info, warning, error)
 */
export function captureMessage(message, level = 'info') {
    if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(message, level);
    }
}

/**
 * Set user context for Sentry
 * @param {Object} user - User data
 */
export function setUser(user) {
    if (process.env.SENTRY_DSN && user) {
        Sentry.setUser({
            id: user.id,
            username: user.username,
            email: user.email,
        });
    }
}

export default Sentry;
