import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// Получить журнал действий с фильтрами
router.get('/', authenticate, checkPermission('audit.view'), async (req, res) => {
    try {
        const {
            userId,
            entityType,
            action,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = req.query;

        const userLicenseId = req.user.license_id;
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (userLicenseId) {
            whereConditions.push(`al.license_id = $${paramIndex++}`);
            params.push(userLicenseId);
        }

        if (userId) {
            whereConditions.push(`user_id = $${paramIndex++}`);
            params.push(userId);
        }

        if (entityType) {
            whereConditions.push(`entity_type = $${paramIndex++}`);
            params.push(entityType);
        }

        if (action) {
            whereConditions.push(`action = $${paramIndex++}`);
            params.push(action);
        }

        if (startDate) {
            whereConditions.push(`created_at >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            whereConditions.push(`created_at <= $${paramIndex++}`);
            params.push(endDate);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const offset = (page - 1) * limit;
        params.push(limit, offset);

        // Получить общее количество
        const countResult = await pool.query(`
            SELECT COUNT(*) as total FROM audit_log ${whereClause}
        `, params.slice(0, -2));

        const total = parseInt(countResult.rows[0].total);

        // Получить записи
        const result = await pool.query(`
            SELECT 
                al.*,
                u.full_name as user_full_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}
        `, params);

        res.json({
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить историю конкретной сущности
router.get('/entity/:entityType/:entityId', authenticate, checkPermission('audit.view'), async (req, res) => {
    try {
        const { entityType, entityId } = req.params;

        const userLicenseId = req.user.license_id;
        let query = `
            SELECT 
                al.*,
                u.full_name as user_full_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.entity_type = $1 AND al.entity_id = $2
        `;
        const params = [entityType, entityId];

        if (userLicenseId) {
            query += ' AND al.license_id = $3';
            params.push(userLicenseId);
        }

        query += ' ORDER BY al.created_at DESC';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching entity history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить действия пользователя
router.get('/user/:userId', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100 } = req.query;

        // Проверить что запрашивают свою историю или есть право audit.view
        if (req.user.id !== parseInt(userId)) {
            const hasPermission = await pool.query(`
                SELECT COUNT(*) > 0 as has_permission
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1 AND p.code = 'audit.view'
            `, [req.user.id]);

            if (!hasPermission.rows[0].has_permission) {
                return res.status(403).json({ error: 'Доступ запрещён' });
            }
        }

        const userLicenseId = req.user.license_id;
        let query = `
            SELECT *
            FROM audit_log
            WHERE user_id = $1
        `;
        const params = [userId, limit];

        if (userLicenseId) {
            query += ' AND license_id = $3';
            params.push(userLicenseId);
        }

        query += ' ORDER BY created_at DESC LIMIT $2';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить статистику
router.get('/stats', authenticate, checkPermission('audit.view'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ed = endDate || new Date().toISOString();

        const userLicenseId = req.user.license_id;
        // Note: get_audit_stats might need to be updated to support license_id
        // For now, we filter if license exists, assuming the function returns all
        let query = 'SELECT * FROM get_audit_stats($1::TIMESTAMP, $2::TIMESTAMP)';
        const params = [sd, ed];

        if (userLicenseId) {
            // This is a hack if the function doesn't support license_id. 
            // Better to update the function eventually.
            query = 'SELECT * FROM audit_log WHERE created_at BETWEEN $1 AND $2 AND license_id = $3';
            params.push(userLicenseId);
            // If it's just raw logs, it's not "stats" but for now let's keep it safe.
        }

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить настройки логирования
router.get('/settings', authenticate, checkPermission('settings.manage'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM audit_settings ORDER BY entity_type
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обновить настройки логирования
router.put('/settings/:entityType', authenticate, checkPermission('settings.manage'), async (req, res) => {
    try {
        const { entityType } = req.params;
        const { enabled, log_creates, log_updates, log_deletes, log_reads, retention_days } = req.body;

        await pool.query(`
            UPDATE audit_settings
            SET enabled = $1,
                log_creates = $2,
                log_updates = $3,
                log_deletes = $4,
                log_reads = $5,
                retention_days = $6,
                updated_at = NOW()
            WHERE entity_type = $7
        `, [enabled, log_creates, log_updates, log_deletes, log_reads, retention_days, entityType]);

        res.json({ success: true, message: 'Настройки обновлены' });
    } catch (error) {
        console.error('Error updating audit settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Очистить старые логи
router.post('/cleanup', authenticate, checkPermission('settings.manage'), async (req, res) => {
    try {
        await pool.query('SELECT cleanup_old_audit_logs()');

        res.json({ success: true, message: 'Старые логи успешно удалены' });
    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
