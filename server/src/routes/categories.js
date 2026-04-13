import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper: get organization_id for multi-tenant filtering
 */
function getOrgId(req) {
    return req.user?.organization_id || req.organizationId || null;
}

// Получение всех категорий товаров с иерархией
router.get('/', authenticate, async (req, res) => {
    try {
        const { includeInactive } = req.query;

        let query = `
            SELECT 
                c.*,
                parent.name as parent_name,
                COUNT(p.id) as products_count
            FROM product_categories c
            LEFT JOIN product_categories parent ON c.parent_id = parent.id
            LEFT JOIN products p ON p.category_id = c.id
        `;

        const orgId = getOrgId(req);

        if (orgId) {
            query += ' WHERE c.organization_id = $1';
            if (!includeInactive) {
                query += ' AND c.is_active = true';
            }
        } else if (!includeInactive) {
            query += ' WHERE c.is_active = true';
        }

        query += ' GROUP BY c.id, parent.id ORDER BY c.sort_order, c.name';

        const result = await pool.query(query, orgId ? [orgId] : []);
        res.json({ categories: result.rows });
    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Создание категории
router.post('/', authenticate, authorize('Администратор', 'Менеджер'), async (req, res) => {
    try {
        const { name, description, parent_id, is_active = true, sort_order = 0 } = req.body;

        // Автогенерация кода если не предоставлен
        const code = req.body.code || `CAT-${Date.now().toString(36).toUpperCase()}`;

        const orgId = getOrgId(req);

        const result = await pool.query(
            `INSERT INTO product_categories (name, description, parent_id, is_active, sort_order, code, organization_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, description, parent_id || null, is_active, sort_order, code, orgId || 1]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка создания категории:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Обновление категории
router.put('/:id', authenticate, authorize('Администратор', 'Менеджер'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, parent_id, is_active, sort_order } = req.body;

        const orgId = getOrgId(req);
        let query = `UPDATE product_categories 
             SET name = $1, description = $2, parent_id = $3, is_active = $4, sort_order = $5, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $6`;
        const params = [name, description, parent_id || null, is_active, sort_order, id];

        if (orgId) {
            query += ' AND organization_id = $7';
            params.push(orgId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Категория не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления категории:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Удаление категории
router.delete('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = getOrgId(req);
        let query = 'DELETE FROM product_categories WHERE id = $1';
        const params = [id];
        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }
        await pool.query(query, params);
        res.json({ message: 'Категория удалена' });
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
