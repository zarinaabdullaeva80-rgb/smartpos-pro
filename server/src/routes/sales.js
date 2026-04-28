import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const router = express.Router();

// All queries now use mandatory organization_id filtering derived from JWT

// Получение всех продаж
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, dateFrom, dateTo, counterpartyId } = req.query;
        const orgId = req.user.organization_id;

        let query = `
      SELECT s.*, u.full_name as user_name, w.name as warehouse_name
      FROM sales s
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.organization_id = $1
    `;
        const params = [orgId];
        let paramCount = 2;

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

        // Пагинация
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 50;

        if (page && page > 0) {
            const offset = (page - 1) * limit;
            const countQuery = `SELECT COUNT(*) as total FROM sales WHERE organization_id = $1`;
            const countResult = await pool.query(countQuery, [orgId]);
            const totalCount = parseInt(countResult.rows[0]?.total || 0);

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
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение продажи по ID с товарами
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;

        const saleResult = await pool.query(
            `SELECT s.*, w.name as warehouse_name, u.full_name as user_name
             FROM sales s
             LEFT JOIN warehouses w ON s.warehouse_id = w.id
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.organization_id = $2`,
            [id, orgId]
        );

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

// Создание продажи
router.post('/', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { 
            documentNumber, 
            documentDate, 
            counterpartyId, 
            warehouseId, 
            items, 
            discountPercent, 
            loyaltyPointsUsed,
            notes, 
            autoConfirm, 
            payment_methods 
        } = req.body;
        const orgId = req.user.organization_id;

        // Получаем настройки лояльности
        const settingsRes = await client.query('SELECT * FROM loyalty_settings WHERE organization_id = $1', [orgId]);
        const loyaltySettings = settingsRes.rows[0] || { cashback_percent: 2, points_to_currency: 1, enabled: true };

        // Расчет сумм
        let totalAmount = 0;
        
        for (const item of items) {
            // Verify product ownership and get price if not provided
            const pRes = await client.query('SELECT price_sale FROM products WHERE id = $1 AND organization_id = $2', [item.productId, orgId]);
            if (pRes.rows.length === 0) throw new Error(`Товар ${item.productId} не найден или недоступен`);
            
            const price = item.price || parseFloat(pRes.rows[0].price_sale) || 0;
            item.price = price;
            totalAmount += item.quantity * price;
        }

        const discountAmount = (totalAmount * (discountPercent || 0)) / 100;
        const amountAfterDiscount = totalAmount - discountAmount;
        
        // Логика баллов
        const pointsToCurrency = loyaltySettings.points_to_currency || 1;
        const pointsValue = (loyaltyPointsUsed || 0) * pointsToCurrency;
        const finalAmount = Math.max(0, amountAfterDiscount - pointsValue);

        // Валидация payment_methods
        if (payment_methods && payment_methods.length > 0) {
            const paymentTotal = payment_methods.reduce((sum, pm) => sum + parseFloat(pm.amount || 0), 0);
            if (Math.abs(paymentTotal - finalAmount) > 0.01) {
                throw new Error(`Сумма платежей (${paymentTotal}) не совпадает с итоговой суммой (${finalAmount})`);
            }
        }

        const status = autoConfirm ? 'confirmed' : 'draft';

        // Валидация склада
        let finalWarehouseId = warehouseId;
        if (finalWarehouseId) {
            const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1 AND organization_id = $2', [finalWarehouseId, orgId]);
            if (whCheck.rows.length === 0) throw new Error('Склад не найден');
        } else {
            const wh = await client.query('SELECT id FROM warehouses WHERE organization_id = $1 AND is_active = true LIMIT 1', [orgId]);
            finalWarehouseId = wh.rows[0]?.id;
            if (!finalWarehouseId) throw new Error('Нет доступных складов');
        }

        // Расчет начисления баллов (кэшбек)
        let pointsEarned = 0;
        if (loyaltySettings.enabled && finalAmount > 0) {
            pointsEarned = Math.floor(finalAmount * (loyaltySettings.cashback_percent || 0) / 100);
        }

        // Создание документа продажи
        const saleResult = await client.query(
            `INSERT INTO sales (
                document_number, document_date, customer_id, warehouse_id, 
                total_amount, discount_percent, discount_amount, 
                loyalty_points_used, loyalty_points_earned,
                final_amount, user_id, notes, status, organization_id
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                documentNumber || `SALE-${Date.now()}`, 
                documentDate || new Date(), 
                counterpartyId || null, 
                finalWarehouseId, 
                totalAmount, 
                discountPercent || 0, 
                discountAmount, 
                loyaltyPointsUsed || 0,
                pointsEarned,
                finalAmount, 
                req.user.id, 
                notes, 
                status, 
                orgId
            ]
        );

        const sale = saleResult.rows[0];

        // Создание позиций продажи
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, organization_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [sale.id, item.productId, item.quantity, item.price, itemTotal, orgId]
            );

            if (autoConfirm) {
                await client.query(
                    `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, user_id, organization_id)
                     VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
                    [item.productId, finalWarehouseId, sale.id, item.quantity, req.user.id, orgId]
                );
                await updateStockBalance(client, item.productId, finalWarehouseId, -item.quantity);
            }
        }

        // Обработка баллов в БД (если авто-подтверждение)
        if (autoConfirm && counterpartyId) {
            // Списание
            if (loyaltyPointsUsed > 0) {
                await client.query(
                    `UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) - $1 WHERE id = $2 AND organization_id = $3`,
                    [loyaltyPointsUsed, counterpartyId, orgId]
                );
                await client.query(
                    `INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
                     VALUES ($1, 'spend', $2, $3, $4, $5, $6)`,
                    [counterpartyId, -loyaltyPointsUsed, sale.id, 'Списание при продаже', req.user.id, orgId]
                );
            }
            // Начисление
            if (pointsEarned > 0) {
                await client.query(
                    `UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2 AND organization_id = $3`,
                    [pointsEarned, counterpartyId, orgId]
                );
                await client.query(
                    `INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
                     VALUES ($1, 'earn', $2, $3, $4, $5, $6)`,
                    [counterpartyId, pointsEarned, sale.id, 'Начисление за покупку', req.user.id, orgId]
                );
            }
        }

        // Платежи
        if (payment_methods && payment_methods.length > 0) {
            for (const pm of payment_methods) {
                await client.query(
                    `INSERT INTO sale_payment_details (sale_id, payment_method_code, amount, organization_id)
                     VALUES ($1, $2, $3, $4)`,
                    [sale.id, pm.type, pm.amount, orgId]
                );
            }
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CREATE', 'sales', sale.id, null, sale, req.ip, orgId);

        res.status(201).json({ success: true, sale });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания продажи:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});


// Обновление статуса (Проведение/Отмена)
router.post('/:id/confirm', authenticate, authorize('Администратор', 'Продавец', 'Кассир', 'Продавец-кассир'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;

        await client.query('BEGIN');

        const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 AND organization_id = $2', [id, orgId]);
        if (saleRes.rows.length === 0) throw new Error('Продажа не найдена');
        const sale = saleRes.rows[0];

        if (sale.status !== 'draft') throw new Error('Продажа уже проведена или отменена');

        const itemsRes = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);

        for (const item of itemsRes.rows) {
            await client.query(
                `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, user_id, organization_id)
                 VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
                [item.product_id, sale.warehouse_id, id, item.quantity, req.user.id, orgId]
            );
            await updateStockBalance(client, item.product_id, sale.warehouse_id, -item.quantity);
        }

        await client.query('UPDATE sales SET status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', id]);

        // Loyalty points processing for manual confirmation
        if (sale.customer_id) {
            const used = parseFloat(sale.loyalty_points_used || 0);
            const earned = parseFloat(sale.loyalty_points_earned || 0);

            if (used > 0) {
                await client.query(
                    `UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) - $1 WHERE id = $2 AND organization_id = $3`,
                    [used, sale.customer_id, orgId]
                );
                await client.query(
                    `INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
                     VALUES ($1, 'spend', $2, $3, $4, $5, $6)`,
                    [sale.customer_id, -used, id, 'Списание при продаже (подтверждение)', req.user.id, orgId]
                );
            }

            if (earned > 0) {
                await client.query(
                    `UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2 AND organization_id = $3`,
                    [earned, sale.customer_id, orgId]
                );
                await client.query(
                    `INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
                     VALUES ($1, 'earn', $2, $3, $4, $5, $6)`,
                    [sale.customer_id, earned, id, 'Начисление за покупку (подтверждение)', req.user.id, orgId]
                );
            }
        }

        await client.query('COMMIT');
        await logAudit(req.user.id, 'CONFIRM', 'sales', id, null, null, req.ip, orgId);

        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Удаление продажи (только черновики)
router.delete('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;

        const checkRes = await pool.query('SELECT status FROM sales WHERE id = $1 AND organization_id = $2', [id, orgId]);
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Продажа не найдена' });
        if (checkRes.rows[0].status !== 'draft') return res.status(400).json({ error: 'Нельзя удалить проведенную продажу' });

        await pool.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
        await pool.query('DELETE FROM sales WHERE id = $1', [id]);

        await logAudit(req.user.id, 'DELETE', 'sales', id, null, null, req.ip, orgId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
