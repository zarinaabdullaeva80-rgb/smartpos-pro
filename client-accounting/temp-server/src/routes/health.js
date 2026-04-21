import express from 'express';
import pool from '../config/database.js';
import os from 'os';

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Проверка здоровья
 *     tags: [Проверка здоровья]
 *     responses:
 *       200:
 *         description: Система работает
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: Система недоступна
 */
router.get('/health', async (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    try {
        // Проверить подключение к БД
        await pool.query('SELECT 1');
        healthcheck.database = 'connected';
    } catch (error) {
        healthcheck.database = 'disconnected';
        healthcheck.message = 'DEGRADED';
        return res.status(503).json(healthcheck);
    }

    res.json(healthcheck);
});

/**
 * GET /api/health/detailed
 * Detailed health check for mobile app
 */
router.get('/health/detailed', async (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: new Date().toISOString(),
        version: '3.5.0',
        environment: process.env.NODE_ENV || 'development',
        system: {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
            freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        },
        process: {
            pid: process.pid,
            nodeVersion: process.version,
            memoryUsage: {
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            }
        }
    };

    try {
        await pool.query('SELECT 1');
        healthcheck.database = 'connected';
    } catch (error) {
        healthcheck.database = 'disconnected';
        healthcheck.message = 'DEGRADED';
    }

    res.json(healthcheck);
});

/**
 * Detailed status endpoint (только для админов)
 */
router.get('/status', async (req, res) => {
    try {
        // Database stats
        const dbStats = await pool.query(`
            SELECT 
                (SELECT count(*) FROM products) as products_count,
                (SELECT count(*) FROM sales) as sales_count,
                (SELECT count(*) FROM users) as users_count,
                (SELECT pg_database_size(current_database())) as db_size
        `);

        // System info
        const status = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,

            system: {
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
                freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
                loadAverage: os.loadavg()
            },

            process: {
                pid: process.pid,
                version: process.version,
                memoryUsage: {
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
                }
            },

            database: {
                status: 'connected',
                stats: dbStats.rows[0],
                size: Math.round(dbStats.rows[0].db_size / 1024 / 1024) + ' MB'
            },

            features: {
                pdf_generation: true,
                email_service: !!process.env.SMTP_USER,
                telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
                sentry: !!process.env.SENTRY_DSN,
                redis: process.env.ENABLE_REDIS_CACHE === 'true'
            }
        };

        res.json(status);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get status',
            message: error.message
        });
    }
});

/**
 * Проверка версии
 */
router.get('/version', (req, res) => {
    res.json({
        version: '3.5.0',
        buildDate: '2026-03-29',
        features: {
            core: '100%',
            wms: '90%',
            crm: '100%',
            automation: '90%',
            integration_1c: '95%',
            production_ready: '100%'
        }
    });
});

export default router;
