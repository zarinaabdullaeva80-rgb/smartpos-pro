import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Применяем аутентификацию ко всем маршрутам
router.use(authenticateToken);

// ============================================
// BANK ACCOUNTS / CASH REGISTERS
// ============================================

// Получить все счета и кассы
router.get('/accounts', async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = 'SELECT * FROM bank_accounts';
        const params = [];
        if (userLicenseId) {
            query += ' WHERE license_id = $1';
            params.push(userLicenseId);
        }
        query += ' ORDER BY type, name';
        const result = await pool.query(query, params);
        res.json({ accounts: result.rows });
    } catch (error) {
        console.error('Ошибка получения счетов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить счет по ID
router.get('/accounts/:id', async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = 'SELECT * FROM bank_accounts WHERE id = $1';
        const params = [req.params.id];
        if (userLicenseId) {
            query += ' AND license_id = $2';
            params.push(userLicenseId);
        }
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Счет не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый счет/кассу
router.post('/accounts', async (req, res) => {
    const { code, name, type, account_number, bank_name, currency, balance } = req.body;

    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `INSERT INTO bank_accounts 
             (code, name, type, account_number, bank_name, currency, balance, license_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [code, name, type, account_number, bank_name, currency || 'RUB', balance || 0, userLicenseId]
        );

        await logAudit(req.user.id, 'CREATE', 'bank_accounts', result.rows[0].id, null, result.rows[0], req.ip);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка создания счета:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Счет с таким кодом уже существует' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить счет
router.put('/accounts/:id', async (req, res) => {
    const { code, name, type, account_number, bank_name, currency, is_active } = req.body;

    try {
        const oldResult = await pool.query('SELECT * FROM bank_accounts WHERE id = $1', [req.params.id]);

        const userLicenseId = req.user.license_id;
        let updateQuery = `UPDATE bank_accounts 
             SET code = $1, name = $2, type = $3, account_number = $4, 
                 bank_name = $5, currency = $6, is_active = $7
             WHERE id = $8`;
        const updateParams = [code, name, type, account_number, bank_name, currency, is_active, req.params.id];
        if (userLicenseId) {
            updateQuery += ' AND license_id = $9';
            updateParams.push(userLicenseId);
        }
        updateQuery += ' RETURNING *';
        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Счет не найден' });
        }

        await logAudit(req.user.id, 'UPDATE', 'bank_accounts', req.params.id, oldResult.rows[0], result.rows[0], req.ip);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить счет
router.delete('/accounts/:id', async (req, res) => {
    try {
        // Проверяем, есть ли платежи по этому счету
        const paymentsCheck = await pool.query(
            'SELECT COUNT(*) FROM payments WHERE bank_account_id = $1',
            [req.params.id]
        );

        if (parseInt(paymentsCheck.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Невозможно удалить счет, по которому есть платежи'
            });
        }

        const userLicenseId = req.user.license_id;
        let deleteQuery = 'DELETE FROM bank_accounts WHERE id = $1';
        const deleteParams = [req.params.id];
        if (userLicenseId) {
            deleteQuery += ' AND license_id = $2';
            deleteParams.push(userLicenseId);
        }
        await pool.query(deleteQuery, deleteParams);
        await logAudit(req.user.id, 'DELETE', 'bank_accounts', req.params.id, null, null, req.ip);

        res.status(204).send();
    } catch (error) {
        console.error('Ошибка удаления счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// PAYMENTS
// ============================================

// Получить все платежи с фильтрацией
router.get('/payments', async (req, res) => {
    const { dateFrom, dateTo, type, counterparty_id, status } = req.query;

    try {
        const userLicenseId = req.user.license_id;
        let query = `
            SELECT p.*, 
                   c.name as counterparty_name,
                   ba.name as bank_account_name,
                   ba.type as bank_account_type,
                   u.full_name as user_name
            FROM payments p
            LEFT JOIN counterparties c ON p.counterparty_id = c.id
            LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND p.license_id = $${paramCount}`;
            params.push(userLicenseId);
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

        if (type) {
            query += ` AND p.payment_type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }

        if (counterparty_id) {
            query += ` AND p.counterparty_id = $${paramCount}`;
            params.push(counterparty_id);
            paramCount++;
        }

        if (status) {
            query += ` AND p.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        query += ' ORDER BY p.document_date DESC, p.id DESC';

        const result = await pool.query(query, params);
        res.json({ payments: result.rows });
    } catch (error) {
        console.error('Ошибка получения платежей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить платеж по ID
router.get('/payments/:id', async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = `SELECT p.*, 
                    c.name as counterparty_name,
                    ba.name as bank_account_name,
                    u.full_name as user_name
             FROM payments p
             LEFT JOIN counterparties c ON p.counterparty_id = c.id
             LEFT JOIN bank_accounts ba ON p.bank_account_id = ba.id
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.id = $1`;
        const params = [req.params.id];
        if (userLicenseId) {
            query += ' AND p.license_id = $2';
            params.push(userLicenseId);
        }
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платеж не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения платежа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый платеж
router.post('/payments', async (req, res) => {
    const {
        document_number,
        document_date,
        payment_type,
        counterparty_id,
        bank_account_id,
        amount,
        currency,
        purpose,
        related_document_type,
        related_document_id
    } = req.body;

    try {
        const userLicenseId = req.user.license_id;

        // Verify entities belong to license
        if (userLicenseId) {
            if (counterparty_id) {
                const cCheck = await pool.query('SELECT 1 FROM counterparties WHERE id = $1 AND license_id = $2', [counterparty_id, userLicenseId]);
                if (cCheck.rows.length === 0) throw new Error('Контрагент не найден в вашей организации');
            }
            if (bank_account_id) {
                const bCheck = await pool.query('SELECT 1 FROM bank_accounts WHERE id = $1 AND license_id = $2', [bank_account_id, userLicenseId]);
                if (bCheck.rows.length === 0) throw new Error('Счет не найден в вашей организации');
            }
        }

        const result = await pool.query(
            `INSERT INTO payments 
             (document_number, document_date, payment_type, counterparty_id, 
              bank_account_id, amount, currency, purpose, related_document_type, 
              related_document_id, status, user_id, license_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12) 
             RETURNING *`,
            [
                document_number,
                document_date,
                payment_type,
                counterparty_id,
                bank_account_id,
                amount,
                currency || 'RUB',
                purpose,
                related_document_type,
                related_document_id,
                req.user.id,
                userLicenseId
            ]
        );

        await logAudit(req.user.id, 'CREATE', 'payments', result.rows[0].id, null, result.rows[0], req.ip);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка создания платежа:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Платеж с таким номером уже существует' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить платеж
router.put('/payments/:id', async (req, res) => {
    const {
        document_number,
        document_date,
        payment_type,
        counterparty_id,
        bank_account_id,
        amount,
        currency,
        purpose
    } = req.body;

    try {
        const oldResult = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);

        if (oldResult.rows[0]?.status === 'confirmed') {
            return res.status(400).json({ error: 'Нельзя изменить проведенный платеж' });
        }

        const userLicenseId = req.user.license_id;

        // Verify entities belong to license
        if (userLicenseId) {
            if (counterparty_id) {
                const cCheck = await pool.query('SELECT 1 FROM counterparties WHERE id = $1 AND license_id = $2', [counterparty_id, userLicenseId]);
                if (cCheck.rows.length === 0) throw new Error('Контрагент не найден в вашей организации');
            }
            if (bank_account_id) {
                const bCheck = await pool.query('SELECT 1 FROM bank_accounts WHERE id = $1 AND license_id = $2', [bank_account_id, userLicenseId]);
                if (bCheck.rows.length === 0) throw new Error('Счет не найден в вашей организации');
            }
        }

        let updateQuery = `UPDATE payments 
             SET document_number = $1, document_date = $2, payment_type = $3, 
                 counterparty_id = $4, bank_account_id = $5, amount = $6, 
                 currency = $7, purpose = $8
             WHERE id = $9`;
        const updateParams = [document_number, document_date, payment_type, counterparty_id, bank_account_id, amount, currency, purpose, req.params.id];

        if (userLicenseId) {
            updateQuery += ' AND license_id = $10';
            updateParams.push(userLicenseId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платеж не найден' });
        }

        await logAudit(req.user.id, 'UPDATE', 'payments', req.params.id, oldResult.rows[0], result.rows[0], req.ip);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления платежа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Провести платеж (подтвердить и обновить баланс)
router.post('/payments/:id/confirm', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Получаем платеж
        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE id = $1',
            [req.params.id]
        );

        if (paymentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Платеж не найден' });
        }

        const payment = paymentResult.rows[0];

        if (payment.status === 'confirmed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Платеж уже проведен' });
        }

        // Обновляем баланс счета
        const balanceChange = payment.payment_type === 'incoming' ? payment.amount : -payment.amount;

        await client.query(
            'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
            [balanceChange, payment.bank_account_id]
        );

        // Создаем финансовую проводку
        const debitAccount = payment.payment_type === 'incoming' ? '50.01' : '62.01';
        const creditAccount = payment.payment_type === 'incoming' ? '62.01' : '50.01';

        await client.query(
            `INSERT INTO transactions 
             (transaction_date, debit_account, credit_account, amount, description, 
              document_type, document_id, user_id, license_id) 
             VALUES ($1, $2, $3, $4, $5, 'payment', $6, $7, $8)`,
            [
                payment.document_date,
                debitAccount,
                creditAccount,
                payment.amount,
                payment.purpose,
                payment.id,
                req.user.id,
                payment.license_id
            ]
        );

        // Обновляем статус платежа
        const result = await client.query(
            'UPDATE payments SET status = $1 WHERE id = $2 RETURNING *',
            ['confirmed', req.params.id]
        );

        await logAudit(req.user.id, 'CONFIRM', 'payments', req.params.id, payment, result.rows[0], req.ip);

        await client.query('COMMIT');

        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка проведения платежа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Удалить платеж
router.delete('/payments/:id', async (req, res) => {
    try {
        const payment = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);

        if (payment.rows[0]?.status === 'confirmed') {
            return res.status(400).json({ error: 'Нельзя удалить проведенный платеж' });
        }

        const userLicenseId = req.user.license_id;
        let query = 'DELETE FROM payments WHERE id = $1';
        const params = [req.params.id];
        if (userLicenseId) {
            query += ' AND license_id = $2';
            params.push(userLicenseId);
        }
        await pool.query(query, params);
        await logAudit(req.user.id, 'DELETE', 'payments', req.params.id, null, null, req.ip);

        res.status(204).send();
    } catch (error) {
        console.error('Ошибка удаления платежа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// TRANSACTIONS (ПРОВОДКИ)
// ============================================

// Получить все транзакции с фильтрацией
router.get('/transactions', async (req, res) => {
    const { dateFrom, dateTo, account } = req.query;

    try {
        const userLicenseId = req.user.license_id;
        let query = `
            SELECT t.*, u.full_name as user_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND t.license_id = $${paramCount}`;
            params.push(userLicenseId);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND t.transaction_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND t.transaction_date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        if (account) {
            query += ` AND (t.debit_account = $${paramCount} OR t.credit_account = $${paramCount})`;
            params.push(account);
            paramCount++;
        }

        query += ' ORDER BY t.transaction_date DESC, t.id DESC';

        const result = await pool.query(query, params);
        res.json({ transactions: result.rows });
    } catch (error) {
        console.error('Ошибка получения транзакций:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// ФИНАНСОВЫЕ ОТЧЁТЫ (Фаза 10)
// ============================================

// Детализированный P&L
router.get('/profit-loss-detailed', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        const userLicenseId = req.user.license_id;
        let salesQuery = `SELECT COALESCE(SUM(total_amount), 0) as revenue FROM sales WHERE status = 'confirmed' AND document_date BETWEEN $1 AND $2`;
        let cogsQuery = `
            SELECT COALESCE(SUM(si.quantity * COALESCE(p.price_purchase, 0)), 0) as cogs
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            WHERE s.status = 'confirmed' AND s.document_date BETWEEN $1 AND $2
        `;

        const salesParams = [sd, ed];
        const cogsParams = [sd, ed];

        if (userLicenseId) {
            salesQuery += ' AND license_id = $3';
            salesParams.push(userLicenseId);
            cogsQuery += ' AND s.license_id = $3';
            cogsParams.push(userLicenseId);
        }

        const salesResult = await pool.query(salesQuery, salesParams);
        const cogsResult = await pool.query(cogsQuery, cogsParams);

        const revenue = parseFloat(salesResult.rows[0].revenue);
        const cogs = parseFloat(cogsResult.rows[0].cogs);
        const grossProfit = revenue - cogs;

        res.json({
            period: { startDate: sd, endDate: ed },
            revenue: revenue.toFixed(2),
            costOfGoods: cogs.toFixed(2),
            grossProfit: grossProfit.toFixed(2),
            grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(2) : '0.00',
            netProfit: grossProfit.toFixed(2)
        });
    } catch (error) {
        console.error('Error generating P&L:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Cash Flow
router.get('/cash-flow', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        const userLicenseId = req.user.license_id;
        let inQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'incoming' AND status = 'confirmed' AND document_date BETWEEN $1 AND $2`;
        let outQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'outgoing' AND status = 'confirmed' AND document_date BETWEEN $1 AND $2`;

        const inParams = [sd, ed];
        const outParams = [sd, ed];

        if (userLicenseId) {
            inQuery += ' AND license_id = $3';
            inParams.push(userLicenseId);
            outQuery += ' AND license_id = $3';
            outParams.push(userLicenseId);
        }

        const incomingResult = await pool.query(inQuery, inParams);
        const outgoingResult = await pool.query(outQuery, outParams);

        const inflow = parseFloat(incomingResult.rows[0].total);
        const outflow = parseFloat(outgoingResult.rows[0].total);

        res.json({
            period: { startDate: sd, endDate: ed },
            operating: { inflow: inflow.toFixed(2), outflow: outflow.toFixed(2), net: (inflow - outflow).toFixed(2) },
            netCashFlow: (inflow - outflow).toFixed(2)
        });
    } catch (error) {
        console.error('Error generating cash flow:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Анализ рентабельности
router.get('/profitability', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        const salesResult = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as revenue
            FROM sales WHERE status = 'confirmed' AND document_date BETWEEN $1 AND $2
        `, [sd, ed]);

        const cogsResult = await pool.query(`
            SELECT COALESCE(SUM(si.quantity * COALESCE(p.price_purchase, 0)), 0) as cogs
            FROM sale_items si JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            WHERE s.status = 'confirmed' AND s.document_date BETWEEN $1 AND $2
        `, [sd, ed]);

        const revenue = parseFloat(salesResult.rows[0].revenue);
        const cogs = parseFloat(cogsResult.rows[0].cogs);
        const netProfit = revenue - cogs;

        res.json([{
            period: { startDate: sd, endDate: ed },
            revenue: revenue.toFixed(2),
            costOfGoods: cogs.toFixed(2),
            grossProfit: netProfit.toFixed(2),
            grossMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : '0.00',
            roi: cogs > 0 ? ((netProfit / cogs) * 100).toFixed(2) : '0.00'
        }]);
    } catch (error) {
        console.error('Error calculating profitability:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// КРЕДИТОРСКАЯ ЗАДОЛЖЕННОСТЬ (Payables)
// ============================================

// GET /finance/payables - задолженность перед поставщиками
router.get('/payables', async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const today = new Date().toISOString().split('T')[0];

        // Агрегируем по поставщикам из закупок (неоплаченные)
        let query = `
            SELECT
                c.id,
                c.name,
                c.inn,
                c.phone,
                COALESCE(SUM(p.total_amount), 0) AS total,
                COALESCE(SUM(CASE WHEN p.due_date < $1 THEN p.total_amount ELSE 0 END), 0) AS overdue,
                MAX(CASE WHEN p.due_date < $1 THEN ($1::date - p.due_date::date) ELSE 0 END) AS days,
                MIN(p.due_date) AS due_date,
                CASE
                    WHEN MAX(CASE WHEN p.due_date < $1 THEN ($1::date - p.due_date::date) ELSE 0 END) > 14 THEN 'critical'
                    WHEN COALESCE(SUM(CASE WHEN p.due_date < $1 THEN p.total_amount ELSE 0 END), 0) > 0 THEN 'overdue'
                    ELSE 'ok'
                END AS status
            FROM purchases p
            JOIN counterparties c ON p.counterparty_id = c.id
            WHERE p.status NOT IN ('paid', 'cancelled')
        `;
        const params = [today];
        if (licenseId) {
            query += ' AND p.license_id = $2';
            params.push(licenseId);
        }
        query += ' GROUP BY c.id, c.name, c.inn, c.phone ORDER BY overdue DESC, total DESC';

        const result = await pool.query(query, params);
        const creditors = result.rows;

        const totalSum = creditors.reduce((s, r) => s + parseFloat(r.total), 0);
        const overdueSum = creditors.reduce((s, r) => s + parseFloat(r.overdue), 0);

        res.json({
            creditors,
            stats: {
                total: totalSum,
                overdue: overdueSum,
                overdue_percent: totalSum > 0 ? Math.round((overdueSum / totalSum) * 100) : 0,
                creditors_count: creditors.length,
                due_this_week: creditors.filter(c => {
                    const diff = Math.ceil((new Date(c.due_date) - new Date()) / 86400000);
                    return diff >= 0 && diff <= 7;
                }).length
            }
        });
    } catch (error) {
        console.error('Ошибка получения кредиторской задолженности:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /finance/payables/:id/payment - записать оплату поставщику
router.post('/payables/:creditorId/payment', async (req, res) => {
    try {
        const { amount } = req.body;
        const licenseId = req.user.license_id;
        const { creditorId } = req.params;

        // Обновляем статус закупок (самую старую сначала)
        let query = `
            UPDATE purchases SET status = 'paid'
            WHERE counterparty_id = $1 AND status NOT IN ('paid', 'cancelled')
        `;
        const params = [creditorId];
        if (licenseId) {
            query += ' AND license_id = $2';
            params.push(licenseId);
        }
        await pool.query(query, params);
        await logAudit(req.user.id, 'PAYMENT', 'purchases', creditorId, null, { amount }, req.ip);

        res.json({ success: true, message: `Оплата ${amount} записана` });
    } catch (error) {
        console.error('Ошибка записи оплаты поставщику:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// ДЕБИТОРСКАЯ ЗАДОЛЖЕННОСТЬ (Receivables)
// ============================================

// GET /finance/receivables - задолженность покупателей перед нами
router.get('/receivables', async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const today = new Date().toISOString().split('T')[0];

        // Агрегируем по покупателям из продаж (неоплаченные)
        let query = `
            SELECT
                c.id,
                c.name,
                c.inn,
                c.phone,
                c.email,
                COALESCE(SUM(s.total_amount), 0) AS total,
                COALESCE(SUM(CASE WHEN s.due_date < $1 THEN s.total_amount ELSE 0 END), 0) AS overdue,
                MAX(CASE WHEN s.due_date < $1 THEN ($1::date - s.due_date::date) ELSE 0 END) AS days,
                MAX(s.document_date) AS last_payment,
                CASE
                    WHEN MAX(CASE WHEN s.due_date < $1 THEN ($1::date - s.due_date::date) ELSE 0 END) > 30 THEN 'critical'
                    WHEN COALESCE(SUM(CASE WHEN s.due_date < $1 THEN s.total_amount ELSE 0 END), 0) > 0 THEN 'overdue'
                    ELSE 'ok'
                END AS status
            FROM sales s
            JOIN counterparties c ON s.customer_id = c.id
            WHERE s.status = 'confirmed' AND s.payment_status NOT IN ('paid', 'cancelled')
              AND s.customer_id IS NOT NULL
        `;
        const params = [today];
        if (licenseId) {
            query += ' AND s.license_id = $2';
            params.push(licenseId);
        }
        query += ' GROUP BY c.id, c.name, c.inn, c.phone, c.email ORDER BY overdue DESC, total DESC';

        const result = await pool.query(query, params);
        const debtors = result.rows;

        const totalSum = debtors.reduce((s, r) => s + parseFloat(r.total), 0);
        const overdueSum = debtors.reduce((s, r) => s + parseFloat(r.overdue), 0);

        res.json({
            debtors,
            stats: {
                total: totalSum,
                overdue: overdueSum,
                overdue_percent: totalSum > 0 ? Math.round((overdueSum / totalSum) * 100) : 0,
                debtors_count: debtors.length,
                critical: debtors.filter(d => d.status === 'critical').length
            }
        });
    } catch (error) {
        console.error('Ошибка получения дебиторской задолженности:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /finance/receivables/:id/payment - записать поступление от покупателя
router.post('/receivables/:debtorId/payment', async (req, res) => {
    try {
        const { amount } = req.body;
        const licenseId = req.user.license_id;
        const { debtorId } = req.params;

        let query = `
            UPDATE sales SET payment_status = 'paid'
            WHERE customer_id = $1 AND status = 'confirmed'
              AND payment_status NOT IN ('paid', 'cancelled')
        `;
        const params = [debtorId];
        if (licenseId) {
            query += ' AND license_id = $2';
            params.push(licenseId);
        }
        await pool.query(query, params);
        await logAudit(req.user.id, 'PAYMENT', 'sales', debtorId, null, { amount }, req.ip);

        res.json({ success: true, message: `Платёж ${amount} записан` });
    } catch (error) {
        console.error('Ошибка записи платежа от покупателя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// GET /finance/receivables/reconciliation-report - акт сверки
router.get('/receivables/reconciliation-report', async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const today = new Date().toLocaleDateString('ru-RU');
        let query = `
            SELECT c.name, SUM(s.total_amount) as total
            FROM sales s
            JOIN counterparties c ON s.customer_id = c.id
            WHERE s.status = 'confirmed' AND s.payment_status NOT IN ('paid', 'cancelled')
        `;
        const params = [];
        if (licenseId) {
            query += ' AND s.license_id = $1';
            params.push(licenseId);
        }
        query += ' GROUP BY c.name ORDER BY total DESC';
        const result = await pool.query(query, params);

        let text = `АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ\nДата: ${today}\n\n`;
        result.rows.forEach(r => {
            text += `${r.name}: ${parseFloat(r.total).toLocaleString('ru-RU')} сум\n`;
        });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="act_sverki_${Date.now()}.txt"`);
        res.send(text);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;

