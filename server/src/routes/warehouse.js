import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

// ============================================================================
// ОПРИХОДОВАНИЕ (Receipt)
// ============================================================================

/**
 * POST /api/warehouse/receipt
 * Создать документ оприходования товаров
 */
router.post('/receipt', authorize('warehouse.write'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { warehouseId, items, supplierId, notes } = req.body;

        if (!warehouseId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Warehouse ID and items are required' });
        }

        // Генерация номера документа
        const docNumberResult = await client.query(
            "SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('warehouse_doc_number_seq')::TEXT, 4, '0') as doc_number"
        );
        const documentNumber = docNumberResult.rows[0].doc_number;

        // Подсчёт общей суммы
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

        // Создание документа
        const docResult = await client.query(
            `INSERT INTO warehouse_documents (
                document_number, document_type, document_date, warehouse_id, supplier_id,
                status, total_amount, created_by, notes
            ) VALUES ($1, 'receipt', CURRENT_DATE, $2, $3, 'draft', $4, $5, $6)
            RETURNING *`,
            [documentNumber, warehouseId, supplierId, totalAmount, req.user.id, notes]
        );

        const document = docResult.rows[0];

        // Добавление позиций
        for (const item of items) {
            const totalCost = item.quantity * item.costPrice;

            await client.query(
                `INSERT INTO warehouse_document_items (
                    document_id, product_id, quantity, cost_price, total_cost, batch_number, expiry_date, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [document.id, item.productId, item.quantity, item.costPrice, totalCost,
                item.batchNumber, item.expiryDate, item.notes]
            );
        }

        await client.query('COMMIT');

        res.json(document);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating receipt:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ============================================================================
// СПИСАНИЕ (Write-off)
// ============================================================================

/**
 * POST /api/warehouse/write-off
 * Создать документ списания товаров
 */
router.post('/write-off', authorize('warehouse.write'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { warehouseId, items, reason, notes } = req.body;

        if (!warehouseId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Warehouse ID and items are required' });
        }

        // Генерация номера документа
        const docNumberResult = await client.query(
            "SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-WO-' || LPAD(nextval('warehouse_doc_number_seq')::TEXT, 4, '0') as doc_number"
        );
        const documentNumber = docNumberResult.rows[0].doc_number;

        // Создание документа
        const docResult = await client.query(
            `INSERT INTO warehouse_documents (
                document_number, document_type, document_date, warehouse_id, reason,
                status, created_by, notes
            ) VALUES ($1, 'write_off', CURRENT_DATE, $2, $3, 'draft', $4, $5)
            RETURNING *`,
            [documentNumber, warehouseId, reason, req.user.id, notes]
        );

        const document = docResult.rows[0];

        // Добавление позиций
        for (const item of items) {
            await client.query(
                `INSERT INTO warehouse_document_items (
                    document_id, product_id, quantity, notes
                ) VALUES ($1, $2, $3, $4)`,
                [document.id, item.productId, item.quantity, item.notes]
            );
        }

        await client.query('COMMIT');

        res.json(document);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating write-off:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ============================================================================
// ПЕРЕМЕЩЕНИЕ (Transfer)
// ============================================================================

/**
 * POST /api/warehouse/transfer
 * Создать документ перемещения товаров между складами
 */
router.post('/transfer', authorize('warehouse.write'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { warehouseFromId, warehouseToId, items, reason, notes } = req.body;

        if (!warehouseFromId || !warehouseToId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Warehouse IDs and items are required' });
        }

        if (warehouseFromId === warehouseToId) {
            return res.status(400).json({ error: 'Source and destination warehouses must be different' });
        }

        // Генерация номера документа
        const docNumberResult = await client.query(
            "SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-TR-' || LPAD(nextval('warehouse_doc_number_seq')::TEXT, 4, '0') as doc_number"
        );
        const documentNumber = docNumberResult.rows[0].doc_number;

        // Создание документа
        const docResult = await client.query(
            `INSERT INTO warehouse_documents (
                document_number, document_type, document_date, warehouse_from_id, warehouse_to_id,
                reason, status, created_by, notes
            ) VALUES ($1, 'transfer', CURRENT_DATE, $2, $3, $4, 'draft', $5, $6)
            RETURNING *`,
            [documentNumber, warehouseFromId, warehouseToId, reason, req.user.id, notes]
        );

        const document = docResult.rows[0];

        // Добавление позиций
        for (const item of items) {
            await client.query(
                `INSERT INTO warehouse_document_items (
                    document_id, product_id, quantity, notes
                ) VALUES ($1, $2, $3, $4)`,
                [document.id, item.productId, item.quantity, item.notes]
            );
        }

        await client.query('COMMIT');

        res.json(document);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating transfer:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ============================================================================
// ПРОВЕДЕНИЕ ДОКУМЕНТА
// ============================================================================

/**
 * POST /api/warehouse/confirm/:id
 * Провести документ (изменить статус на confirmed)
 */
router.post('/confirm/:id', authorize('warehouse.confirm'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const documentId = req.params.id;

        // Обновить статус (триггер автоматически создаст движения)
        const result = await client.query(
            `UPDATE warehouse_documents 
             SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW()
             WHERE id = $2 AND status = 'draft'
             RETURNING *`,
            [req.user.id, documentId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found or already confirmed' });
        }

        await client.query('COMMIT');

        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error confirming document:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ============================================================================
// ОСТАТКИ ПО СКЛАДАМ
// ============================================================================

/**
 * GET /api/warehouse/stock-balance
 * Получить остатки товаров по складам
 */
router.get('/stock-balance', async (req, res) => {
    try {
        const { warehouseId, productId, showZero = false } = req.query;

        let query = `
            SELECT 
                sb.id,
                sb.product_id,
                p.code as product_code,
                p.name as product_name,
                p.barcode,
                sb.warehouse_id,
                w.name as warehouse_name,
                sb.quantity,
                sb.reserved_quantity,
                sb.available_quantity,
                sb.average_cost,
                sb.last_movement_date
            FROM stock_balances sb
            JOIN products p ON sb.product_id = p.id
            JOIN warehouses w ON sb.warehouse_id = w.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (warehouseId) {
            query += ` AND sb.warehouse_id = $${paramIndex}`;
            params.push(warehouseId);
            paramIndex++;
        }

        if (productId) {
            query += ` AND sb.product_id = $${paramIndex}`;
            params.push(productId);
            paramIndex++;
        }

        if (!showZero || showZero === 'false') {
            query += ` AND sb.quantity > 0`;
        }

        query += ` ORDER BY w.name, p.name`;

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting stock balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ДВИЖЕНИЯ ТОВАРОВ
// ============================================================================

/**
 * GET /api/warehouse/movements
 * Получить движения товаров
 */
router.get('/movements', async (req, res) => {
    try {
        const { productId, warehouseId, startDate, endDate, limit = 100 } = req.query;

        let query = `
            SELECT 
                sm.*,
                p.name as product_name,
                p.code as product_code,
                w.name as warehouse_name,
                u.full_name as user_name
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            JOIN warehouses w ON sm.warehouse_id = w.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (productId) {
            query += ` AND sm.product_id = $${paramIndex}`;
            params.push(productId);
            paramIndex++;
        }

        if (warehouseId) {
            query += ` AND sm.warehouse_id = $${paramIndex}`;
            params.push(warehouseId);
            paramIndex++;
        }

        if (startDate) {
            query += ` AND sm.movement_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            query += ` AND sm.movement_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        query += ` ORDER BY sm.movement_date DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting movements:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ДОКУМЕНТЫ
// ============================================================================

/**
 * GET /api/warehouse/documents
 * Получить список складских документов
 */
router.get('/documents', async (req, res) => {
    try {
        const { type, status, warehouseId, startDate, endDate, limit = 50 } = req.query;

        let query = `
            SELECT 
                wd.*,
                w.name as warehouse_name,
                wf.name as warehouse_from_name,
                wt.name as warehouse_to_name,
                u.full_name as created_by_name,
                uc.full_name as confirmed_by_name,
                COUNT(wdi.id) as items_count
            FROM warehouse_documents wd
            LEFT JOIN warehouses w ON wd.warehouse_id = w.id
            LEFT JOIN warehouses wf ON wd.warehouse_from_id = wf.id
            LEFT JOIN warehouses wt ON wd.warehouse_to_id = wt.id
            LEFT JOIN users u ON wd.created_by = u.id
            LEFT JOIN users uc ON wd.confirmed_by = uc.id
            LEFT JOIN warehouse_document_items wdi ON wd.id = wdi.document_id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (type) {
            query += ` AND wd.document_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (status) {
            query += ` AND wd.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (warehouseId) {
            query += ` AND (wd.warehouse_id = $${paramIndex} OR wd.warehouse_from_id = $${paramIndex} OR wd.warehouse_to_id = $${paramIndex})`;
            params.push(warehouseId);
            paramIndex++;
        }

        if (startDate) {
            query += ` AND wd.document_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            query += ` AND wd.document_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        query += ` GROUP BY wd.id, w.name, wf.name, wt.name, u.full_name, uc.full_name
                   ORDER BY wd.document_date DESC, wd.created_at DESC 
                   LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting documents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/warehouse/documents/:id
 * Получить детали документа
 */
router.get('/documents/:id', async (req, res) => {
    try {
        const documentId = req.params.id;

        // Получить заголовок документа
        const docResult = await pool.query(
            `SELECT wd.*, 
                w.name as warehouse_name,
                wf.name as warehouse_from_name,
                wt.name as warehouse_to_name,
                u.full_name as created_by_name
             FROM warehouse_documents wd
             LEFT JOIN warehouses w ON wd.warehouse_id = w.id
             LEFT JOIN warehouses wf ON wd.warehouse_from_id = wf.id
             LEFT JOIN warehouses wt ON wd.warehouse_to_id = wt.id
             LEFT JOIN users u ON wd.created_by = u.id
             WHERE wd.id = $1`,
            [documentId]
        );

        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const document = docResult.rows[0];

        // Получить позиции документа
        const itemsResult = await pool.query(
            `SELECT wdi.*, p.code as product_code, p.name as product_name, p.barcode
             FROM warehouse_document_items wdi
             JOIN products p ON wdi.product_id = p.id
             WHERE wdi.document_id = $1
             ORDER BY wdi.id`,
            [documentId]
        );

        document.items = itemsResult.rows;

        res.json(document);
    } catch (error) {
        console.error('Error getting document details:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
