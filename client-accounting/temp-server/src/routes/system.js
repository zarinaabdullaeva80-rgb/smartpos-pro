import express from 'express';
import os from 'os';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Получить системные метрики
router.get('/metrics', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // CPU usage (средняя загрузка)
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
        }, 0) / cpus.length;

        // Активные соединения БД
        let dbConnections = 0;
        let dbSize = '0 MB';
        try {
            const connResult = await pool.query(`
                SELECT count(*) as active FROM pg_stat_activity 
                WHERE state = 'active'
            `);
            dbConnections = parseInt(connResult.rows[0].active) || 0;

            const sizeResult = await pool.query(`
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            `);
            dbSize = sizeResult.rows[0].size;
        } catch (e) {
            console.error('DB metrics error:', e.message);
        }

        res.json({
            cpu: {
                usage: Math.round(cpuUsage * 100) / 100,
                cores: cpus.length,
                model: cpus[0]?.model || 'Unknown'
            },
            memory: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory,
                usagePercent: Math.round((usedMemory / totalMemory) * 100 * 100) / 100
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                uptime: os.uptime(),
                nodeVersion: process.version
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                memoryUsage: process.memoryUsage()
            },
            database: {
                activeConnections: dbConnections,
                size: dbSize
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('System metrics error:', error);
        res.status(500).json({ error: 'Failed to get system metrics' });
    }
});

// Получить историю метрик (если есть)
router.get('/metrics/history', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { hours = 24 } = req.query;

        // Проверяем есть ли таблица для истории
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'system_metrics_history'
            )
        `);

        if (!tableExists.rows[0].exists) {
            return res.json({ history: [], message: 'No history table' });
        }

        const result = await pool.query(`
            SELECT * FROM system_metrics_history 
            WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
            ORDER BY created_at DESC
            LIMIT 100
        `);

        res.json({ history: result.rows });
    } catch (error) {
        console.error('Metrics history error:', error);
        res.status(500).json({ error: 'Failed to get metrics history' });
    }
});

// Получить активные WebSocket соединения
router.get('/connections', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        // Получаем из глобального io если доступен
        const socketCount = global.io?.engine?.clientsCount || 0;

        res.json({
            websocket: socketCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get connections' });
    }
});

// Получить статус сервисов
router.get('/services', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const services = {
            database: { status: 'unknown', latency: 0 },
            redis: { status: 'unknown', latency: 0 }
        };

        // Проверка PostgreSQL
        const dbStart = Date.now();
        try {
            await pool.query('SELECT 1');
            services.database = {
                status: 'online',
                latency: Date.now() - dbStart
            };
        } catch {
            services.database = { status: 'offline', latency: 0 };
        }

        // Проверка Redis
        try {
            const { getRedisClient } = await import('../services/redis.js');
            const redis = getRedisClient();
            if (redis) {
                const redisStart = Date.now();
                await redis.ping();
                services.redis = {
                    status: 'online',
                    latency: Date.now() - redisStart
                };
            } else {
                services.redis = { status: 'not configured', latency: 0 };
            }
        } catch {
            services.redis = { status: 'offline', latency: 0 };
        }

        res.json({ services, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get services status' });
    }
});

// Получить логи сервера (последние N строк)
router.get('/logs', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { limit = 100, type = 'all' } = req.query;

        // Получаем логи из таблицы если есть
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'server_logs'
            )
        `);

        if (!tableExists.rows[0].exists) {
            // Создаём таблицу
            await pool.query(`
                CREATE TABLE IF NOT EXISTS server_logs (
                    id SERIAL PRIMARY KEY,
                    level VARCHAR(20) DEFAULT 'info',
                    message TEXT,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_server_logs_created ON server_logs(created_at);
                CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs(level);
            `);
        }

        let query = `SELECT * FROM server_logs`;
        const params = [];

        if (type !== 'all') {
            query += ` WHERE level = $1`;
            params.push(type);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);
        res.json({ logs: result.rows });
    } catch (error) {
        console.error('Server logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

export default router;
