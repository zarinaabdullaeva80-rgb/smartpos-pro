/**
 * Deliveries Routes - API для управления доставками
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

/**
 * Инициализация таблицы доставок
 */
const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
            order_number VARCHAR(50),
            customer_name VARCHAR(255) NOT NULL,
            customer_phone VARCHAR(50),
            address TEXT NOT NULL,
            address_lat DECIMAL(10, 8),
            address_lng DECIMAL(11, 8),
            items_count INTEGER DEFAULT 1,
            total_amount DECIMAL(15, 2) DEFAULT 0,
            delivery_cost DECIMAL(15, 2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            courier_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
            courier_name VARCHAR(255),
            scheduled_date DATE,
            scheduled_time_from TIME,
            scheduled_time_to TIME,
            estimated_delivery VARCHAR(50),
            delivered_at TIMESTAMP,
            cancel_reason TEXT,
            notes TEXT,
            zone_id INTEGER,
            priority INTEGER DEFAULT 0,
            organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Индексы
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(scheduled_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_deliveries_org ON deliveries(organization_id)`);
};

/**
 * GET /api/deliveries - Список доставок
 */
router.get('/', authenticate, async (req, res) => {
    try {
        await ensureTable();

        const {
            status,
            date_from,
            date_to,
            courier_id,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT d.*, 
                   e.name as courier_full_name,
                   u.username as created_by_name
            FROM deliveries d
            LEFT JOIN employees e ON d.courier_id = e.id
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.organization_id = $1
        `;
        const params = [req.user.organization_id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND d.status = $${paramIndex++}`;
            params.push(status);
        }
        if (date_from) {
            query += ` AND d.scheduled_date >= $${paramIndex++}`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND d.scheduled_date <= $${paramIndex++}`;
            params.push(date_to);
        }
        if (courier_id) {
            query += ` AND d.courier_id = $${paramIndex++}`;
            params.push(courier_id);
        }

        query += ` ORDER BY d.priority DESC, d.scheduled_date, d.scheduled_time_from LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Статистика
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
                COUNT(*) FILTER (WHERE status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE) as delivered_today,
                COUNT(*) as total
            FROM deliveries
            WHERE organization_id = $1 AND DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days'
        `, [req.user.organization_id]);

        res.json({
            deliveries: result.rows,
            stats: statsResult.rows[0]
        });
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/deliveries/:id - Детали доставки
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT d.*, 
                   e.name as courier_full_name, e.phone as courier_phone,
                   u.username as created_by_name
            FROM deliveries d
            LEFT JOIN employees e ON d.courier_id = e.id
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.id = $1 AND d.organization_id = $2
        `, [id, req.user.organization_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Доставка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/deliveries - Создать доставку
 */
router.post('/', authenticate, checkPermission('sales.write'), auditLog, async (req, res) => {
    try {
        await ensureTable();

        const {
            order_id,
            order_number,
            customer_name,
            customer_phone,
            address,
            address_lat,
            address_lng,
            items_count,
            total_amount,
            delivery_cost,
            courier_id,
            courier_name,
            scheduled_date,
            scheduled_time_from,
            scheduled_time_to,
            notes,
            zone_id,
            priority
        } = req.body;

        if (!customer_name || !address) {
            return res.status(400).json({ error: 'Имя клиента и адрес обязательны' });
        }

        const estimated = scheduled_time_from && scheduled_time_to
            ? `${scheduled_time_from.slice(0, 5)} - ${scheduled_time_to.slice(0, 5)}`
            : null;

        const result = await pool.query(`
            INSERT INTO deliveries (
                order_id, order_number, customer_name, customer_phone, 
                address, address_lat, address_lng, items_count, total_amount, 
                delivery_cost, courier_id, courier_name, scheduled_date,
                scheduled_time_from, scheduled_time_to, estimated_delivery,
                notes, zone_id, priority, organization_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *
        `, [
            order_id || null,
            order_number || `DEL-${Date.now()}`,
            customer_name,
            customer_phone,
            address,
            address_lat || null,
            address_lng || null,
            items_count || 1,
            total_amount || 0,
            delivery_cost || 0,
            courier_id || null,
            courier_name || null,
            scheduled_date || new Date().toISOString().split('T')[0],
            scheduled_time_from || null,
            scheduled_time_to || null,
            estimated,
            notes || null,
            zone_id || null,
            priority || 0,
            req.user.organization_id,
            req.user?.id || null
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/deliveries/:id - Обновить доставку
 */
router.put('/:id', authenticate, checkPermission('sales.write'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'customer_name', 'customer_phone', 'address', 'address_lat', 'address_lng',
            'items_count', 'total_amount', 'delivery_cost', 'courier_id', 'courier_name',
            'scheduled_date', 'scheduled_time_from', 'scheduled_time_to', 'estimated_delivery',
            'notes', 'zone_id', 'priority', 'status'
        ];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClause.push(`${key} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (setClause.length === 0) {
            return res.status(400).json({ error: 'Нет полей для обновления' });
        }

        setClause.push('updated_at = NOW()');
        values.push(id, req.user.organization_id);

        const result = await pool.query(
            `UPDATE deliveries SET ${setClause.join(', ')} WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Доставка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/deliveries/:id/assign - Назначить курьера
 */
router.post('/:id/assign', authenticate, checkPermission('sales.write'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const { courier_id, courier_name, estimated } = req.body;

        const result = await pool.query(`
            UPDATE deliveries 
            SET courier_id = $1, courier_name = $2, estimated_delivery = $3, 
                status = 'in_transit', updated_at = NOW()
            WHERE id = $4 AND organization_id = $5
            RETURNING *
        `, [courier_id || null, courier_name, estimated || null, id, req.user.organization_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Доставка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error assigning courier:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/deliveries/:id/complete - Завершить доставку
 */
router.post('/:id/complete', authenticate, checkPermission('sales.write'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const { signature, notes } = req.body;

        const result = await pool.query(`
            UPDATE deliveries 
            SET status = 'delivered', delivered_at = NOW(), 
                notes = COALESCE(notes || E'\n', '') || COALESCE($1, ''),
                updated_at = NOW()
            WHERE id = $2 AND organization_id = $3
            RETURNING *
        `, [notes, id, req.user.organization_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Доставка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error completing delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/deliveries/:id/cancel - Отменить доставку
 */
router.post('/:id/cancel', authenticate, checkPermission('sales.write'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await pool.query(`
            UPDATE deliveries 
            SET status = 'cancelled', cancel_reason = $1, updated_at = NOW()
            WHERE id = $2 AND organization_id = $3
            RETURNING *
        `, [reason || 'Не указана', id, req.user.organization_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Доставка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error cancelling delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/deliveries/couriers/list - Список курьеров
 */
router.get('/couriers/list', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, phone, position
            FROM employees
            WHERE is_active = true AND organization_id = $1 AND position ILIKE '%курьер%'
            ORDER BY name
        `, [req.user.organization_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching couriers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/deliveries/:id - Удалить доставку
 */
router.delete('/:id', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        await pool.query('DELETE FROM deliveries WHERE id = $1 AND organization_id = $2', [id, organization_id]);

        res.json({ success: true, message: 'Доставка удалена' });
    } catch (error) {
        console.error('Error deleting delivery:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
