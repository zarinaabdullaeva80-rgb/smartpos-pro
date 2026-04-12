import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const router = express.Router();

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Получение всех продаж
 *     tags: [Распродажа]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, confirmed, shipped, paid, cancelled]
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Список продаж
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sales:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sale'
 *   post:
 *     summary: Создание продажи
 *     tags: [Распродажа]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - warehouseId
 *               - items
 *             properties:
 *               documentNumber:
 *                 type: string
 *               documentDate:
 *                 type: string
 *                 format: date
 *               warehouseId:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *     responses:
 *       201:
 *         description: Продажа создана
 */

// Получение всех продаж
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, dateFrom, dateTo, counterpartyId } = req.query;

        const userLicenseId = req.user?.license_id;
        let query = `
      SELECT s.*, u.full_name as user_name, w.name as warehouse_name
      FROM sales s
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND s.license_id = $${paramCount}`;
            params.push(userLicenseId);
            paramCount++;
        }

        if (status) {
            query += ` AND s.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND s.document_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND s.document_date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        if (counterpartyId) {
            query += ` AND s.customer_id = $${paramCount}`;
            params.push(counterpartyId);
            paramCount++;
        }

        query += ' ORDER BY s.document_date DESC, s.id DESC';

        // Пагинация (опционально — для обратной совместимости)
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 50;

        if (page && page > 0) {
            const countQuery = query.replace(/SELECT[\s\S]*?FROM sales/, 'SELECT COUNT(*) as total FROM sales');
            let totalCount = 0;
            try {
                const countResult = await pool.query(countQuery, params);
                totalCount = parseInt(countResult.rows[0]?.total || 0);
            } catch (e) { /* fallback */ }

            const offset = (page - 1) * limit;
            query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            params.push(limit, offset);

            const result = await pool.query(query, params);
            res.json({
                sales: result.rows,
                pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) }
            });
        } else {
            const result = await pool.query(query, params);
            res.json({ sales: result.rows });
        }
    } catch (error) {
        console.error('Ошибка получения продаж:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получение продажи по ID с товарами
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const userLicenseId = req.user?.license_id;
        let saleQuery = `
             SELECT s.*, w.name as warehouse_name, u.full_name as user_name
             FROM sales s
             LEFT JOIN warehouses w ON s.warehouse_id = w.id
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = $1
        `;
        const queryParams = [id];

        if (userLicenseId) {
            saleQuery += ' AND s.license_id = $2';
            queryParams.push(userLicenseId);
        }

        const saleResult = await pool.query(saleQuery, queryParams);

        if (saleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        const sale = saleResult.rows[0];

        // Получаем товары продажи
        const itemsResult = await pool.query(
            `SELECT si.*, p.name as product_name, p.unit
             FROM sale_items si
             LEFT JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = $1
             ORDER BY si.id`,
            [id]
        );

        sale.items = itemsResult.rows;

        res.json({ sale });
    } catch (error) {
        console.error('Ошибка получения продажи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление статуса продажи
router.patch('/:id/status', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['draft', 'pending', 'confirmed', 'shipped', 'paid', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Недопустимый статус' });
        }

        const userLicenseId = req.user?.license_id;
        let query = 'UPDATE sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        const params = [status, id];

        if (userLicenseId) {
            query += ' AND license_id = $3';
            params.push(userLicenseId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        if (status === 'confirmed') {
            const io = req.app.get('io');
            if (io) io.emit('sale:confirmed', { id, document_number: result.rows[0].document_number });
        }

        res.json({ sale: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления статуса продажи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание продажи
router.post('/', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир', 'cashier', 'seller', 'manager'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { documentNumber, documentDate, counterpartyId, warehouseId, items, discountPercent, notes, autoConfirm, payment_methods } = req.body;

        console.log('[SALES] Creating sale:', {
            documentNumber,
            autoConfirm,
            itemsCount: items?.length,
            hasWarehouseId: !!warehouseId,
            paymentMethods: payment_methods?.length
        });

        // Расчет сумм
        let totalAmount = 0;
        let vatAmount = 0;

        const userLicenseId = req.user?.license_id;

        // Получить цены из БД для товаров без цены
        for (const item of items) {
            if (!item.price || isNaN(item.price)) {
                let pQuery = 'SELECT price FROM products WHERE id = $1';
                const pParams = [item.productId];
                if (userLicenseId) {
                    pQuery += ' AND license_id = $2';
                    pParams.push(userLicenseId);
                }
                const productResult = await client.query(pQuery, pParams);
                if (productResult.rows.length > 0) {
                    item.price = parseFloat(productResult.rows[0].price) || 0;
                } else {
                    item.price = 0;
                }
                console.log(`[SALES] Fetched price for product ${item.productId}: ${item.price}`);
            }
        }

        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * (item.vatRate || 0)) / (100 + (item.vatRate || 0));
            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const discountAmount = (totalAmount * (discountPercent || 0)) / 100;
        const finalAmount = totalAmount - discountAmount;

        // Валидация payment_methods (если указаны)
        if (payment_methods && payment_methods.length > 0) {
            const paymentTotal = payment_methods.reduce((sum, pm) => sum + parseFloat(pm.amount || 0), 0);
            if (Math.abs(paymentTotal - finalAmount) > 0.01) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Сумма платежей (${paymentTotal}) не совпадает с итоговой суммой (${finalAmount})`
                });
            }
        }

        // Определение статуса (автоматически проводим если autoConfirm = true)
        const status = autoConfirm ? 'confirmed' : 'draft';

        // Валидация и автоподбор склада
        let finalWarehouseId = warehouseId || null;
        if (finalWarehouseId) {
            // Проверить что указанный склад существует
            try {
                const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1', [finalWarehouseId]);
                if (whCheck.rows.length === 0) {
                    console.warn(`[SALES] Warehouse ${finalWarehouseId} not found, auto-selecting...`);
                    finalWarehouseId = null; // сбросить — выберем ниже
                }
            } catch (e) {
                finalWarehouseId = null;
            }
        }
        if (!finalWarehouseId) {
            try {
                let whQuery = 'SELECT id FROM warehouses';
                const whParams = [];
                if (userLicenseId) {
                    whQuery += ' WHERE license_id = $1';
                    whParams.push(userLicenseId);
                }
                whQuery += ' ORDER BY id LIMIT 1';
                const whResult = await client.query(whQuery, whParams);
                if (whResult.rows.length > 0) {
                    finalWarehouseId = whResult.rows[0].id;
                    console.log(`[SALES] Auto-selected warehouse: ${finalWarehouseId}`);
                }
            } catch (e) {
                console.warn('[SALES] Warehouse lookup failed:', e.message);
            }
        }

        // Создание документа продажи
        const saleResult = await client.query(
            `INSERT INTO sales (document_number, document_date, customer_id, warehouse_id, 
        total_amount, discount_percent, discount_amount, final_amount, user_id, notes, status, payment_type, license_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
            [documentNumber, documentDate, counterpartyId || null, finalWarehouseId, totalAmount,
                discountPercent || 0, discountAmount, finalAmount, req.user.id, notes, status, 'cash', userLicenseId]
        );

        const sale = saleResult.rows[0];

        // Создание позиций продажи
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemDiscount = itemTotal * (item.discountPercent || 0) / 100;

            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, price, discount_amount, total_price)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [sale.id, item.productId, item.quantity, item.price, itemDiscount, itemTotal - itemDiscount]
            );
        }

        // Сохранение деталей оплаты (один раз)
        try {
            if (payment_methods && payment_methods.length > 0) {
                for (const pm of payment_methods) {
                    await client.query(
                        `INSERT INTO sale_payment_details (sale_id, payment_method_code, amount, notes)
                         VALUES ($1, $2, $3, $4)`,
                        [sale.id, pm.type, pm.amount, pm.notes || null]
                    );
                }
            } else {
                // Если не указаны способы оплаты, по умолчанию наличные
                await client.query(
                    `INSERT INTO sale_payment_details (sale_id, payment_method_code, amount)
                     VALUES ($1, 'cash', $2)`,
                    [sale.id, finalAmount]
                );
            }
        } catch (paymentError) {
            console.warn('[Sales] Ошибка сохранения способа оплаты:', paymentError.message);
            // Продолжаем - продажа важнее
        }

        // Если autoConfirm - списываем остатки через inventory_movements
        if (autoConfirm) {
            try {
                for (const item of items) {
                    // Создание движения по складу
                    // quantity хранится ПОЛОЖИТЕЛЬНОЙ — GET products query использует CASE для 'sale' → -im.quantity
                    if (finalWarehouseId) {
                        await client.query(
                            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, cost_price, user_id, license_id)
                     VALUES ($1, $2, 'sale', $3, $4, $5, $6, $7)`,
                            [item.productId, finalWarehouseId, sale.id, item.quantity, item.price, req.user.id, userLicenseId]
                        );
                        // Обновить stock_balances (продажа = списание)
                        await updateStockBalance(client, item.productId, finalWarehouseId, -item.quantity);
                        console.log(`[SALES] Stock movement: product ${item.productId}, qty ${item.quantity}, warehouse ${finalWarehouseId}`);
                    }
                }
            } catch (inventoryError) {
                console.warn('[Sales] Ошибка списания остатков:', inventoryError.message);
            }
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CREATE', 'sales', sale.id, null, sale, req.ip);

        // === АВТО-НАЧИСЛЕНИЕ БАЛЛОВ ЛОЯЛЬНОСТИ ===
        if (counterpartyId && finalAmount > 0) {
            try {
                // Получить настройки лояльности
                const loyaltySettings = await pool.query('SELECT * FROM loyalty_settings WHERE id = 1');
                const ls = loyaltySettings.rows[0] || { cashback_percent: 2, min_purchase: 10000, enabled: true };

                if (ls.enabled !== false && finalAmount >= (ls.min_purchase || 0)) {
                    const earnedPoints = Math.floor(finalAmount * (ls.cashback_percent || 2) / 100);

                    if (earnedPoints > 0) {
                        // Найти связанного клиента по данным контрагента
                        let customerId = null;
                        try {
                            // Сначала получить данные контрагента
                            const cpRes = await pool.query('SELECT name, phone, email FROM counterparties WHERE id = $1', [counterpartyId]);
                            if (cpRes.rows.length > 0) {
                                const cp = cpRes.rows[0];
                                // Поиск клиента по телефону или имени
                                let custRes;
                                if (cp.phone) {
                                    custRes = await pool.query('SELECT id FROM customers WHERE phone = $1 LIMIT 1', [cp.phone]);
                                }
                                if ((!custRes || custRes.rows.length === 0) && cp.name) {
                                    custRes = await pool.query('SELECT id FROM customers WHERE name = $1 LIMIT 1', [cp.name]);
                                }
                                if (custRes && custRes.rows.length > 0) {
                                    customerId = custRes.rows[0].id;
                                }
                            }
                        } catch (lookupErr) {
                            console.warn('[SALES] Customer lookup error:', lookupErr.message);
                        }

                        if (customerId) {
                            // Обновить баланс клиента
                            await pool.query(
                                'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2',
                                [earnedPoints, customerId]
                            );

                            // Записать транзакцию
                            try {
                                await pool.query(
                                    `INSERT INTO loyalty_transactions (customer_id, type, points, amount, sale_id, description, created_by)
                                     VALUES ($1, 'earn', $2, $3, $4, 'Начисление за покупку', $5)`,
                                    [customerId, earnedPoints, finalAmount, sale.id, req.user.id]
                                );
                            } catch (e) { /* таблица может не существовать */ }

                            console.log(`[SALES] Loyalty: +${earnedPoints} points for customer ${customerId} (sale ${sale.id}, amount ${finalAmount})`);
                            sale.loyaltyPointsEarned = earnedPoints;
                        } else {
                            console.log(`[SALES] No matching customer found for counterparty ${counterpartyId}, loyalty skipped`);
                        }
                    }
                }
            } catch (loyaltyError) {
                console.warn('[SALES] Loyalty auto-earn error:', loyaltyError.message);
                // Не блокируем продажу из-за ошибки лояльности
            }
        }

        if (autoConfirm) {
            const io = req.app.get('io');
            if (io) {
                io.emit('sale:confirmed', { id: sale.id, document_number: sale.document_number });
                // Also notify about inventory changes for all products in this sale
                for (const item of items) {
                    io.emit('inventory:updated', { product_id: item.productId });
                }
            }
        }

        res.status(201).json({ message: autoConfirm ? 'Продажа создана и проведена' : 'Продажа создана', sale });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания продажи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Обновление продажи (только для черновиков)
router.put('/:id', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир', 'cashier', 'seller', 'manager'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const saleId = req.params.id;

        const userLicenseId = req.user?.license_id;

        // Проверка статуса
        let checkQuery = 'SELECT status FROM sales WHERE id = $1';
        const checkParams = [saleId];
        if (userLicenseId) {
            checkQuery += ' AND license_id = $2';
            checkParams.push(userLicenseId);
        }
        const checkResult = await client.query(checkQuery, checkParams);
        if (checkResult.rows.length === 0) {
            throw new Error('Продажа не найдена');
        }

        if (checkResult.rows[0].status !== 'draft') {
            throw new Error('Можно редактировать только черновики');
        }

        const { documentNumber, documentDate, counterpartyId, warehouseId, items, discountPercent, notes } = req.body;

        // Расчет сумм
        let totalAmount = 0;
        let vatAmount = 0;

        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);
            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const discountAmount = (totalAmount * (discountPercent || 0)) / 100;
        const finalAmount = totalAmount - discountAmount;

        // Обновление документа продажи
        await client.query(
            `UPDATE sales SET document_number = $1, document_date = $2, counterparty_id = $3, 
            warehouse_id = $4, total_amount = $5, vat_amount = $6, discount_percent = $7, 
            discount_amount = $8, final_amount = $9, notes = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11`,
            [documentNumber, documentDate, counterpartyId, warehouseId, totalAmount, vatAmount,
                discountPercent || 0, discountAmount, finalAmount, notes, saleId]
        );

        // Удаление старых позиций
        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);

        // Создание новых позиций
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = (itemTotal * item.vatRate) / (100 + item.vatRate);

            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, price, vat_rate, vat_amount, discount_percent, total_amount)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [saleId, item.productId, item.quantity, item.price, item.vatRate || 20, itemVat, item.discountPercent || 0, itemTotal]
            );
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'UPDATE', 'sales', saleId, null, null, req.ip);

        res.json({ message: 'Продажа обновлена', saleId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка обновления продажи:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Проведение продажи (списание со склада)
router.post('/:id/confirm', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир', 'cashier', 'seller', 'manager'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const saleId = req.params.id;

        const userLicenseId = req.user?.license_id;

        // Получение данных продажи
        let saleQuery = 'SELECT * FROM sales WHERE id = $1';
        const queryParams = [saleId];
        if (userLicenseId) {
            saleQuery += ' AND license_id = $2';
            queryParams.push(userLicenseId);
        }
        const saleResult = await client.query(saleQuery, queryParams);
        if (saleResult.rows.length === 0) {
            throw new Error('Продажа не найдена');
        }

        const sale = saleResult.rows[0];

        if (sale.status !== 'draft') {
            throw new Error('Продажа уже проведена');
        }

        // Ensure warehouse belongs to the same license if it exists
        if (sale.warehouse_id && userLicenseId) {
            const whCheck = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND license_id = $2', [sale.warehouse_id, userLicenseId]);
            if (whCheck.rows.length === 0) {
                throw new Error('Склад не принадлежит вашей организации');
            }
        }

        // Получение позиций
        const itemsResult = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);

        // Создание движений по складу и списание остатков
        for (const item of itemsResult.rows) {
            // quantity ПОЛОЖИТЕЛЬНАЯ — GET products query делает -im.quantity для 'sale'
            await client.query(
                `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, cost_price, user_id, license_id)
         VALUES ($1, $2, 'sale', $3, $4, $5, $6, $7)`,
                [item.product_id, sale.warehouse_id, saleId, item.quantity, item.price, req.user.id, userLicenseId]
            );
            // Обновить stock_balances (продажа = списание)
            await updateStockBalance(client, item.product_id, sale.warehouse_id, -item.quantity);
        }

        // Обновление статуса
        await client.query('UPDATE sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', saleId]);

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CONFIRM', 'sales', saleId, null, null, req.ip);

        // Emit real-time update (используем уже полученные itemsResult, а не client после COMMIT)
        const io = req.app.get('io');
        if (io) {
            io.emit('sale:confirmed', { id: saleId, document_number: sale.document_number });
            for (const item of itemsResult.rows) {
                io.emit('inventory:updated', { product_id: item.product_id });
            }
        }

        res.json({ message: 'Продажа проведена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка проведения продажи:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Удаление продажи
router.delete('/:id', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир', 'cashier', 'seller', 'manager'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const saleId = req.params.id;

        const userLicenseId = req.user?.license_id;

        // Проверка статуса
        let saleQuery = 'SELECT status FROM sales WHERE id = $1';
        const queryParams = [saleId];
        if (userLicenseId) {
            saleQuery += ' AND license_id = $2';
            queryParams.push(userLicenseId);
        }
        const saleResult = await client.query(saleQuery, queryParams);
        if (saleResult.rows.length === 0) {
            throw new Error('Продажа не найдена');
        }

        if (saleResult.rows[0].status !== 'draft') {
            throw new Error('Нельзя удалить проведенную продажу');
        }

        // Удаление позиций и документа
        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [saleId]);
        await client.query('DELETE FROM sales WHERE id = $1', [saleId]);

        await client.query('COMMIT');
        await logAudit(req.user.id, 'DELETE', 'sales', saleId, null, null, req.ip);

        res.json({ message: 'Продажа удалена' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления продажи:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

export default router;
