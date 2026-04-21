import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// ============================================================================
// ИНВЕНТАРИЗАЦИЯ
// ============================================================================

/**
 * Получить список инвентаризаций
 */
router.get('/', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { status, warehouse_id, startDate, endDate } = req.query;

        let query = `
            SELECT i.*,
                w.name as warehouse_name,
                u.full_name as responsible_name,
                COUNT(ii.id) as items_count,
                COUNT(ii.id) FILTER (WHERE ii.actual_quantity IS NOT NULL) as counted_items
            FROM inventories i
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN users u ON i.responsible_user_id = u.id
            LEFT JOIN inventory_items ii ON i.id = ii.inventory_id
            WHERE 1=1 AND i.organization_id = $1
        `;

        const params = [req.user?.organization_id];
        let paramIndex = 2;

        if (status) {
            query += ` AND i.status = $${paramIndex++}`;
            params.push(status);
        }

        if (warehouse_id) {
            query += ` AND i.warehouse_id = $${paramIndex++}`;
            params.push(warehouse_id);
        }

        if (startDate) {
            query += ` AND i.document_date >= $${paramIndex++}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND i.document_date <= $${paramIndex++}`;
            params.push(endDate);
        }

        query += `
            GROUP BY i.id, w.name, u.full_name
            ORDER BY i.document_date DESC, i.id DESC
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching inventories:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Создать инвентаризацию
 */
router.post('/', authenticate, checkPermission('warehouse.inventory'), auditLog('inventory'), async (req, res) => {
    try {
        const { warehouse_id, responsible_user_id, notes } = req.body;

        const result = await pool.query(`
            INSERT INTO inventories (warehouse_id, responsible_user_id, notes, created_by, organization_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [warehouse_id, responsible_user_id, notes, req.user.userId, req.user?.organization_id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить детали инвентаризации
 */
router.get('/:id', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { id } = req.params;

        const inventory = await pool.query(`
            SELECT i.*,
                w.name as warehouse_name,
                u.full_name as responsible_name
            FROM inventories i
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            LEFT JOIN users u ON i.responsible_user_id = u.id
            WHERE i.id = $1 AND i.organization_id = $2
        `, [id, req.user?.organization_id]);

        if (inventory.rows.length === 0) {
            return res.status(404).json({ error: 'Инвентаризация не найдена' });
        }

        const items = await pool.query(`
            SELECT ii.*,
                p.name as product_name,
                p.code,
                p.barcode,
                p.price_sale as price
            FROM inventory_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.inventory_id = $1
            ORDER BY p.name
        `, [id]);

        res.json({
            ...inventory.rows[0],
            items: items.rows
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Начать инвентаризацию
 */
router.post('/:id/start', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('SELECT start_inventory($1)', [id]);

        const result = await pool.query('SELECT * FROM inventories WHERE id = $1', [id]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error starting inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Обновить позицию инвентаризации
 */
router.put('/:id/items/:itemId', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { actual_quantity, notes } = req.body;

        const result = await pool.query(`
            UPDATE inventory_items
            SET actual_quantity = $1, notes = $2
            WHERE id = $3
            RETURNING *
        `, [actual_quantity, notes, itemId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Завершить инвентаризацию
 */
router.post('/:id/complete', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { id } = req.params;

        const stats = await pool.query('SELECT * FROM complete_inventory($1)', [id]);

        res.json({
            success: true,
            stats: stats.rows[0]
        });
    } catch (error) {
        console.error('Error completing inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить корректировки
 */
router.get('/:id/adjustments', authenticate, checkPermission('warehouse.inventory'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT ia.*,
                p.name as product_name,
                p.code
            FROM inventory_adjustments ia
            JOIN products p ON ia.product_id = p.id
            WHERE ia.inventory_id = $1
            ORDER BY ia.created_at DESC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ПАРТИИ
// ============================================================================

/**
 * Получить список партий
 */
router.get('/batches', authenticate, checkPermission('warehouse.batches'), async (req, res) => {
    try {
        const { product_id, status, expiring_days } = req.query;

        if (expiring_days) {
            // Партии с истекающим сроком
            const result = await pool.query(
                'SELECT * FROM get_expiring_batches($1)',
                [expiring_days]
            );
            return res.json(result.rows);
        }

        let query = 'SELECT * FROM batch_inventory WHERE organization_id = $1';
        const params = [req.user?.organization_id];
        let paramIndex = 2;

        if (product_id) {
            query += ` AND id IN (SELECT id FROM product_batches WHERE product_id = $${paramIndex++})`;
            params.push(product_id);
        }

        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        query += ' ORDER BY expiry_date NULLS LAST, created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Создать партию
 */
router.post('/batches', authenticate, checkPermission('warehouse.batches'), auditLog('batch'), async (req, res) => {
    try {
        const {
            product_id, purchase_id, quantity, purchase_price,
            production_date, expiry_date, supplier_id, warehouse_id, notes
        } = req.body;

        const result = await pool.query(`
            INSERT INTO product_batches (
                product_id, purchase_id, quantity, remaining_quantity,
                purchase_price, production_date, expiry_date,
                supplier_id, warehouse_id, notes
            ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            product_id, purchase_id, quantity, purchase_price,
            production_date, expiry_date, supplier_id, warehouse_id, notes
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить партии товара
 */
router.get('/products/:productId/batches', authenticate, checkPermission('warehouse.batches'), async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await pool.query(`
            SELECT * FROM batch_inventory
            WHERE id IN (SELECT id FROM product_batches WHERE product_id = $1)
            ORDER BY expiry_date NULLS LAST, created_at
        `, [productId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching product batches:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ЯЧЕЙКИ СКЛАДА
// ============================================================================

/**
 * Получить ячейки склада
 */
router.get('/warehouses/:warehouseId/locations', authenticate, checkPermission('warehouse.locations'), async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { zone, occupied } = req.query;

        let query = 'SELECT * FROM warehouse_map WHERE warehouse_id = $1 AND organization_id = $2';
        const params = [warehouseId, req.user?.organization_id];
        let paramIndex = 3;

        if (zone) {
            query += ` AND zone = $${paramIndex++}`;
            params.push(zone);
        }

        if (occupied !== undefined) {
            query += ` AND is_occupied = $${paramIndex++}`;
            params.push(occupied === 'true');
        }

        query += ' ORDER BY zone, aisle::INT, rack::INT, shelf::INT, cell::INT';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Создать ячей ку
 */
router.post('/warehouses/:warehouseId/locations', authenticate, checkPermission('warehouse.locations'), async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { zone, aisle, rack, shelf, cell, capacity, barcode, notes } = req.body;

        const result = await pool.query(`
            INSERT INTO warehouse_locations (
                warehouse_id, zone, aisle, rack, shelf, cell,
                capacity, barcode, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [warehouseId, zone, aisle, rack, shelf, cell, capacity, barcode, notes]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating location:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Разместить товар в ячейку
 */
router.post('/locations/:locationId/assign', authenticate, checkPermission('warehouse.locations'), async (req, res) => {
    try {
        const { locationId } = req.params;
        const { product_id, quantity, batch_id } = req.body;

        await pool.query(
            'SELECT assign_product_to_location($1, $2, $3, $4)',
            [locationId, product_id, quantity, batch_id]
        );

        const result = await pool.query(
            'SELECT * FROM warehouse_locations WHERE id = $1',
            [locationId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error assigning product:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Переместить товар между ячейками
 */
router.post('/locations/move', authenticate, checkPermission('warehouse.locations'), async (req, res) => {
    try {
        const { from_location_id, to_location_id, quantity, reason } = req.body;

        await pool.query(
            'SELECT move_product_between_locations($1, $2, $3, $4, $5)',
            [from_location_id, to_location_id, quantity, req.user.userId, reason]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error moving product:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Найти свободные ячейки
 */
router.get('/warehouses/:warehouseId/locations/empty', authenticate, checkPermission('warehouse.locations'), async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { zone, min_capacity } = req.query;

        const result = await pool.query(
            'SELECT * FROM find_empty_locations($1, $2, $3)',
            [warehouseId, zone || null, min_capacity || null]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error finding empty locations:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
