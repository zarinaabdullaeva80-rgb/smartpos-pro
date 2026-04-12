/**
 * Contracts Routes - API для управления договорами
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

/**
 * Инициализация таблицы договоров
 */
const ensureTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS contracts (
            id SERIAL PRIMARY KEY,
            contract_number VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            counterparty_id INTEGER REFERENCES counterparties(id) ON DELETE SET NULL,
            counterparty_name VARCHAR(255),
            type VARCHAR(50) DEFAULT 'supply',
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            amount DECIMAL(18, 2) DEFAULT 0,
            currency VARCHAR(10) DEFAULT 'UZS',
            status VARCHAR(20) DEFAULT 'draft',
            auto_renew BOOLEAN DEFAULT false,
            terms TEXT,
            notes TEXT,
            file_path VARCHAR(500),
            template_id INTEGER,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Индексы
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contracts_counterparty ON contracts(counterparty_id)`);
};

/**
 * GET /api/contracts - Список договоров
 */
router.get('/', authenticate, async (req, res) => {
    try {
        await ensureTable();

        const {
            status,
            type,
            counterparty_id,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT c.*, 
                   cp.name as counterparty_full_name,
                   u.username as created_by_name
            FROM contracts c
            LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
            LEFT JOIN users u ON c.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (status && status !== 'all') {
            query += ` AND c.status = $${paramIndex++}`;
            params.push(status);
        }
        if (type && type !== 'all') {
            query += ` AND c.type = $${paramIndex++}`;
            params.push(type);
        }
        if (counterparty_id) {
            query += ` AND c.counterparty_id = $${paramIndex++}`;
            params.push(counterparty_id);
        }

        query += ` ORDER BY c.end_date ASC, c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Статистика
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'active' AND end_date <= CURRENT_DATE + INTERVAL '30 days') as expiring,
                COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'active' AND end_date < CURRENT_DATE)) as expired,
                COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0) as total_amount,
                COUNT(*) as total
            FROM contracts
        `);

        res.json({
            contracts: result.rows,
            stats: statsResult.rows[0]
        });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/contracts/:id - Детали договора
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT c.*, 
                   cp.name as counterparty_full_name, cp.inn, cp.address as counterparty_address,
                   u.username as created_by_name
            FROM contracts c
            LEFT JOIN counterparties cp ON c.counterparty_id = cp.id
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching contract:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/contracts - Создать договор
 */
router.post('/', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        await ensureTable();

        const {
            contract_number,
            name,
            counterparty_id,
            counterparty_name,
            type,
            start_date,
            end_date,
            amount,
            currency,
            auto_renew,
            terms,
            notes,
            template_id
        } = req.body;

        if (!name || !start_date || !end_date) {
            return res.status(400).json({ error: 'Название, дата начала и окончания обязательны' });
        }

        // Генерация номера договора если не указан
        const contractNum = contract_number || `ДГ-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

        const result = await pool.query(`
            INSERT INTO contracts (
                contract_number, name, counterparty_id, counterparty_name,
                type, start_date, end_date, amount, currency,
                auto_renew, terms, notes, template_id, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', $14)
            RETURNING *
        `, [
            contractNum,
            name,
            counterparty_id || null,
            counterparty_name || null,
            type || 'supply',
            start_date,
            end_date,
            amount || 0,
            currency || 'UZS',
            auto_renew || false,
            terms || null,
            notes || null,
            template_id || null,
            req.user?.id || null
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/contracts/:id - Обновить договор
 */
router.put('/:id', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const setClause = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'name', 'counterparty_id', 'counterparty_name', 'type',
            'start_date', 'end_date', 'amount', 'currency', 'status',
            'auto_renew', 'terms', 'notes', 'file_path', 'template_id'
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
        values.push(id);

        const result = await pool.query(
            `UPDATE contracts SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating contract:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/contracts/:id/renew - Продлить договор
 */
router.post('/:id/renew', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_end_date, new_amount } = req.body;

        if (!new_end_date) {
            return res.status(400).json({ error: 'Укажите новую дату окончания' });
        }

        const result = await pool.query(`
            UPDATE contracts 
            SET end_date = $1, 
                amount = COALESCE($2, amount),
                status = 'active',
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [new_end_date, new_amount, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        res.json({ success: true, contract: result.rows[0] });
    } catch (error) {
        console.error('Error renewing contract:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/contracts/:id/terminate - Расторгнуть договор
 */
router.post('/:id/terminate', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await pool.query(`
            UPDATE contracts 
            SET status = 'terminated', 
                notes = COALESCE(notes || E'\n', '') || 'Причина расторжения: ' || COALESCE($1, 'Не указана'),
                end_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [reason, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        res.json({ success: true, contract: result.rows[0] });
    } catch (error) {
        console.error('Error terminating contract:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/contracts/templates/list - Список шаблонов договоров
 */
router.get('/templates/list', authenticate, async (req, res) => {
    try {
        const templates = [
            { id: 1, name: 'Договор поставки', type: 'supply', description: 'Стандартный договор поставки товаров' },
            { id: 2, name: 'Договор аренды', type: 'rent', description: 'Договор аренды помещений/оборудования' },
            { id: 3, name: 'Договор оказания услуг', type: 'service', description: 'Договор на оказание услуг' },
            { id: 4, name: 'Договор купли-продажи', type: 'sale', description: 'Договор купли-продажи имущества' }
        ];
        res.json(templates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/contracts/:id - Удалить договор
 */
router.delete('/:id', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM contracts WHERE id = $1', [id]);

        res.json({ success: true, message: 'Договор удалён' });
    } catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
