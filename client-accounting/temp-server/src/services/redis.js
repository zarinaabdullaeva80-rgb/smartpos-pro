import Redis from 'ioredis';

let redisClient = null;
let redisEnabled = false;

/**
 * Initialize Redis connection
 */
export const initRedis = () => {
    if (redisClient) return redisClient;

    // Check if Redis is explicitly enabled
    const enableRedis = process.env.ENABLE_REDIS_CACHE === 'true';

    if (!enableRedis) {
        console.log('ℹ️  Redis caching disabled (ENABLE_REDIS_CACHE=false)');
        redisEnabled = false;
        return null;
    }

    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
            if (times > 3) {
                console.warn('⚠️  Redis connection failed, disabling cache');
                redisEnabled = false;
                return null; // Stop retrying
            }
            return Math.min(times * 100, 2000);
        },
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false
    };

    try {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
            console.log('✓ Redis connected');
            redisEnabled = true;
        });

        redisClient.on('error', (err) => {
            if (redisEnabled) {
                console.error('Redis error:', err.message);
            }
            redisEnabled = false;
        });

        redisClient.on('ready', () => {
            console.log('✓ Redis ready');
            redisEnabled = true;
        });

        // Try to connect
        redisClient.connect().catch(() => {
            redisEnabled = false;
        });

        return redisClient;
    } catch (error) {
        console.warn('⚠️  Redis initialization failed:', error.message);
        redisEnabled = false;
        return null;
    }
};

/**
 * Check if Redis is available
 */
export const isRedisEnabled = () => redisEnabled;

/**
 * Get Redis client
 */
export const getRedis = () => {
    if (!redisClient) {
        return initRedis();
    }
    return redisClient;
};

/**
 * Cache middleware
 */
export const cacheMiddleware = (duration = 300) => {
    return async (req, res, next) => {
        const redis = getRedis();

        if (!redis) {
            return next(); // Skip caching if Redis not available
        }

        const key = `cache:${req.originalUrl}`;

        try {
            const cached = await redis.get(key);

            if (cached) {
                console.log(`Cache HIT: ${key}`);
                return res.json(JSON.parse(cached));
            }

            console.log(`Cache MISS: ${key}`);

            // Store original json method
            const originalJson = res.json.bind(res);

            // Override json method
            res.json = (data) => {
                // Cache the response
                redis.setex(key, duration, JSON.stringify(data)).catch(err => {
                    console.error('Cache set error:', err);
                });

                return originalJson(data);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
};

/**
 * Invalidate cache by pattern
 */
export const invalidateCache = async (pattern) => {
    const redis = getRedis();
    if (!redis) return;

    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`Invalidated ${keys.length} cache keys matching ${pattern}`);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
};

/**
 * Set cache
 */
export const setCache = async (key, value, duration = 300) => {
    const redis = getRedis();
    if (!redis) return false;

    try {
        await redis.setex(key, duration, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Set cache error:', error);
        return false;
    }
};

/**
 * Get cache
 */
export const getCache = async (key) => {
    const redis = getRedis();
    if (!redis) return null;

    try {
        const cached = await redis.get(key);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Get cache error:', error);
        return null;
    }
};

/**
 * Delete cache
 */
export const deleteCache = async (key) => {
    const redis = getRedis();
    if (!redis) return false;

    try {
        await redis.del(key);
        return true;
    } catch (error) {
        console.error('Delete cache error:', error);
        return false;
    }
};

export default {
    initRedis,
    getRedis,
    cacheMiddleware,
    invalidateCache,
    setCache,
    getCache,
    deleteCache
};
