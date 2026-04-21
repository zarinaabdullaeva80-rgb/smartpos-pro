import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendErrorAlert } from '../services/alerts.js';

const router = express.Router();

// Создаём таблицу если не существует
const initTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL DEFAULT 'frontend',
                severity VARCHAR(20) NOT NULL DEFAULT 'error',
                message TEXT NOT NULL,
                stack_trace TEXT,
                user_id INTEGER,
                organization_id INTEGER,
                url VARCHAR(500),
                component VARCHAR(200),
                metadata JSONB,
                ip_address VARCHAR(50),
                user_agent TEXT,
                is_resolved BOOLEAN DEFAULT FALSE,
                resolved_by INTEGER,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(type);
            CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
            CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_error_logs_is_resolved ON error_logs(is_resolved);
        `);
        console.log('✓ Таблица error_logs готова');
    } catch (error) {
        console.error('Ошибка создания таблицы error_logs:', error.message);
    }
};
// Lazy init — таблица создаётся при первом запросе, не при импорте
let tableReady = false;
router.use(async (req, res, next) => {
    if (!tableReady) {
        await initTable();
        tableReady = true;
    }
    next();
});

// GET /api/errors - Получить список ошибок с фильтрацией
router.get('/', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const {
            type,
            severity,
            is_resolved,
            start_date,
            end_date,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT e.*, u.username, u.full_name as user_name,
                   r.username as resolver_username
            FROM error_logs e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN users r ON e.resolved_by = r.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        // Multi-tenant: admins see only their organization's errors, superadmins see all
        if (req.user.role !== 'superadmin' && req.user?.organization_id) {
            query += ` AND e.license_id = $${paramIndex++}`;
            params.push(req.user?.organization_id);
        }

        if (type) {
            query += ` AND e.type = $${paramIndex++}`;
            params.push(type);
        }
        if (severity) {
            query += ` AND e.severity = $${paramIndex++}`;
            params.push(severity);
        }
        if (is_resolved !== undefined) {
            query += ` AND e.is_resolved = $${paramIndex++}`;
            params.push(is_resolved === 'true');
        }
        if (start_date) {
            query += ` AND e.created_at >= $${paramIndex++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND e.created_at <= $${paramIndex++}`;
            params.push(end_date);
        }
        if (search) {
            query += ` AND (e.message ILIKE $${paramIndex} OR e.component ILIKE $${paramIndex} OR e.url ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Подсчёт общего количества
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Добавляем сортировку и пагинацию
        query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.json({
            errors: result.rows,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Ошибка получения логов ошибок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /api/errors/stats - Статистика ошибок
router.get('/stats', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { days = 7 } = req.query;

        // Build license filter for non-superadmins
        const licenseFilter = req.user.role !== 'superadmin' && req.user?.organization_id
            ? `AND license_id = ${parseInt(req.user?.organization_id)}`
            : '';

        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_resolved = false) as unresolved,
                COUNT(*) FILTER (WHERE severity = 'critical') as critical,
                COUNT(*) FILTER (WHERE severity = 'error') as errors,
                COUNT(*) FILTER (WHERE severity = 'warning') as warnings,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
            FROM error_logs
            WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days' ${licenseFilter}
        `);

        // Группировка по типу
        const byType = await pool.query(`
            SELECT type, COUNT(*) as count
            FROM error_logs
            WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY type
            ORDER BY count DESC
        `);

        // Группировка по дням
        const byDay = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM error_logs
            WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(created_at)
            ORDER BY date
        `);

        // Топ компонентов с ошибками
        const topComponents = await pool.query(`
            SELECT component, COUNT(*) as count
            FROM error_logs
            WHERE component IS NOT NULL 
              AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY component
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            ...stats.rows[0],
            byType: byType.rows,
            byDay: byDay.rows,
            topComponents: topComponents.rows
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/errors - Записать ошибку (доступно без авторизации для фронтенда)
router.post('/', async (req, res) => {
    try {
        const {
            type = 'frontend',
            severity = 'error',
            message,
            stack_trace,
            url,
            component,
            metadata
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Получаем user_id и organization_id из токена если есть
        let user_id = null;
        let organization_id = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const jwt = await import('jsonwebtoken');
                const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
                user_id = decoded.userId;
                organization_id = decoded.organization_id;
            } catch { }
        }

        const ip_address = req.ip || req.connection.remoteAddress;
        const user_agent = req.headers['user-agent'];

        const result = await pool.query(`
            INSERT INTO error_logs (type, severity, message, stack_trace, user_id, license_id, url, component, metadata, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [type, severity, message, stack_trace, user_id, organization_id, url, component, metadata ? JSON.stringify(metadata) : null, ip_address, user_agent]);

        // Отправляем алерт для критических ошибок
        if (severity === 'critical' || severity === 'error') {
            sendErrorAlert(result.rows[0]).catch(err =>
                console.error('Failed to send error alert:', err.message)
            );
        }

        res.status(201).json({ success: true, error: result.rows[0] });
    } catch (error) {
        console.error('Ошибка записи ошибки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /api/errors/:id/resolve - Пометить как решённую
router.put('/:id/resolve', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        // Check ownership for non-superadmins
        if (req.user.role !== 'superadmin' && req.user?.organization_id) {
            const check = await pool.query('SELECT 1 FROM error_logs WHERE id = $1 AND license_id = $2', [id, req.user?.organization_id]);
            if (check.rows.length === 0) {
                return res.status(403).json({ error: 'Доступ запрещён' });
            }
        }

        const result = await pool.query(`
            UPDATE error_logs 
            SET is_resolved = true, resolved_by = $2, resolved_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ошибка не найдена' });
        }

        res.json({ success: true, error: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// PUT /api/errors/:id/unresolve - Снять пометку решённой
router.put('/:id/unresolve', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            UPDATE error_logs 
            SET is_resolved = false, resolved_by = NULL, resolved_at = NULL
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ошибка не найдена' });
        }

        res.json({ success: true, error: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// DELETE /api/errors/:id - Удалить ошибку
router.delete('/:id', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM error_logs WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ошибка не найдена' });
        }

        res.json({ success: true, message: 'Ошибка удалена' });
    } catch (error) {
        console.error('Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// DELETE /api/errors/resolved - Удалить все решённые ошибки
router.delete('/resolved/all', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM error_logs WHERE is_resolved = true RETURNING id');

        res.json({ success: true, deleted: result.rows.length });
    } catch (error) {
        console.error('Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
