/**
 * Комплексная защита сервера от DDoS и атак
 * Включает: Rate limiting, Helmet, CORS, IP фильтрацию, брутфорс защиту
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { validationResult } from 'express-validator';

// ============ КОНФИГУРАЦИЯ ============

const config = {
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000,     // 15 минут
        max: 100,                      // Максимум запросов за окно
        message: { error: 'Слишком много запросов. Попробуйте позже.' }
    },

    // Строгий лимит для API
    apiRateLimit: {
        windowMs: 1 * 60 * 1000,      // 1 минута
        max: 60,                       // 60 запросов в минуту
        message: { error: 'Превышен лимит API запросов.' }
    },

    // Защита логина
    loginRateLimit: {
        windowMs: 15 * 60 * 1000,     // 15 минут
        max: 5,                        // 5 попыток логина
        message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' }
    },

    // Замедление при большой нагрузке
    speedLimiter: {
        windowMs: 15 * 60 * 1000,
        delayAfter: 50,               // Замедлять после 50 запросов
        delayMs: () => 500            // Задержка 500ms
    },

    // IP блокировка
    blockedIPs: new Set(),
    trustedIPs: new Set(['127.0.0.1', '::1']),

    // Подозрительные паттерны (проверяются только в URL, не в body)
    suspiciousPatterns: [
        /\.\.\//g,                     // Path traversal
        /union\s+select/gi,            // SQL injection
        /exec\s*\(/gi,                 // Command injection
        /eval\s*\(/gi,                 // Eval injection
    ]
};

// ============ MIDDLEWARE ============

/**
 * Helmet - Security headers
 */
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
});

/**
 * Rate Limiter - Общий
 */
export const generalRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
    },
    handler: (req, res, next, options) => {
        logSecurityEvent('RATE_LIMIT_EXCEEDED', req);
        res.status(429).json(options.message);
    }
});

/**
 * Rate Limiter - API
 */
export const apiRateLimiter = rateLimit({
    windowMs: config.apiRateLimit.windowMs,
    max: config.apiRateLimit.max,
    message: config.apiRateLimit.message,
    standardHeaders: true,
    keyGenerator: (req) => req.ip,
    handler: (req, res, next, options) => {
        logSecurityEvent('API_RATE_LIMIT_EXCEEDED', req);
        res.status(429).json(options.message);
    }
});

/**
 * Rate Limiter - Логин (защита от брутфорса)
 */
export const loginRateLimiter = rateLimit({
    windowMs: config.loginRateLimit.windowMs,
    max: config.loginRateLimit.max,
    message: config.loginRateLimit.message,
    standardHeaders: true,
    skipSuccessfulRequests: true,       // Не считать успешные логины
    keyGenerator: (req) => {
        // Блокировка по IP + username
        const username = req.body?.username || '';
        return `${req.ip}_${username}`;
    },
    handler: (req, res, next, options) => {
        logSecurityEvent('BRUTE_FORCE_DETECTED', req, { username: req.body?.username });
        res.status(429).json(options.message);
    }
});

/**
 * Speed Limiter - Замедление при нагрузке
 */
export const speedLimiter = slowDown({
    windowMs: config.speedLimiter.windowMs,
    delayAfter: config.speedLimiter.delayAfter,
    delayMs: config.speedLimiter.delayMs
});

/**
 * IP фильтрация
 */
export const ipFilter = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Проверка блокировки
    if (config.blockedIPs.has(clientIP)) {
        logSecurityEvent('BLOCKED_IP_ACCESS', req);
        return res.status(403).json({ error: 'Доступ запрещён' });
    }

    next();
};

/**
 * Защита от подозрительных запросов
 * Проверяет только URL (не body — чтобы не ломать бизнес-данные)
 */
export const requestSanitizer = (req, res, next) => {
    const url = req.originalUrl || req.url;

    for (const pattern of config.suspiciousPatterns) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        if (pattern.test(url)) {
            logSecurityEvent('SUSPICIOUS_REQUEST', req, { pattern: pattern.toString() });
            return res.status(400).json({ error: 'Недопустимый запрос' });
        }
    }

    next();
};

/**
 * XSS защита для body — НЕ портит данные в БД
 * Санитизация применяется только к полям, которые могут отображаться в HTML
 * Пароли, штрихкоды, JSON и другие данные пропускаются
 */
// Поля, которые НЕ нужно санитизировать (пароли, коды, токены, JSON)
const SKIP_SANITIZE_KEYS = new Set([
    'password', 'password_hash', 'passwordHash', 'oldPassword', 'newPassword',
    'token', 'botToken', 'bot_token', 'jwt', 'secret', 'webhookSecret',
    'barcode', 'code', 'license_key', 'licenseKey', 'device_fingerprint',
    'features', 'metadata', 'settings', 'value', 'setting_value',
    'imageUrl', 'image_url', 'webhookUrl', 'webhook_url', 'server_url', 'serverUrl'
]);

export const xssProtection = (req, res, next) => {
    if (req.body) {
        sanitizeObject(req.body);
    }
    if (req.query) {
        sanitizeObject(req.query);
    }
    next();
};

function sanitizeObject(obj, parentKey = '') {
    for (const key in obj) {
        // Пропускаем чувствительные поля
        if (SKIP_SANITIZE_KEYS.has(key)) continue;

        if (typeof obj[key] === 'string') {
            // Заменяем только опасные теги, не трогаем кавычки
            obj[key] = obj[key]
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            sanitizeObject(obj[key], key);
        }
    }
}

/**
 * Валидация ошибок
 */
export const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// ============ ЛОГИРОВАНИЕ ============

const securityLogs = [];

export function logSecurityEvent(type, req, extra = {}) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        ip: req.ip || req.connection?.remoteAddress,
        method: req.method,
        url: req.originalUrl || req.url,
        userAgent: req.headers['user-agent'],
        ...extra
    };

    securityLogs.push(event);

    // Лимит лога
    if (securityLogs.length > 10000) {
        securityLogs.shift();
    }

    console.warn(`[SECURITY] ${type}:`, event);

    // Автоматическая блокировка при множественных нарушениях
    const recentEvents = securityLogs.filter(e =>
        e.ip === event.ip &&
        new Date(e.timestamp) > new Date(Date.now() - 60000)
    );

    if (recentEvents.length >= 10) {
        blockIP(event.ip, 'Auto-blocked: too many violations');
    }
}

export function blockIP(ip, reason) {
    if (!config.trustedIPs.has(ip)) {
        config.blockedIPs.add(ip);
        console.warn(`[SECURITY] IP BLOCKED: ${ip} - ${reason}`);
    }
}

export function unblockIP(ip) {
    config.blockedIPs.delete(ip);
    console.log(`[SECURITY] IP UNBLOCKED: ${ip}`);
}

export function getSecurityLogs(limit = 100) {
    return securityLogs.slice(-limit);
}

export function getBlockedIPs() {
    return Array.from(config.blockedIPs);
}

export const hppMiddleware = hpp();

/**
 * Применить все security middleware к приложению
 */
export const applySecurityMiddleware = (app) => {
    app.use(helmetMiddleware);
    app.use(hpp());
    app.use(ipFilter);
    app.use(requestSanitizer);
    app.use(speedLimiter);
    app.use(generalRateLimiter);

    console.log('[SECURITY] All security middleware applied');
};
