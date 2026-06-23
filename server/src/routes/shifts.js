import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Открыть смену
router.post('/open', authenticate, async (req, res) => {
    try {
        const { opening_cash = 0 } = req.body;
        const orgId = req.user?.organization_id || null;

        // Проверить есть ли открытая смена
        const existingShift = await pool.query(
            'SELECT * FROM shifts WHERE user_id = $1 AND status = $2',
            [req.user.id, 'open']
        );

        if (existingShift.rows.length > 0) {
            return res.status(400).json({ error: 'У вас уже есть открытая смена' });
        }

        // Генерация номера смены
        const shiftNumber = `SH-${Date.now()}`;

        // Проверяем есть ли колонка organization_id в таблице shifts
        let result;
        try {
            result = await pool.query(
                `INSERT INTO shifts (shift_number, user_id, initial_cash, status, started_at, organization_id) 
                 VALUES ($1, $2, $3, 'open', CURRENT_TIMESTAMP, $4) RETURNING *`,
                [shiftNumber, req.user.id, opening_cash, orgId]
            );
        } catch (colErr) {
            // Если колонки organization_id нет — открываем без неё
            result = await pool.query(
                `INSERT INTO shifts (shift_number, user_id, initial_cash, status, started_at) 
                 VALUES ($1, $2, $3, 'open', CURRENT_TIMESTAMP) RETURNING *`,
                [shiftNumber, req.user.id, opening_cash]
            );
        }

        // Преобразуем имена полей для совместимости с клиентом
        const shift = {
            ...result.rows[0],
            opened_at: result.rows[0].started_at,
            opening_cash: result.rows[0].initial_cash
        };

        res.status(201).json({ shift });
    } catch (error) {
        console.error('Ошибка открытия смены:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Закрыть смену
router.post('/:id/close', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { closing_cash = 0, notes } = req.body;

        // Получить смену
        const shift = await pool.query(
            'SELECT * FROM shifts WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (shift.rows.length === 0) {
            return res.status(404).json({ error: 'Смена не найдена' });
        }

        if (shift.rows[0].status === 'closed') {
            return res.status(400).json({ error: 'Смена уже закрыта' });
        }

        // Получить статистику продаж за смену (сначала по shift_id)
        let salesStats = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total
             FROM sales 
             WHERE shift_id = $1 
             AND status != 'draft'`,
            [id]
        );

        if (parseInt(salesStats.rows[0].count) === 0) {
            salesStats = await pool.query(
                `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total
                 FROM sales 
                 WHERE user_id = $1 
                 AND created_at >= $2 
                 AND status != 'draft'`,
                [req.user.id, shift.rows[0].started_at]
            );
        }

        const result = await pool.query(
            `UPDATE shifts 
             SET ended_at = CURRENT_TIMESTAMP,
                 final_cash = $1,
                 total_amount = $2,
                 sales_count = $3,
                 status = 'closed'
             WHERE id = $4
             RETURNING *`,
            [closing_cash, salesStats.rows[0].total, salesStats.rows[0].count, id]
        );

        // Преобразуем имена полей для совместимости
        const shiftResult = {
            ...result.rows[0],
            opened_at: result.rows[0].started_at,
            closed_at: result.rows[0].ended_at,
            opening_cash: result.rows[0].initial_cash,
            closing_cash: result.rows[0].final_cash,
            total_sales: result.rows[0].total_amount
        };

        res.json({ shift: shiftResult });
    } catch (error) {
        console.error('Ошибка закрытия смены:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получить текущую смену
router.get('/current', authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM shifts WHERE user_id = $1 AND status = $2 ORDER BY started_at DESC LIMIT 1',
            [req.user.id, 'open']
        );

        if (result.rows.length === 0) {
            return res.json({ shift: null });
        }

        const shiftRow = result.rows[0];

        // Получаем текущие продажи для этой открытой смены
        let salesStats = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total
             FROM sales 
             WHERE shift_id = $1 
             AND status != 'draft'`,
            [shiftRow.id]
        );

        if (parseInt(salesStats.rows[0].count) === 0) {
            salesStats = await pool.query(
                `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total
                 FROM sales 
                 WHERE user_id = $1 
                 AND created_at >= $2 
                 AND status != 'draft'`,
                [req.user.id, shiftRow.started_at]
            );
        }

        const shift = {
            ...shiftRow,
            opened_at: shiftRow.started_at,
            opening_cash: shiftRow.initial_cash,
            total_sales: parseFloat(salesStats.rows[0].total) || 0,
            sales_count: parseInt(salesStats.rows[0].count) || 0
        };

        res.json({ shift });
    } catch (error) {
        console.error('Ошибка получения текущей смены:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// История смен
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, start_date, end_date } = req.query;
        const orgId = req.user?.organization_id || 1;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'Администратор';

        let query = `
            SELECT s.*, u.username, u.full_name AS user_name,
                   (
                       SELECT COALESCE(SUM(s2.final_amount), 0)
                       FROM sales s2
                       WHERE (s2.shift_id = s.id OR (s2.shift_id IS NULL AND s2.user_id = s.user_id AND s2.created_at >= s.started_at AND (s.ended_at IS NULL OR s2.created_at <= s.ended_at)))
                         AND s2.status != 'draft'
                   ) as live_total_amount,
                   (
                       SELECT COALESCE(COUNT(*), 0)::integer
                       FROM sales s2
                       WHERE (s2.shift_id = s.id OR (s2.shift_id IS NULL AND s2.user_id = s.user_id AND s2.created_at >= s.started_at AND (s.ended_at IS NULL OR s2.created_at <= s.ended_at)))
                         AND s2.status != 'draft'
                   ) as live_sales_count
            FROM shifts s 
            LEFT JOIN users u ON s.user_id = u.id 
            WHERE s.organization_id = $1
        `;

        const params = [orgId];
        let paramCount = 2;

        if (!isAdmin) {
            query += ` AND s.user_id = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }

        if (status) {
            query += ` AND s.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (start_date) {
            query += ` AND s.started_at >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }

        if (end_date) {
            query += ` AND s.started_at <= $${paramCount}`;
            params.push(end_date + ' 23:59:59');
            paramCount++;
        }

        query += ` ORDER BY s.started_at DESC LIMIT 50`;

        const result = await pool.query(query, params);

        // Transform field names for client compatibility
        const shifts = result.rows.map(shift => ({
            ...shift,
            opened_at: shift.started_at,
            closed_at: shift.ended_at,
            opening_cash: shift.initial_cash,
            closing_cash: shift.final_cash,
            total_sales: parseFloat(shift.live_total_amount) || 0,
            sales_count: parseInt(shift.live_sales_count) || 0
        }));

        res.json({ shifts });
    } catch (error) {
        console.error('Ошибка получения истории смен:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Статистика смены
router.get('/:id/stats', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Получить смену
        const shiftResult = await pool.query(
            'SELECT * FROM shifts WHERE id = $1',
            [id]
        );

        if (shiftResult.rows.length === 0) {
            return res.status(404).json({ error: 'Смена не найдена' });
        }

        const shift = shiftResult.rows[0];

        // Статистика продаж за смену
        let salesStats = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(final_amount), 0) as total,
                COALESCE(AVG(final_amount), 0) as average
            FROM sales
            WHERE shift_id = $1 
            AND status != 'draft'
        `, [id]);

        if (parseInt(salesStats.rows[0].count) === 0) {
            salesStats = await pool.query(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(final_amount), 0) as total,
                    COALESCE(AVG(final_amount), 0) as average
                FROM sales
                WHERE user_id = $1 
                AND created_at >= $2
                AND created_at < COALESCE($3, NOW())
                AND status != 'draft'
            `, [shift.user_id, shift.started_at, shift.ended_at]);
        }

        // Топ 5 товаров
        let topProducts = await pool.query(`
            SELECT p.name, SUM(si.quantity) as count
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.shift_id = $1 
            GROUP BY p.name
            ORDER BY count DESC
            LIMIT 5
        `, [id]);

        if (topProducts.rows.length === 0) {
            topProducts = await pool.query(`
                SELECT p.name, SUM(si.quantity) as count
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                JOIN sales s ON si.sale_id = s.id
                WHERE s.user_id = $1 
                AND s.created_at >= $2
                AND s.created_at < COALESCE($3, NOW())
                GROUP BY p.name
                ORDER BY count DESC
                LIMIT 5
            `, [shift.user_id, shift.started_at, shift.ended_at]);
        }

        // Продажи по часам (последние 12 часов)
        let hourlyData = await pool.query(`
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(*) as sales,
                COALESCE(SUM(final_amount), 0) as amount
            FROM sales
            WHERE shift_id = $1 
            AND status != 'draft'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
        `, [id]);

        if (hourlyData.rows.length === 0) {
            hourlyData = await pool.query(`
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as sales,
                    COALESCE(SUM(final_amount), 0) as amount
                FROM sales
                WHERE user_id = $1 
                AND created_at >= $2
                AND created_at < COALESCE($3, NOW())
                AND status != 'draft'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `, [shift.user_id, shift.started_at, shift.ended_at]);
        }

        // Статистика возвратов за смену
        let returnsStats = { rows: [{ count: 0, total: 0 }] };
        try {
            returnsStats = await pool.query(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total_amount), 0) as total
                FROM returns
                WHERE user_id = $1 
                AND created_at >= $2
                AND created_at < COALESCE($3, NOW())
            `, [shift.user_id, shift.started_at, shift.ended_at]);
        } catch (e) {
            // returns table may not exist yet — use zeros
        }

        const totalSales = parseFloat(salesStats.rows[0].total) || 0;

        res.json({
            stats: {
                totalSales: totalSales,
                salesCount: parseInt(salesStats.rows[0].count) || 0,
                averageCheck: parseFloat(salesStats.rows[0].average) || 0,
                cashSales: totalSales, // All sales considered as cash for now
                cardSales: 0,
                totalReturns: 0,
                returnsCount: 0,
                netSales: totalSales,
                topProducts: topProducts.rows,
                hourlyData: hourlyData.rows
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики смены:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
