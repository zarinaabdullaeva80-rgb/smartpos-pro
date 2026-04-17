import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/inventory
 * Получить все остатки товаров (агрегация по inventory_movements)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const { search, warehouse_id } = req.query;

        let query = `
            SELECT 
                p.id, p.code, p.name, p.barcode, p.unit,
                p.price_purchase, p.price_sale,
                pc.name AS category_name,
                COALESCE(SUM(im.quantity), 0) AS quantity,
                p.min_stock,
                p.updated_at
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN inventory_movements im ON p.id = im.product_id
            WHERE p.is_active = true AND p.organization_id = $1
        `;
        const params = [orgId];
        let paramCount = 2;

        if (warehouse_id) {
            query += ` AND im.warehouse_id = $${paramCount}`;
            params.push(warehouse_id);
            paramCount++;
        }

        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p.code ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ` GROUP BY p.id, p.code, p.name, p.barcode, p.unit, p.price_purchase, p.price_sale,
                   pc.name, p.min_stock, p.updated_at
                   ORDER BY p.name`;

        const result = await pool.query(query, params);
        res.json({ inventory: result.rows, total: result.rows.length });
    } catch (error) {
        console.error('Ошибка получения остатков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * POST /api/inventory
 * Создание записи движения товара (приход/списание/корректировка)
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { product_id, quantity, document_type, warehouse_id, notes } = req.body;
        const orgId = req.user.organization_id;

        if (!product_id || quantity === undefined) {
            return res.status(400).json({ error: 'product_id и quantity обязательны' });
        }

        // Verify product ownership
        const productCheck = await pool.query('SELECT 1 FROM products WHERE id = $1 AND organization_id = $2', [product_id, orgId]);
        if (productCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        // Определить склад
        let whId = warehouse_id;
        if (!whId) {
            const wh = await pool.query(
                'SELECT id FROM warehouses WHERE is_active = true AND organization_id = $1 LIMIT 1',
                [orgId]
            );
            whId = wh.rows[0]?.id;
            if (!whId) return res.status(400).json({ error: 'Склад не найден' });
        } else {
            const whCheck = await pool.query('SELECT 1 FROM warehouses WHERE id = $1 AND organization_id = $2', [whId, orgId]);
            if (whCheck.rows.length === 0) return res.status(403).json({ error: 'Склад не принадлежит организации' });
        }

        const result = await pool.query(
            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, organization_id, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING *`,
            [product_id, whId, document_type || 'adjustment', quantity, req.user.id, orgId, notes || null]
        );

        // Получить обновлённый остаток
        const stock = await pool.query(
            'SELECT COALESCE(SUM(quantity), 0) AS total_stock FROM inventory_movements WHERE product_id = $1 AND organization_id = $2',
            [product_id, orgId]
        );

        res.status(201).json({
            movement: result.rows[0],
            total_stock: parseFloat(stock.rows[0]?.total_stock || 0)
        });
    } catch (error) {
        console.error('Ошибка создания движения товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * POST /api/inventory/save
 * Сохранение результатов инвентаризации (подсчёта)
 */
router.post('/save', authenticate, async (req, res) => {
    try {
        const { items, warehouseId: customWarehouseId } = req.body;
        const orgId = req.user.organization_id;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'items array is required' });
        }

        const results = [];
        const errors = [];

        // Определить склад
        let warehouseId = customWarehouseId;
        if (!warehouseId) {
            const wh = await pool.query(
                'SELECT id FROM warehouses WHERE is_active = true AND organization_id = $1 LIMIT 1',
                [orgId]
            );
            if (wh.rows.length > 0) warehouseId = wh.rows[0].id;
        } else {
            const whCheck = await pool.query('SELECT 1 FROM warehouses WHERE id = $1 AND organization_id = $2', [warehouseId, orgId]);
            if (whCheck.rows.length === 0) return res.status(403).json({ error: 'Склад не принадлежит организации' });
        }
        
        if (!warehouseId) return res.status(400).json({ error: 'Склад не найден' });

        for (const item of items) {
            try {
                // Verify product ownership
                const pCheck = await pool.query('SELECT 1 FROM products WHERE id = $1 AND organization_id = $2', [item.product_id, orgId]);
                if (pCheck.rows.length === 0) throw new Error('Доступ к товару запрещен');

                const diff = item.actual_quantity - item.expected_quantity;
                
                if (diff !== 0) {
                    // Создать корректировку в inventory_movements
                    await pool.query(`
                        INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, organization_id, notes, created_at)
                        VALUES ($1, $2, 'inventory', $3, $4, $5, $6, NOW())
                    `, [
                        item.product_id,
                        warehouseId,
                        diff,
                        req.user.id,
                        orgId,
                        `Инвентаризация: ожидалось ${item.expected_quantity}, факт ${item.actual_quantity}`
                    ]);

                    // Обновить stock_balances
                    await pool.query(`
                        INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
                        VALUES ($1, $2, $3, NOW())
                        ON CONFLICT (product_id, warehouse_id)
                        DO UPDATE SET 
                            quantity = stock_balances.quantity + $4,
                            updated_at = NOW()
                    `, [item.product_id, warehouseId, item.actual_quantity, diff]);
                }

                results.push({
                    product_id: item.product_id,
                    expected: item.expected_quantity,
                    actual: item.actual_quantity,
                    diff,
                    adjusted: diff !== 0
                });
            } catch (err) {
                errors.push({ product_id: item.product_id, error: err.message });
            }
        }

        res.json({
            success: true,
            total_processed: results.length,
            adjustments_made: results.filter(r => r.adjusted).length,
            results,
            errors_count: errors.length,
            errors,
            saved_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ошибка сохранения инвентаризации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * GET /api/inventory/movements/:productId
 * История движений конкретного товара
 */
router.get('/movements/:productId', authenticate, async (req, res) => {
    try {
        const { productId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const orgId = req.user.organization_id;

        // Verify product ownership
        const productCheck = await pool.query('SELECT 1 FROM products WHERE id = $1 AND organization_id = $2', [productId, orgId]);
        if (productCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const result = await pool.query(`
            SELECT 
                im.id, im.product_id, im.warehouse_id, im.document_type,
                im.quantity, im.notes, im.created_at,
                w.name AS warehouse_name,
                u.username AS user_name
            FROM inventory_movements im
            LEFT JOIN warehouses w ON im.warehouse_id = w.id
            LEFT JOIN users u ON im.user_id = u.id
            WHERE im.product_id = $1 AND im.organization_id = $2
            ORDER BY im.created_at DESC
            LIMIT $3 OFFSET $4
        `, [productId, orgId, parseInt(limit), parseInt(offset)]);

        res.json({ movements: result.rows, total: result.rows.length });
    } catch (error) {
        console.error('Ошибка получения движений товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * GET /api/inventory/:id
 * Остатки конкретного товара (по складам)
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;

        // Информация о товаре
        const productResult = await pool.query(
            'SELECT p.*, pc.name AS category_name FROM products p LEFT JOIN product_categories pc ON p.category_id = pc.id WHERE p.id = $1 AND p.organization_id = $2',
            [id, orgId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Остатки по складам
        const stockResult = await pool.query(`
            SELECT 
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                COALESCE(SUM(im.quantity), 0) AS quantity
            FROM warehouses w
            LEFT JOIN inventory_movements im ON w.id = im.warehouse_id AND im.product_id = $1
            WHERE w.is_active = true AND w.organization_id = $2
            GROUP BY w.id, w.name 
            ORDER BY w.name
        `, [id, orgId]);

        // Общий остаток
        const totalStock = await pool.query(
            'SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE product_id = $1 AND organization_id = $2',
            [id, orgId]
        );

        res.json({
            product: productResult.rows[0],
            stock_by_warehouse: stockResult.rows,
            total_stock: parseFloat(totalStock.rows[0]?.total || 0)
        });
    } catch (error) {
        console.error('Ошибка получения остатков товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
