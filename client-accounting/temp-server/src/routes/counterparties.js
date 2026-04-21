import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Получение всех контрагентов
router.get('/', authenticate, async (req, res) => {
    try {
        const { type, search, isActive } = req.query;

        const orgId = req.user?.organization_id;
        let query = `
      SELECT * FROM counterparties
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 1;

        if (orgId) {
            query += ` AND organization_id = $${paramCount}`;
            params.push(orgId);
            paramCount++;
        }

        if (type) {
            query += ` AND (type = $${paramCount} OR type = 'both')`;
            params.push(type);
            paramCount++;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR inn ILIKE $${paramCount} OR code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (isActive !== undefined) {
            query += ` AND is_active = $${paramCount}`;
            params.push(isActive === 'true');
            paramCount++;
        }

        query += ' ORDER BY name ASC';

        const result = await pool.query(query, params);
        res.json({ counterparties: result.rows });
    } catch (error) {
        console.error('Ошибка получения контрагентов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение контрагента по ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let query = 'SELECT * FROM counterparties WHERE id = $1';
        const params = [req.params.id];

        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Контрагент не найден' });
        }

        res.json({ counterparty: result.rows[0] });
    } catch (error) {
        console.error('Ошибка получения контрагента:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// История операций контрагента
router.get('/:id/history', authenticate, async (req, res) => {
    try {
        const counterpartyId = req.params.id;
        const { dateFrom, dateTo, limit = 50 } = req.query;

        const orgId = req.user?.organization_id;

        // Verify counterparty belongs to license
        if (orgId) {
            const cpCheck = await pool.query('SELECT 1 FROM counterparties WHERE id = $1 AND organization_id = $2', [counterpartyId, orgId]);
            if (cpCheck.rows.length === 0) return res.status(404).json({ error: 'Контрагент не найден' });
        }

        let baseParamCount = 1;
        const queryParams = [counterpartyId];

        if (orgId) {
            baseParamCount++;
            queryParams.push(orgId);
        }

        // Продажи
        let salesQuery = `
      SELECT 
        'sale' as type,
        s.id,
        s.document_number,
        s.document_date,
        s.final_amount as amount,
        s.status,
        'Продажа' as type_label
      FROM sales s
      WHERE s.counterparty_id = $1
    `;
        if (orgId) salesQuery += ` AND s.organization_id = $${baseParamCount}`;

        // Закупки
        let purchasesQuery = `
      SELECT 
        'purchase' as type,
        p.id,
        p.document_number,
        p.document_date,
        p.final_amount as amount,
        p.status,
        'Закупка' as type_label
      FROM purchases p
      WHERE p.counterparty_id = $1
    `;
        if (orgId) purchasesQuery += ` AND p.organization_id = $${baseParamCount}`;

        // Платежи
        let paymentsQuery = `
      SELECT 
        'payment' as type,
        pm.id,
        pm.document_number,
        pm.document_date,
        pm.amount,
        pm.status,
        CASE 
          WHEN pm.payment_type = 'incoming' THEN 'Поступление'
          ELSE 'Списание'
        END as type_label
      FROM payments pm
      WHERE pm.counterparty_id = $1
    `;
        if (orgId) paymentsQuery += ` AND pm.organization_id = $${baseParamCount}`;

        let currentParamIndex = baseParamCount + 1;

        if (dateFrom) {
            salesQuery += ` AND s.document_date >= $${currentParamIndex}`;
            purchasesQuery += ` AND p.document_date >= $${currentParamIndex}`;
            paymentsQuery += ` AND pm.document_date >= $${currentParamIndex}`;
            queryParams.push(dateFrom);
            currentParamIndex++;
        }

        if (dateTo) {
            salesQuery += ` AND s.document_date <= $${currentParamIndex}`;
            purchasesQuery += ` AND p.document_date <= $${currentParamIndex}`;
            paymentsQuery += ` AND pm.document_date <= $${currentParamIndex}`;
            queryParams.push(dateTo);
            currentParamIndex++;
        }

        const unionQuery = `
      (${salesQuery})
      UNION ALL
      (${purchasesQuery})
      UNION ALL
      (${paymentsQuery})
      ORDER BY document_date DESC, id DESC
      LIMIT $${currentParamIndex}
    `;

        queryParams.push(limit);

        const result = await pool.query(unionQuery, queryParams);
        res.json({ history: result.rows });
    } catch (error) {
        console.error('Ошибка получения истории:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Баланс взаиморасчетов контрагента
router.get('/:id/balance', authenticate, async (req, res) => {
    try {
        const counterpartyId = req.params.id;
        const orgId = req.user?.organization_id;

        // Verify counterparty belongs to license
        if (orgId) {
            const cpCheck = await pool.query('SELECT 1 FROM counterparties WHERE id = $1 AND organization_id = $2', [counterpartyId, orgId]);
            if (cpCheck.rows.length === 0) return res.status(404).json({ error: 'Контрагент не найден' });
        }

        // Продажи (дебиторская задолженность)
        let sQuery = `SELECT 
        COALESCE(SUM(final_amount), 0) as total_sales,
        COUNT(*) as sales_count
      FROM sales
      WHERE counterparty_id = $1 AND status != 'draft'`;
        const sParams = [counterpartyId];
        if (orgId) {
            sQuery += ' AND organization_id = $2';
            sParams.push(orgId);
        }
        const salesResult = await pool.query(sQuery, sParams);

        // Закупки (кредиторская задолженность)
        let prQuery = `SELECT 
        COALESCE(SUM(final_amount), 0) as total_purchases,
        COUNT(*) as purchases_count
      FROM purchases
      WHERE counterparty_id = $1 AND status != 'draft'`;
        const prParams = [counterpartyId];
        if (orgId) {
            prQuery += ' AND organization_id = $2';
            prParams.push(orgId);
        }
        const purchasesResult = await pool.query(prQuery, prParams);

        // Платежи
        let pyQuery = `SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'incoming' THEN amount ELSE 0 END), 0) as incoming_payments,
        COALESCE(SUM(CASE WHEN payment_type = 'outgoing' THEN amount ELSE 0 END), 0) as outgoing_payments
      FROM payments
      WHERE counterparty_id = $1 AND status = 'confirmed'`;
        // if (orgId) pyQuery += ' AND organization_id = $2';
        const paymentsResult = await pool.query(pyQuery, [counterpartyId]);

        const sales = salesResult.rows[0];
        const purchases = purchasesResult.rows[0];
        const payments = paymentsResult.rows[0];

        // Расчет задолженностей
        const receivable = parseFloat(sales.total_sales) - parseFloat(payments.incoming_payments);
        const payable = parseFloat(purchases.total_purchases) - parseFloat(payments.outgoing_payments);
        const netBalance = receivable - payable;

        res.json({
            balance: {
                totalSales: parseFloat(sales.total_sales),
                totalPurchases: parseFloat(purchases.total_purchases),
                incomingPayments: parseFloat(payments.incoming_payments),
                outgoingPayments: parseFloat(payments.outgoing_payments),
                receivable, // дебиторская задолженность (нам должны)
                payable, // кредиторская задолженность (мы должны)
                netBalance, // чистый баланс
                salesCount: parseInt(sales.sales_count),
                purchasesCount: parseInt(purchases.purchases_count)
            }
        });
    } catch (error) {
        console.error('Ошибка получения баланса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание контрагента
router.post('/', authenticate, authorize('Администратор', 'Бухгалтер', 'Менеджер'), async (req, res) => {
    try {
        const {
            code, name, type, inn, kpp, address, phone, email,
            contactPerson, paymentTerms, creditLimit
        } = req.body;

        const orgId = req.user?.organization_id;

        const result = await pool.query(
            `INSERT INTO counterparties (code, name, type, inn, kpp, address, phone, email, contact_person, payment_terms, credit_limit, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
            [code, name, type, inn, kpp, address, phone, email, contactPerson, paymentTerms || 0, creditLimit || 0, orgId]
        );

        await logAudit(req.user.id, 'CREATE', 'counterparties', result.rows[0].id, null, result.rows[0], req.ip);

        res.status(201).json({ message: 'Контрагент создан', counterparty: result.rows[0] });
    } catch (error) {
        console.error('Ошибка создания контрагента:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Контрагент с таким кодом уже существует' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление контрагента
router.put('/:id', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    try {
        const {
            code, name, type, inn, kpp, address, phone, email,
            contactPerson, paymentTerms, creditLimit, isActive
        } = req.body;

        const orgId = req.user?.organization_id;
        let query = `UPDATE counterparties 
       SET code = $1, name = $2, type = $3, inn = $4, kpp = $5, address = $6,
           phone = $7, email = $8, contact_person = $9, payment_terms = $10,
           credit_limit = $11, is_active = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13`;
        const params = [code, name, type, inn, kpp, address, phone, email, contactPerson,
            paymentTerms, creditLimit, isActive, req.params.id];

        if (orgId) {
            query += ' AND organization_id = $14';
            params.push(orgId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Контрагент не найден' });
        }

        await logAudit(req.user.id, 'UPDATE', 'counterparties', req.params.id, null, result.rows[0], req.ip);

        res.json({ message: 'Контрагент обновлен', counterparty: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления контрагента:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Контрагент с таким кодом уже существует' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление контрагента
router.delete('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        // Проверка наличия связанных документов
        const salesCheck = await pool.query(
            'SELECT COUNT(*) as count FROM sales WHERE counterparty_id = $1',
            [req.params.id]
        );

        const purchasesCheck = await pool.query(
            'SELECT COUNT(*) as count FROM purchases WHERE counterparty_id = $1',
            [req.params.id]
        );

        if (parseInt(salesCheck.rows[0].count) > 0 || parseInt(purchasesCheck.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Нельзя удалить контрагента с существующими документами. Деактивируйте его вместо этого.'
            });
        }

        const orgId = req.user?.organization_id;
        let query = 'DELETE FROM counterparties WHERE id = $1';
        const params = [req.params.id];
        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }
        await pool.query(query, params);
        await logAudit(req.user.id, 'DELETE', 'counterparties', req.params.id, null, null, req.ip);

        res.json({ message: 'Контрагент удален' });
    } catch (error) {
        console.error('Ошибка удаления контрагента:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Статистика по контрагенту
router.get('/:id/stats', authenticate, async (req, res) => {
    try {
        const counterpartyId = req.params.id;

        // Топ проданных товаров этому контрагенту
        const topProductsResult = await pool.query(
            `SELECT 
        p.name,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_amount) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.counterparty_id = $1 AND s.status != 'draft'
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC
      LIMIT 10`,
            [counterpartyId]
        );

        // Динамика продаж по месяцам
        const salesTrendResult = await pool.query(
            `SELECT 
        DATE_TRUNC('month', document_date) as month,
        COUNT(*) as sales_count,
        SUM(final_amount) as total_amount
      FROM sales
      WHERE counterparty_id = $1 AND status != 'draft'
      GROUP BY DATE_TRUNC('month', document_date)
      ORDER BY month DESC
      LIMIT 12`,
            [counterpartyId]
        );

        res.json({
            stats: {
                topProducts: topProductsResult.rows,
                salesTrend: salesTrendResult.rows
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
