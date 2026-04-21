import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Получить список возвратов
router.get('/', authenticate, async (req, res) => {
    try {
        // Проверить существование таблицы
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'returns'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            return res.status(503).json({
                error: 'Таблица returns не найдена. Примените миграцию 006-payment-methods-and-returns.sql',
                migration_required: true
            });
        }

        const { limit = 50, offset = 0, date_from, date_to } = req.query;

        let query = `
            SELECT 
                r.*,
                s.document_number as sale_document_number,
                u.username
            FROM returns r
            LEFT JOIN sales s ON r.sale_id = s.id
            LEFT JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (date_from) {
            query += ` AND r.document_date >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND r.document_date <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        const orgId = req.user?.organization_id;
        if (orgId) {
            query += ` AND r.organization_id = $${paramIndex++}`;
            params.push(orgId);
        }

        query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json({ returns: result.rows });
    } catch (error) {
        console.error('Ошибка получения возвратов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить детали возврата
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const orgId = req.user?.organization_id;
        let query = `SELECT r.*, s.document_number as sale_number, u.username
              FROM returns r
              LEFT JOIN sales s ON r.sale_id = s.id
              LEFT JOIN users u ON r.user_id = u.id
              WHERE r.id = $1`;
        const params = [id];
        if (orgId) {
            query += ' AND r.organization_id = $2';
            params.push(orgId);
        }

        const returnResult = await pool.query(query, params);

        if (returnResult.rows.length === 0) {
            return res.status(404).json({ error: 'Возврат не найден' });
        }

        // Получить позиции возврата
        const itemsResult = await pool.query(
            `SELECT ri.*, p.name as product_name, p.code as product_code
             FROM return_items ri
             JOIN products p ON ri.product_id = p.id
             WHERE ri.return_id = $1 AND (p.organization_id = $2 OR p.organization_id IS NULL) OR $2 IS NULL`,
            [id, orgId]
        );

        res.json({
            return: returnResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        console.error('Ошибка получения возврата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Проверить возможность возврата по продаже
router.get('/check-sale/:saleId', authenticate, async (req, res) => {
    try {
        const { saleId } = req.params;

        // Получить продажу
        const orgId = req.user?.organization_id;
        let saleQuery = 'SELECT * FROM sales WHERE id = $1';
        const saleParams = [saleId];
        if (orgId) {
            saleQuery += ' AND organization_id = $2';
            saleParams.push(orgId);
        }
        const saleResult = await pool.query(saleQuery, saleParams);

        if (saleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        const sale = saleResult.rows[0];

        // Получить позиции продажи
        const itemsResult = await pool.query(
            `SELECT si.*, p.name, p.code
             FROM sale_items si
             JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = $1 AND (p.organization_id = $2 OR p.organization_id IS NULL) OR $2 IS NULL`,
            [saleId, orgId]
        );

        // Получить уже возвращенное количество для каждой позиции
        const returnedResult = await pool.query(
            `SELECT ri.sale_item_id, SUM(ri.quantity) as returned_quantity
             FROM return_items ri
             JOIN returns r ON ri.return_id = r.id
             WHERE r.sale_id = $1 AND r.status = 'confirmed'
             GROUP BY ri.sale_item_id`,
            [saleId]
        );

        const returnedMap = {};
        returnedResult.rows.forEach(row => {
            returnedMap[row.sale_item_id] = parseFloat(row.returned_quantity);
        });

        // Добавить информацию о доступном для возврата количестве
        const availableItems = itemsResult.rows.map(item => ({
            ...item,
            returned_quantity: returnedMap[item.id] || 0,
            available_quantity: parseFloat(item.quantity) - (returnedMap[item.id] || 0)
        })).filter(item => item.available_quantity > 0);

        res.json({
            can_return: availableItems.length > 0,
            sale: sale,
            available_items: availableItems
        });
    } catch (error) {
        console.error('Ошибка проверки возврата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать возврат
router.post('/', authenticate, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Проверить существование таблицы
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'returns'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            await client.query('ROLLBACK');
            return res.status(503).json({
                error: 'Таблица returns не найдена. Примените миграцию 006-payment-methods-and-returns.sql',
                migration_required: true
            });
        }

        const { sale_id, reason, items, notes } = req.body;

        // Валидация
        if (!sale_id || !items || !Array.isArray(items) || items.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Необходимо указать продажу и позиции для возврата' });
        }

        const orgId = req.user?.organization_id || null;

        // Проверить наличие открытой смены (organization_id опционально)
        let shiftQuery, shiftParams;
        if (orgId) {
            shiftQuery = `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open' AND organization_id = $2 ORDER BY started_at DESC LIMIT 1`;
            shiftParams = [req.user.id, orgId];
        } else {
            shiftQuery = `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open' ORDER BY started_at DESC LIMIT 1`;
            shiftParams = [req.user.id];
        }
        const shiftResult = await client.query(shiftQuery, shiftParams);

        if (shiftResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Для оформления возврата необходимо открыть смену' });
        }

        const currentShiftId = shiftResult.rows[0].id;

        // Проверить существование продажи (organization_id опционально)
        let saleResult;
        if (orgId) {
            saleResult = await client.query(
                'SELECT * FROM sales WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)',
                [sale_id, orgId]
            );
        } else {
            saleResult = await client.query(
                'SELECT * FROM sales WHERE id = $1',
                [sale_id]
            );
        }

        if (saleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        const sale = saleResult.rows[0];

        // Проверить каждую позицию
        let totalAmount = 0;
        let vatAmount = 0;

        for (const item of items) {
            if (!item.sale_item_id || !item.quantity || item.quantity <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Некорректные данные позиции возврата' });
            }

            // Получить оригинальную позицию продажи
            const saleItemResult = await client.query(
                'SELECT * FROM sale_items WHERE id = $1 AND sale_id = $2',
                [item.sale_item_id, sale_id]
            );

            if (saleItemResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Позиция ${item.sale_item_id} не найдена в продаже` });
            }

            const saleItem = saleItemResult.rows[0];

            // Проверить уже возвращенное количество
            const returnedResult = await client.query(
                `SELECT COALESCE(SUM(ri.quantity), 0) as returned
                 FROM return_items ri
                 JOIN returns r ON ri.return_id = r.id
                 WHERE ri.sale_item_id = $1 AND r.status = 'confirmed'`,
                [item.sale_item_id]
            );

            const returnedQty = parseFloat(returnedResult.rows[0].returned);
            const availableQty = parseFloat(saleItem.quantity) - returnedQty;

            if (item.quantity > availableQty) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Нельзя вернуть больше чем куплено. Доступно: ${availableQty}`
                });
            }

            // Рассчитать сумму для возврата (пропорционально)
            const itemTotal = (parseFloat(saleItem.total_amount) / parseFloat(saleItem.quantity)) * item.quantity;
            const itemVat = (parseFloat(saleItem.vat_amount) / parseFloat(saleItem.quantity)) * item.quantity;

            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const finalAmount = totalAmount;
        const documentNumber = 'RET-' + Date.now();

        // Создать документ возврата
        const returnResult = await client.query(
            `INSERT INTO returns (
                document_number, sale_id, reason, total_amount, vat_amount, final_amount, 
                status, user_id, notes, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8, $9)
            RETURNING *`,
            [documentNumber, sale_id, reason, totalAmount, vatAmount, finalAmount, req.user.id, notes, orgId]
        );

        const returnDoc = returnResult.rows[0];

        // Создать позиции возврата
        for (const item of items) {
            const saleItemResult = await client.query(
                'SELECT * FROM sale_items WHERE id = $1',
                [item.sale_item_id]
            );
            const saleItem = saleItemResult.rows[0];

            const itemTotal = (parseFloat(saleItem.total_amount) / parseFloat(saleItem.quantity)) * item.quantity;
            const itemVat = (parseFloat(saleItem.vat_amount) / parseFloat(saleItem.quantity)) * item.quantity;

            await client.query(
                `INSERT INTO return_items (
                    return_id, sale_item_id, product_id, quantity, 
                    price, vat_rate, vat_amount, total_amount, total_price, organization_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    returnDoc.id,
                    item.sale_item_id,
                    saleItem.product_id,
                    item.quantity,
                    saleItem.price,
                    saleItem.vat_rate || 0,
                    itemVat || 0,
                    itemTotal || 0,
                    itemTotal || 0,
                    orgId
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Возврат успешно создан',
            return: returnDoc
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания возврата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

/**
 * Отдельный возврат товаров (без привязки к продаже)
 */
router.post('/standalone', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { items, reason, notes } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Необходимо указать позиции для возврата' });
        }

        const orgId = req.user?.organization_id || null;

        // Проверить наличие открытой смены
        let shiftQuery, shiftParams;
        if (orgId) {
            shiftQuery = `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open' AND organization_id = $2 ORDER BY started_at DESC LIMIT 1`;
            shiftParams = [req.user.id, orgId];
        } else {
            shiftQuery = `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open' ORDER BY started_at DESC LIMIT 1`;
            shiftParams = [req.user.id];
        }
        const shiftResult = await client.query(shiftQuery, shiftParams);

        if (shiftResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Для оформления возврата необходимо открыть смену' });
        }

        const currentShiftId = shiftResult.rows[0].id;
        let totalAmount = 0;
        let vatAmount = 0;

        // Подсчитать суммы
        for (const item of items) {
            if (!item.product_id || !item.quantity || !item.price) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Каждая позиция должна содержать product_id, quantity и price' });
            }
            const itemTotal = item.quantity * item.price;
            const itemVat = itemTotal * (item.vat_rate || 0) / 100;
            totalAmount += itemTotal;
            vatAmount += itemVat;
        }

        const documentNumber = 'RET-S-' + Date.now();

        // Создать документ возврата (sale_id = NULL для standalone)
        const returnResult = await client.query(
            `INSERT INTO returns (
                document_number, sale_id, reason, total_amount, vat_amount, final_amount, 
                status, user_id, notes, organization_id
            ) VALUES ($1, NULL, $2, $3, $4, $5, 'confirmed', $6, $7, $8)
            RETURNING *`,
            [documentNumber, reason || 'Отдельный возврат', totalAmount, vatAmount, totalAmount, req.user.id, notes, orgId]
        );

        const returnDoc = returnResult.rows[0];

        // Создать позиции возврата и вернуть на склад
        for (const item of items) {
            const itemTotal = item.quantity * item.price;
            const itemVat = itemTotal * (item.vat_rate || 0) / 100;

            await client.query(
                `INSERT INTO return_items (
                    return_id, sale_item_id, product_id, quantity, 
                    price, vat_rate, vat_amount, total_amount, total_price, organization_id
                ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    returnDoc.id,
                    item.product_id,
                    item.quantity,
                    item.price,
                    item.vat_rate || 0,
                    itemVat || 0,
                    itemTotal || 0,
                    itemTotal || 0,
                    orgId
                ]
            );

            // Вернуть товар на склад
            try {
                await client.query(
                    `UPDATE products SET stock = COALESCE(stock, 0) + $1 WHERE id = $2`,
                    [item.quantity, item.product_id]
                );
            } catch (stockErr) {
                console.warn('Не удалось обновить остаток:', stockErr.message);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Отдельный возврат успешно создан',
            return: returnDoc
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания отдельного возврата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

export default router;
