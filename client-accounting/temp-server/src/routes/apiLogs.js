import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Получить логи API
router.get('/', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const {
            method,
            path: pathFilter,
            status,
            user_id,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        let query = `
            SELECT l.*, u.username, u.full_name 
            FROM api_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (method) {
            query += ` AND l.method = $${paramIndex++}`;
            params.push(method);
        }
        if (pathFilter) {
            query += ` AND l.path ILIKE $${paramIndex++}`;
            params.push(`%${pathFilter}%`);
        }
        if (status) {
            if (status === 'error') {
                query += ` AND l.status_code >= 400`;
            } else if (status === 'success') {
                query += ` AND l.status_code < 400`;
            } else {
                query += ` AND l.status_code = $${paramIndex++}`;
                params.push(parseInt(status));
            }
        }
        if (user_id) {
            query += ` AND l.user_id = $${paramIndex++}`;
            params.push(parseInt(user_id));
        }
        if (start_date) {
            query += ` AND l.created_at >= $${paramIndex++}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND l.created_at <= $${paramIndex++}`;
            params.push(end_date);
        }

        // Подсчёт
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Пагинация
        query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        res.json({
            logs: result.rows,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('API logs error:', error);
        res.status(500).json({ error: 'Failed to get API logs' });
    }
});

// Статистика API
router.get('/stats', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { hours = 24 } = req.query;

        const [totals, byPath, byStatus, byHour] = await Promise.all([
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status_code >= 400) as errors,
                    AVG(response_time)::integer as avg_response_time,
                    MAX(response_time) as max_response_time
                FROM api_logs
                WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
            `),
            pool.query(`
                SELECT path, method, COUNT(*) as count, 
                       AVG(response_time)::integer as avg_time,
                       COUNT(*) FILTER (WHERE status_code >= 400) as errors
                FROM api_logs
                WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
                GROUP BY path, method
                ORDER BY count DESC
                LIMIT 20
            `),
            pool.query(`
                SELECT status_code, COUNT(*) as count
                FROM api_logs
                WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
                GROUP BY status_code
                ORDER BY count DESC
            `),
            pool.query(`
                SELECT DATE_TRUNC('hour', created_at) as hour, 
                       COUNT(*) as requests,
                       COUNT(*) FILTER (WHERE status_code >= 400) as errors
                FROM api_logs
                WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
                GROUP BY DATE_TRUNC('hour', created_at)
                ORDER BY hour
            `)
        ]);

        res.json({
            ...totals.rows[0],
            byPath: byPath.rows,
            byStatus: byStatus.rows,
            byHour: byHour.rows
        });
    } catch (error) {
        console.error('API stats error:', error);
        res.status(500).json({ error: 'Failed to get API stats' });
    }
});

// Очистить старые логи
router.delete('/cleanup', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const result = await pool.query(`
            DELETE FROM api_logs 
            WHERE created_at < NOW() - INTERVAL '${parseInt(days)} days'
            RETURNING id
        `);

        res.json({ success: true, deleted: result.rowCount });
    } catch (error) {
        console.error('API logs cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup' });
    }
});

export default router;
