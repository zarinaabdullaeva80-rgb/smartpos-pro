import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper: get organization_id for multi-tenant filtering
 */
function getOrgId(req) {
    return req.user?.organization_id || req.organizationId || null;
}

// Получить всех клиентов
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, limit = 100 } = req.query;

        const orgId = getOrgId(req);

        let query = `
            SELECT id, name, phone, email, discount, loyalty_points, notes, card_number, created_at
            FROM customers
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (orgId) {
            query += ` AND organization_id = $${paramIndex++}`;
            params.push(orgId);
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY name ASC LIMIT ${parseInt(limit)}`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            customers: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('[Customers] GET error:', error);
        res.status(500).json({ error: 'Ошибка загрузки клиентов', details: error.message });
    }
});

// Получить клиента по ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = getOrgId(req);
        let query = 'SELECT * FROM customers WHERE id = $1';
        const params = [id];

        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        res.json({ success: true, customer: result.rows[0] });
    } catch (error) {
        console.error('[Customers] GET by ID error:', error);
        res.status(500).json({ error: 'Ошибка загрузки клиента' });
    }
});

// Генерация номера карты лояльности (Luhn)
function generateCardNumber(customerId) {
    const prefix = '7777';
    const paddedId = String(customerId).padStart(8, '0');
    let sum = 0;
    let alternate = false;
    const number = prefix + paddedId;
    for (let i = number.length - 1; i >= 0; i--) {
        let n = parseInt(number.charAt(i), 10);
        if (alternate) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alternate = !alternate;
    }
    return number + String((10 - (sum % 10)) % 10);
}

// Создать нового клиента (с автоматической генерацией карты лояльности)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, phone, email, discount = 0, notes, loyalty_points } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Имя обязательно' });
        }

        const orgId = getOrgId(req);

        // Получить welcome_bonus из настроек лояльности
        let welcomeBonus = parseInt(loyalty_points) || 0;
        try {
            const settingsRes = await pool.query('SELECT welcome_bonus FROM loyalty_settings WHERE id = 1');
            if (settingsRes.rows.length > 0 && settingsRes.rows[0].welcome_bonus && welcomeBonus === 0) {
                welcomeBonus = parseInt(settingsRes.rows[0].welcome_bonus) || 0;
            }
        } catch (e) { /* таблица может не существовать */ }

        const result = await pool.query(
            `INSERT INTO customers (name, phone, email, discount, loyalty_points, notes, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, phone || null, email || null, parseFloat(discount) || 0, welcomeBonus, notes || null, orgId || 1]
        );

        const customer = result.rows[0];

        // Авто-генерация номера карты лояльности
        const cardNumber = generateCardNumber(customer.id);
        await pool.query('UPDATE customers SET card_number = $1 WHERE id = $2', [cardNumber, customer.id]);
        customer.card_number = cardNumber;

        // Записать транзакцию welcome_bonus если есть
        if (welcomeBonus > 0) {
            try {
                await pool.query(
                    `INSERT INTO loyalty_transactions (customer_id, type, points, description, created_by)
                     VALUES ($1, 'earn', $2, 'Приветственный бонус', $3)`,
                    [customer.id, welcomeBonus, req.user.id]
                );
            } catch (e) { /* таблица может не существовать */ }
        }

        console.log(`[Customers] Created customer ${customer.id} with card ${cardNumber}, welcome bonus: ${welcomeBonus}`);

        res.status(201).json({
            success: true,
            message: 'Клиент создан',
            customer
        });
    } catch (error) {
        console.error('[Customers] POST error:', error);
        res.status(500).json({ error: 'Ошибка создания клиента', details: error.message });
    }
});

// Обновить клиента
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, discount, notes } = req.body;

        const orgId = getOrgId(req);

        let updateQuery = `UPDATE customers 
             SET name = COALESCE($1, name),
                 phone = COALESCE($2, phone),
                 email = COALESCE($3, email),
                 discount = COALESCE($4, discount),
                 notes = COALESCE($5, notes),
                 updated_at = NOW()
             WHERE id = $6`;
        const updateParams = [name, phone, email, discount !== undefined ? parseFloat(discount) : null, notes, id];

        if (orgId) {
            updateQuery += ' AND organization_id = $7';
            updateParams.push(orgId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        res.json({
            success: true,
            message: 'Клиент обновлён',
            customer: result.rows[0]
        });
    } catch (error) {
        console.error('[Customers] PUT error:', error);
        res.status(500).json({ error: 'Ошибка обновления клиента' });
    }
});

// Удалить клиента
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const orgId = getOrgId(req);
        let deleteQuery = 'DELETE FROM customers WHERE id = $1';
        const deleteParams = [id];

        if (orgId) {
            deleteQuery += ' AND organization_id = $2';
            deleteParams.push(orgId);
        }
        deleteQuery += ' RETURNING id';

        const result = await pool.query(deleteQuery, deleteParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        res.json({ success: true, message: 'Клиент удалён' });
    } catch (error) {
        console.error('[Customers] DELETE error:', error);
        res.status(500).json({ error: 'Ошибка удаления клиента' });
    }
});

// Получить баллы лояльности
router.get('/:id/loyalty', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = getOrgId(req);
        let query = 'SELECT loyalty_points FROM customers WHERE id = $1';
        const params = [id];

        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        res.json({
            success: true,
            loyalty_points: result.rows[0].loyalty_points || 0
        });
    } catch (error) {
        console.error('[Customers] loyalty error:', error);
        res.status(500).json({ error: 'Ошибка' });
    }
});

// Добавить баллы лояльности
router.post('/:id/loyalty/add', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { points } = req.body;

        const orgId = getOrgId(req);
        let query = `UPDATE customers 
             SET loyalty_points = COALESCE(loyalty_points, 0) + $1
             WHERE id = $2`;
        const params = [parseInt(points) || 0, id];

        if (orgId) {
            query += ' AND organization_id = $3';
            params.push(orgId);
        }
        query += ' RETURNING loyalty_points';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        res.json({
            success: true,
            message: 'Баллы добавлены',
            loyalty_points: result.rows[0].loyalty_points
        });
    } catch (error) {
        console.error('[Customers] add loyalty error:', error);
        res.status(500).json({ error: 'Ошибка добавления баллов' });
    }
});

// Получить депозиты/транзакции клиента
router.get('/:id/deposits', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверяем наличие таблицы customer_deposits
        let transactions = [];
        try {
            const result = await pool.query(
                `SELECT id, type, amount, method, order_id, cashier, description, created_at as date
                 FROM customer_deposits
                 WHERE customer_id = $1
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [id]
            );
            transactions = result.rows;
        } catch (e) {
            // Таблица может не существовать — возвращаем пустой массив
            console.warn('[Customers] deposits table not found:', e.message);
        }

        res.json({ success: true, transactions, deposits: transactions });
    } catch (error) {
        console.error('[Customers] GET deposits error:', error);
        res.status(500).json({ error: 'Ошибка загрузки депозитов' });
    }
});

// Пополнить депозит клиента
router.post('/:id/deposits', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, method = 'cash', description } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Сумма должна быть положительной' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Записать транзакцию
            try {
                await client.query(
                    `INSERT INTO customer_deposits (customer_id, type, amount, method, cashier, description)
                     VALUES ($1, 'deposit', $2, $3, $4, $5)`,
                    [id, parseFloat(amount), method, req.user.full_name || req.user.username, description || 'Пополнение депозита']
                );
            } catch (e) {
                // Создаём таблицу если не существует
                await client.query(`
                    CREATE TABLE IF NOT EXISTS customer_deposits (
                        id SERIAL PRIMARY KEY,
                        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
                        type VARCHAR(20) DEFAULT 'deposit',
                        amount DECIMAL(12,2) NOT NULL,
                        method VARCHAR(50),
                        order_id VARCHAR(50),
                        cashier VARCHAR(100),
                        description TEXT,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                `);
                await client.query(
                    `INSERT INTO customer_deposits (customer_id, type, amount, method, cashier, description)
                     VALUES ($1, 'deposit', $2, $3, $4, $5)`,
                    [id, parseFloat(amount), method, req.user.full_name || req.user.username, description || 'Пополнение депозита']
                );
            }

            // Обновить баланс клиента (если есть колонка balance)
            try {
                await client.query(
                    'UPDATE customers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2',
                    [parseFloat(amount), id]
                );
            } catch (e) {
                // Добавим колонку balance если нет
                try {
                    await client.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0');
                    await client.query('UPDATE customers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2', [parseFloat(amount), id]);
                } catch (e2) { /* не критично */ }
            }

            await client.query('COMMIT');

            res.json({ success: true, message: 'Депозит пополнен' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Customers] POST deposit error:', error);
        res.status(500).json({ error: 'Ошибка пополнения депозита' });
    }
});

export default router;
