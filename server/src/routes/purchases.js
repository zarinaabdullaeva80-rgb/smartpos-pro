import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';
import { updateStockBalance, recalcStockBalance } from '../utils/stockBalance.js';

const router = express.Router();

// Получение всех закупок
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, dateFrom, dateTo, counterpartyId } = req.query;

        const orgId = req.user?.organization_id;
        let query = `
      SELECT p.*, c.name as counterparty_name, w.name as warehouse_name, u.full_name as user_name
      FROM purchases p
      LEFT JOIN counterparties c ON p.counterparty_id = c.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;

        if (orgId) {
            query += ` AND p.organization_id = $${paramCount}`;
            params.push(orgId);
            paramCount++;
        }

        if (status) {
            query += ` AND p.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND p.document_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND p.document_date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        if (counterpartyId) {
            query += ` AND p.counterparty_id = $${paramCount}`;
            params.push(counterpartyId);
            paramCount++;
        }

        query += ' ORDER BY p.document_date DESC, p.id DESC';

        const result = await pool.query(query, params);
        res.json({ purchases: result.rows });
    } catch (error) {
        console.error('Ошибка получения закупок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение закупки по ID с позициями
router.get('/:id', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let purchaseQuery = `
             SELECT p.*, c.name as counterparty_name, w.name as warehouse_name, u.full_name as user_name
             FROM purchases p
             LEFT JOIN counterparties c ON p.counterparty_id = c.id
             LEFT JOIN warehouses w ON p.warehouse_id = w.id
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.id = $1
        `;
        const queryParams = [req.params.id];

        if (orgId) {
            purchaseQuery += ' AND p.organization_id = $2';
            queryParams.push(orgId);
        }

        const purchaseResult = await pool.query(purchaseQuery, queryParams);

        if (purchaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Закупка не найдена' });
        }

        const itemsResult = await pool.query(
            `SELECT pi.*, p.name as product_name, p.code as product_code, p.unit
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.purchase_id = $1
       ORDER BY pi.id`,
            [req.params.id]
        );

        const purchase = purchaseResult.rows[0];
        purchase.items = itemsResult.rows;

        res.json({ purchase });
    } catch (error) {
        console.error('Ошибка получения закупки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание закупки
router.post('/', authenticate, authorize('Администратор', 'Бухгалтер', 'Кладовщик'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { documentNumber, documentDate, counterpartyId, warehouseId, items, notes } = req.body;

        // Расчет сумм
        let totalAmount = 0;
        let vatAmount = 0;

        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);
            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const orgId = req.user?.organization_id;

        // Валидация контрагента и склада (должны принадлежать той же лицензии)
        if (orgId) {
            if (counterpartyId) {
                const cpCheck = await client.query('SELECT 1 FROM counterparties WHERE id = $1 AND organization_id = $2', [counterpartyId, orgId]);
                if (cpCheck.rows.length === 0) throw new Error('Контрагент не найден в вашей организации');
            }
            if (warehouseId) {
                const whCheck = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND organization_id = $2', [warehouseId, orgId]);
                if (whCheck.rows.length === 0) throw new Error('Склад не найден в вашей организации');
            }
        }

        const finalAmount = totalAmount;

        // Создание документа закупки
        const purchaseResult = await client.query(
            `INSERT INTO purchases (document_number, document_date, counterparty_id, warehouse_id, 
        total_amount, vat_amount, final_amount, user_id, notes, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [documentNumber, documentDate, counterpartyId, warehouseId, totalAmount, vatAmount,
                finalAmount, req.user.id, notes, orgId]
        );

        const purchase = purchaseResult.rows[0];

        // Создание позиций закупки
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);

            await client.query(
                `INSERT INTO purchase_items (purchase_id, product_id, quantity, price, vat_rate, vat_amount, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [purchase.id, item.productId, item.quantity, item.price, item.vatRate || 20, itemVat, itemTotal]
            );
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CREATE', 'purchases', purchase.id, null, purchase, req.ip);

        res.status(201).json({ message: 'Закупка создана', purchase });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания закупки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Обновление закупки
router.put('/:id', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const purchaseId = req.params.id;
        const { documentNumber, documentDate, counterpartyId, warehouseId, items, notes } = req.body;

        // Проверка статуса
        const orgId = req.user?.organization_id;

        // Проверка статуса
        let checkQuery = 'SELECT status FROM purchases WHERE id = $1';
        const checkParams = [purchaseId];
        if (orgId) {
            checkQuery += ' AND organization_id = $2';
            checkParams.push(orgId);
        }
        const statusCheck = await client.query(checkQuery, checkParams);
        if (statusCheck.rows.length === 0) {
            throw new Error('Закупка не найдена');
        }

        if (statusCheck.rows[0].status !== 'draft') {
            throw new Error('Нельзя изменить проведенную закупку');
        }

        // Валидация контрагента и склада (должны принадлежать той же лицензии)
        if (orgId) {
            if (counterpartyId) {
                const cpCheck = await client.query('SELECT 1 FROM counterparties WHERE id = $1 AND organization_id = $2', [counterpartyId, orgId]);
                if (cpCheck.rows.length === 0) throw new Error('Контрагент не найден в вашей организации');
            }
            if (warehouseId) {
                const whCheck = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND organization_id = $2', [warehouseId, orgId]);
                if (whCheck.rows.length === 0) throw new Error('Склад не найден в вашей организации');
            }
        }

        // Расчет сумм
        let totalAmount = 0;
        let vatAmount = 0;

        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);
            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const finalAmount = totalAmount;

        // Обновление документа
        await client.query(
            `UPDATE purchases SET document_number = $1, document_date = $2, counterparty_id = $3, 
       warehouse_id = $4, total_amount = $5, vat_amount = $6, final_amount = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
            [documentNumber, documentDate, counterpartyId, warehouseId, totalAmount, vatAmount, finalAmount, notes, purchaseId]
        );

        // Удаление старых позиций
        await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [purchaseId]);

        // Создание новых позиций
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);

            await client.query(
                `INSERT INTO purchase_items (purchase_id, product_id, quantity, price, vat_rate, vat_amount, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [purchaseId, item.productId, item.quantity, item.price, item.vatRate || 20, itemVat, itemTotal]
            );
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'UPDATE', 'purchases', purchaseId, null, null, req.ip);

        res.json({ message: 'Закупка обновлена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка обновления закупки:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Проведение закупки (оприходование на склад)
router.post('/:id/confirm', authenticate, authorize('Администратор', 'Бухгалтер', 'Кладовщик'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const purchaseId = req.params.id;

        const orgId = req.user?.organization_id;

        // Получение данных закупки
        let purchaseQuery = 'SELECT * FROM purchases WHERE id = $1';
        const queryParams = [purchaseId];
        if (orgId) {
            purchaseQuery += ' AND organization_id = $2';
            queryParams.push(orgId);
        }
        const purchaseResult = await client.query(purchaseQuery, queryParams);
        if (purchaseResult.rows.length === 0) {
            throw new Error('Закупка не найдена');
        }

        const purchase = purchaseResult.rows[0];

        if (purchase.status !== 'draft') {
            throw new Error('Закупка уже проведена');
        }

        // Получение позиций
        const itemsResult = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [purchaseId]);

        // Создание движений по складу (приход)
        for (const item of itemsResult.rows) {
            await client.query(
                `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, cost_price, user_id)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6)`,
                [item.product_id, purchase.warehouse_id, purchaseId, item.quantity, item.price, req.user.id]
            );

            // Обновить stock_balances (закупка = приход)
            await updateStockBalance(client, item.product_id, purchase.warehouse_id, item.quantity);

            // Обновление цены закупки товара (только если товар принадлежит той же лицензии)
            let productUpdateQuery = 'UPDATE products SET price_purchase = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
            const productUpdateParams = [item.price, item.product_id];
            if (orgId) {
                productUpdateQuery += ' AND organization_id = $3';
                productUpdateParams.push(orgId);
            }
            await client.query(productUpdateQuery, productUpdateParams);
        }

        // Обновление статуса
        await client.query('UPDATE purchases SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', purchaseId]);

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CONFIRM', 'purchases', purchaseId, null, null, req.ip);

        // Emit real-time inventory updates for all products in this purchase
        const io = req.app.get('io');
        if (io) {
            for (const item of itemsResult.rows) {
                io.emit('inventory:updated', { product_id: item.product_id });
            }
        }

        res.json({ message: 'Закупка проведена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка проведения закупки:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Отмена проведения закупки
router.post('/:id/cancel', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const purchaseId = req.params.id;

        const orgId = req.user?.organization_id;

        // Получение данных закупки
        let purchaseQuery = 'SELECT * FROM purchases WHERE id = $1';
        const queryParams = [purchaseId];
        if (orgId) {
            purchaseQuery += ' AND organization_id = $2';
            queryParams.push(orgId);
        }
        const purchaseResult = await client.query(purchaseQuery, queryParams);
        if (purchaseResult.rows.length === 0) {
            throw new Error('Закупка не найдена');
        }

        const purchase = purchaseResult.rows[0];

        if (purchase.status !== 'confirmed') {
            throw new Error('Закупка не проведена');
        }

        // Получить позиции до удаления движений (для пересчёта stock_balances)
        const cancelItems = await client.query('SELECT product_id FROM purchase_items WHERE purchase_id = $1', [purchaseId]);

        // Удаление движений по складу
        await client.query(
            `DELETE FROM inventory_movements WHERE document_type = 'purchase' AND document_id = $1`,
            [purchaseId]
        );

        // Пересчитать stock_balances для затронутых товаров
        for (const item of cancelItems.rows) {
            await recalcStockBalance(client, item.product_id, purchase.warehouse_id);
        }

        // Обновление статуса
        await client.query('UPDATE purchases SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['draft', purchaseId]);

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CANCEL', 'purchases', purchaseId, null, null, req.ip);

        // Emit real-time inventory updates (stock was removed)
        const io = req.app.get('io');
        if (io) {
            try {
                const items = await pool.query('SELECT product_id FROM purchase_items WHERE purchase_id = $1', [purchaseId]);
                for (const item of items.rows) {
                    io.emit('inventory:updated', { product_id: item.product_id });
                }
            } catch (e) { /* non-critical */ }
        }

        res.json({ message: 'Проведение закупки отменено' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка отмены закупки:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Удаление закупки
router.delete('/:id', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const purchaseId = req.params.id;

        const orgId = req.user?.organization_id;

        // Проверка статуса
        let purchaseQuery = 'SELECT status FROM purchases WHERE id = $1';
        const queryParams = [purchaseId];
        if (orgId) {
            purchaseQuery += ' AND organization_id = $2';
            queryParams.push(orgId);
        }
        const purchaseResult = await client.query(purchaseQuery, queryParams);
        if (purchaseResult.rows.length === 0) {
            throw new Error('Закупка не найдена');
        }

        if (purchaseResult.rows[0].status !== 'draft') {
            throw new Error('Нельзя удалить проведенную закупку');
        }

        // Удаление позиций и документа
        await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [purchaseId]);
        await client.query('DELETE FROM purchases WHERE id = $1', [purchaseId]);

        await client.query('COMMIT');
        await logAudit(req.user.id, 'DELETE', 'purchases', purchaseId, null, null, req.ip);

        res.json({ message: 'Закупка удалена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления закупки:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

export default router;
