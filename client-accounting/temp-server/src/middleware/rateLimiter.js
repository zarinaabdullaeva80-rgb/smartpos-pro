import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

/**
 * Rate limiter для общих API запросов
 * Increased limits to accommodate mobile app with polling
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10000, // 10000 запросов с одного IP (увеличено для мобильных приложений)
    message: {
        error: 'Слишком много запросов с этого IP, попробуйте позже'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Если Redis настроен - использовать его
    // store: new RedisStore({ client: redisClient })
});

/**
 * Строгий лимит для аутентификации (защита от brute force)
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // 20 попыток (увеличено с 5 для удобства разработки)
    message: {
        error: 'Слишком много попыток входа, попробуйте через 15 минут'
    },
    skipSuccessfulRequests: true // не считать успешные попытки
});

/**
 * Лимит для создания записей
 */
export const createLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 100, // 100 созданий в минуту (увеличено с 20)
    message: {
        error: 'Слишком много операций создания, подождите минуту'
    }
});

/**
 * Лимит для загрузки файлов
 */
export const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50, // 50 файлов в минуту (увеличено с 10)
    message: {
        error: 'Слишком много загрузок файлов, подождите минуту'
    }
});

export default {
    apiLimiter,
    authLimiter,
    createLimiter,
    uploadLimiter
};
