import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Получить все счета-фактуры
router.get('/', async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = `SELECT i.*, c.name as counterparty_name, u.full_name as user_name
             FROM invoices i
             LEFT JOIN counterparties c ON i.counterparty_id = c.id
             LEFT JOIN users u ON i.user_id = u.id`;
        const params = [];
        if (userLicenseId) {
            query += ' WHERE i.license_id = $1';
            params.push(userLicenseId);
        }
        query += ' ORDER BY i.invoice_date DESC, i.id DESC';
        const result = await pool.query(query, params);
        res.json({ invoices: result.rows });
    } catch (error) {
        console.error('Ошибка получения счетов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить счет по ID с позициями
router.get('/:id', async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let invQuery = `SELECT i.*, c.name as counterparty_name
             FROM invoices i
             LEFT JOIN counterparties c ON i.counterparty_id = c.id
             WHERE i.id = $1`;
        const invParams = [req.params.id];
        if (userLicenseId) {
            invQuery += ' AND i.license_id = $2';
            invParams.push(userLicenseId);
        }

        const invoice = await pool.query(invQuery, invParams);

        if (invoice.rows.length === 0) {
            return res.status(404).json({ error: 'Счет не найден' });
        }

        const items = await pool.query(
            `SELECT ii.*, p.name as product_name, p.code as product_code
             FROM invoice_items ii
             LEFT JOIN products p ON ii.product_id = p.id
             WHERE ii.invoice_id = $1 AND (p.license_id = $2 OR p.id IS NULL)`,
            [req.params.id, userLicenseId]
        );

        res.json({ ...invoice.rows[0], items: items.rows });
    } catch (error) {
        console.error('Ошибка получения счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать счет
router.post('/', async (req, res) => {
    const { invoice_number, invoice_date, counterparty_id, items, total_amount, vat_amount, final_amount } = req.body;

    const client = await pool.connect();
    try {
        const userLicenseId = req.user.license_id;
        await client.query('BEGIN');

        // Verify counterparty
        if (userLicenseId) {
            const cpCheck = await client.query('SELECT 1 FROM counterparties WHERE id = $1 AND license_id = $2', [counterparty_id, userLicenseId]);
            if (cpCheck.rows.length === 0) throw new Error('Контрагент не найден в вашей организации');
        }

        const invoice = await client.query(
            `INSERT INTO invoices (invoice_number, invoice_date, counterparty_id, total_amount, vat_amount, final_amount, user_id, license_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [invoice_number, invoice_date, counterparty_id, total_amount, vat_amount, final_amount, req.user.id, userLicenseId]
        );

        for (const item of items || []) {
            await client.query(
                `INSERT INTO invoice_items (invoice_id, product_id, quantity, price, vat_rate, vat_amount, total_amount, license_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [invoice.rows[0].id, item.product_id, item.quantity, item.price, item.vat_rate || 20, item.vat_amount, item.total_amount, userLicenseId]
            );
        }

        await logAudit(req.user.id, 'CREATE', 'invoices', invoice.rows[0].id, null, invoice.rows[0], req.ip);
        await client.query('COMMIT');

        res.status(201).json(invoice.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Создать счет из продажи
router.post('/from-sale/:saleId', async (req, res) => {
    const client = await pool.connect();
    try {
        const userLicenseId = req.user.license_id;
        await client.query('BEGIN');

        const sale = await client.query('SELECT * FROM sales WHERE id = $1 AND license_id = $2', [req.params.saleId, userLicenseId]);
        if (sale.rows.length === 0) {
            return res.status(404).json({ error: 'Продажа не найдена или не принадлежит вашей организации' });
        }

        const invoiceNum = `СФ-${String(Math.floor(Math.random() * 9999)).padStart(5, '0')}`;
        const invoice = await client.query(
            `INSERT INTO invoices (invoice_number, invoice_date, counterparty_id, related_document_type, related_document_id, total_amount, vat_amount, final_amount, user_id, license_id)
             VALUES ($1, CURRENT_DATE, $2, 'sale', $3, $4, $5, $6, $7, $8) RETURNING *`,
            [invoiceNum, sale.rows[0].counterparty_id, sale.rows[0].id, sale.rows[0].total_amount, sale.rows[0].vat_amount, sale.rows[0].final_amount, req.user.id, userLicenseId]
        );

        const items = await client.query('SELECT * FROM sale_items WHERE sale_id = $1 AND license_id = $2', [req.params.saleId, userLicenseId]);

        for (const item of items.rows) {
            await client.query(
                `INSERT INTO invoice_items (invoice_id, product_id, quantity, price, vat_rate, vat_amount, total_amount, license_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [invoice.rows[0].id, item.product_id, item.quantity, item.price, item.vat_rate, item.vat_amount, item.total_amount, userLicenseId]
            );
        }

        await logAudit(req.user.id, 'CREATE', 'invoices', invoice.rows[0].id, null, invoice.rows[0], req.ip);
        await client.query('COMMIT');

        res.status(201).json(invoice.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка создания счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

// Удалить счет
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const userLicenseId = req.user.license_id;
        await client.query('BEGIN');

        const invCheck = await client.query('SELECT 1 FROM invoices WHERE id = $1 AND license_id = $2', [req.params.id, userLicenseId]);
        if (invCheck.rows.length === 0) throw new Error('Счет не найден или не принадлежит вашей организации');

        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1 AND license_id = $2', [req.params.id, userLicenseId]);
        await client.query('DELETE FROM invoices WHERE id = $1 AND license_id = $2', [req.params.id, userLicenseId]);
        await logAudit(req.user.id, 'DELETE', 'invoices', req.params.id, null, null, req.ip);
        await client.query('COMMIT');
        res.status(204).send();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления счета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

export default router;
