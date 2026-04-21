import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/sync-status/overview
 * Общий статус синхронизации системы
 */
router.get('/overview', authenticate, async (req, res) => {
    try {
        // Получить статистику подключённых устройств
        const devicesResult = await pool.query(`
            SELECT 
                device_type,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'online' AND last_ping > NOW() - INTERVAL '5 minutes') as online
            FROM connected_devices
            GROUP BY device_type
        `);

        // Статистика за сегодня
        const statsResult = await pool.query(`
            SELECT * FROM dashboard_stats
            WHERE stat_date = CURRENT_DATE
        `);

        // Последние синхронизации
        const syncResult = await pool.query(`
            SELECT sync_type, status, finished_at, duration_ms
            FROM sync_log
            WHERE finished_at IS NOT NULL
            ORDER BY finished_at DESC
            LIMIT 10
        `);

        // Конфликты
        const conflictsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM sync_conflicts
            WHERE status = 'pending'
        `);

        res.json({
            devices: devicesResult.rows,
            stats: statsResult.rows[0] || {},
            recentSyncs: syncResult.rows,
            pendingConflicts: parseInt(conflictsResult.rows[0].count)
        });

    } catch (error) {
        console.error('Error fetching sync overview:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync-status/devices
 * Список подключённых устройств
 */
router.get('/devices', authenticate, checkPermission('admin.settings'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cd.*,
                u.username,
                u.full_name
            FROM connected_devices cd
            LEFT JOIN users u ON cd.user_id = u.id
            ORDER BY cd.last_ping DESC
        `);

        res.json({ devices: result.rows });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync-status/register-device
 * Регистрация устройства
 */
router.post('/register-device', authenticate, async (req, res) => {
    try {
        const { device_id, device_type, device_name, app_version, os_info } = req.body;
        const user_id = req.user.id;

        const result = await pool.query(`
            INSERT INTO connected_devices (
                device_id, device_type, device_name, user_id, 
                app_version, os_info, status, last_ping
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'online', NOW())
            ON CONFLICT (device_id) DO UPDATE SET
                device_type = $2,
                device_name = $3,
                user_id = $4,
                app_version = $5,
                os_info = $6,
                status = 'online',
                last_ping = NOW(),
                connected_at = NOW()
            RETURNING *
        `, [device_id, device_type, device_name, user_id, app_version, os_info]);

        res.json({ success: true, device: result.rows[0] });
    } catch (error) {
        console.error('Error registering device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync-status/ping
 * Пинг от устройства для обновления статуса
 */
router.post('/ping', authenticate, async (req, res) => {
    try {
        const { device_id } = req.body;

        await pool.query(`
            UPDATE connected_devices
            SET last_ping = NOW(), status = 'online'
            WHERE device_id = $1
        `, [device_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating ping:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync-status/conflicts
 * Список конфликтов синхронизации
 */
router.get('/conflicts', authenticate, checkPermission('admin.settings'), async (req, res) => {
    try {
        const { status = 'pending', limit = 100 } = req.query;

        const result = await pool.query(`
            SELECT 
                sc.*,
                cd.device_name,
                cd.device_type
            FROM sync_conflicts sc
            LEFT JOIN connected_devices cd ON sc.client_device_id = cd.device_id
            WHERE sc.status = $1
            ORDER BY sc.created_at DESC
            LIMIT $2
        `, [status, limit]);

        res.json({ conflicts: result.rows });
    } catch (error) {
        console.error('Error fetching conflicts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync-status/resolve-conflict/:id
 * Разрешение конфликта
 */
router.post('/resolve-conflict/:id', authenticate, checkPermission('admin.settings'), async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution } = req.body; // 'server', 'client', 'manual'
        const user_id = req.user.id;

        await pool.query(`
            UPDATE sync_conflicts
            SET status = 'resolved',
                resolution = $1,
                resolved_at = NOW(),
                resolved_by = $2
            WHERE id = $3
        `, [resolution, user_id, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error resolving conflict:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync-status/trigger/:type
 * Принудительная синхронизация
 */
router.post('/trigger/:type', authenticate, async (req, res) => {
    try {
        const { type } = req.params; // 'products', 'sales', 'inventory', 'all'
        const { direction = 'import' } = req.body;

        // Убедимся что таблица существует
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_queue (
                id SERIAL PRIMARY KEY,
                sync_type VARCHAR(50) NOT NULL,
                direction VARCHAR(20) DEFAULT 'import',
                priority INTEGER DEFAULT 5,
                status VARCHAR(20) DEFAULT 'pending',
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                error_message TEXT
            )
        `);

        // Добавить задачу в очередь синхронизации
        const result = await pool.query(`
            INSERT INTO sync_queue (
                sync_type, direction, priority, status, created_by
            )
            VALUES ($1, $2, 10, 'pending', $3)
            RETURNING *
        `, [type, direction, req.user.id]);

        res.json({
            success: true,
            message: `Синхронизация ${type} запланирована`,
            queue_item: result.rows[0]
        });
    } catch (error) {
        console.error('Error triggering sync:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * POST /api/sync-status/update-stats
 * Обновить статистику дашборда (вручную или по расписанию)
 */
router.post('/update-stats', authenticate, async (req, res) => {
    try {
        await pool.query('SELECT update_dashboard_stats()');

        const statsResult = await pool.query(`
            SELECT * FROM dashboard_stats
            WHERE stat_date = CURRENT_DATE
        `);

        res.json({
            success: true,
            stats: statsResult.rows[0]
        });
    } catch (error) {
        console.error('Error updating stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
