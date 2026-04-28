/**
 * API для программы лояльности и накопительных карт
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';

const router = express.Router();

// ============ НАСТРОЙКИ ПРОГРАММЫ ============

/**
 * Получить настройки программы лояльности
 */
router.get('/settings', authenticateToken, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(
            `SELECT * FROM loyalty_settings WHERE organization_id = $1`,
            [orgId]
        );

        const defaults = {
            organization_id: orgId,
            cashback_percent: 2,           // % кэшбека
            min_purchase: 10000,           // Мин. покупка для начисления
            points_expiry_days: 365,       // Срок действия баллов
            welcome_bonus: 1000,           // Бонус при регистрации
            birthday_bonus: 5000,          // Бонус на день рождения
            referral_bonus: 2000,          // Бонус за реферала
            max_discount_percent: 30,      // Макс. скидка баллами
            points_to_currency: 1,         // 1 балл = 1 сум
            enabled: true
        };

        res.json({ settings: result.rows[0] || defaults });
    } catch (error) {
        console.error('Loyalty settings error:', error);
        res.json({ settings: { cashback_percent: 2, enabled: true } });
    }
});

/**
 * Обновить настройки программы
 */
router.put('/settings', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const orgId = req.user?.organization_id || 1;
        const {
            cashback_percent, min_purchase, points_expiry_days,
            welcome_bonus, birthday_bonus, referral_bonus,
            max_discount_percent, points_to_currency, enabled
        } = req.body;

        const result = await pool.query(`
            INSERT INTO loyalty_settings (organization_id, cashback_percent, min_purchase, points_expiry_days,
                welcome_bonus, birthday_bonus, referral_bonus, max_discount_percent, points_to_currency, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (organization_id) DO UPDATE SET
                cashback_percent = $2, min_purchase = $3, points_expiry_days = $4,
                welcome_bonus = $5, birthday_bonus = $6, referral_bonus = $7,
                max_discount_percent = $8, points_to_currency = $9, enabled = $10,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [orgId, cashback_percent, min_purchase, points_expiry_days, welcome_bonus,
            birthday_bonus, referral_bonus, max_discount_percent, points_to_currency, enabled]);

        res.json({ success: true, settings: result.rows[0] });
    } catch (error) {
        console.error('Update loyalty settings error:', error);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

// ============ КАРТЫ КЛИЕНТОВ ============

/**
 * Получить карту клиента
 */
router.get('/card/:customerId', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const orgId = req.user?.organization_id || 1;
        // Получить данные клиента
        const customerResult = await pool.query(`
            SELECT c.*, 
                   COALESCE(SUM(lt.points), 0) as total_points,
                   COALESCE(SUM(CASE WHEN lt.transaction_type = 'earn' THEN lt.points ELSE 0 END), 0) as earned_points,
                   COALESCE(SUM(CASE WHEN lt.transaction_type = 'spend' THEN lt.points ELSE 0 END), 0) as spent_points
            FROM customers c
            LEFT JOIN loyalty_transactions lt ON c.id = lt.customer_id
            WHERE c.id = $1 AND c.organization_id = $2
            GROUP BY c.id
        `, [customerId, orgId]);

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const customer = customerResult.rows[0];

        // Получить настройки кэшбека
        let cashbackPercent = 2;
        try {
            const settingsRes = await pool.query('SELECT cashback_percent FROM loyalty_settings WHERE id = 1');
            if (settingsRes.rows.length > 0) cashbackPercent = settingsRes.rows[0].cashback_percent || 2;
        } catch (e) {}

        // Генерировать номер карты если нет
        let cardNumber = customer.card_number;
        if (!cardNumber) {
            cardNumber = generateCardNumber(customerId);
            await pool.query(`UPDATE customers SET card_number = $1 WHERE id = $2`, [cardNumber, customerId]);
        }

        res.json({
            card: {
                number: cardNumber,
                customerName: customer.name,
                phone: customer.phone,
                email: customer.email,
                balance: parseInt(customer.total_points) || 0,
                earnedTotal: parseInt(customer.earned_points) || 0,
                spentTotal: parseInt(customer.spent_points) || 0,
                level: getCustomerLevel(customer.earned_points),
                cashbackPercent,
                createdAt: customer.created_at
            }
        });
    } catch (error) {
        console.error('Get card error:', error);
        res.status(500).json({ error: 'Ошибка получения карты' });
    }
});

/**
 * Генерация QR-кода карты
 */
router.get('/card/:customerId/qr', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const result = await pool.query(`SELECT card_number, name FROM customers WHERE id = $1`, [customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const customer = result.rows[0];
        const cardNumber = customer.card_number || generateCardNumber(customerId);

        // QR содержит данные для идентификации
        const qrData = JSON.stringify({
            type: 'LOYALTY_CARD',
            cardNumber,
            customerId: parseInt(customerId)
        });

        const qrImage = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: { dark: '#1e3a5f', light: '#ffffff' }
        });

        res.json({
            qrCode: qrImage,
            cardNumber,
            customerName: customer.name
        });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: 'Ошибка генерации QR' });
    }
});

/**
 * Генерация штрихкода карты
 */
router.get('/card/:customerId/barcode', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(`SELECT card_number FROM customers WHERE id = $1 AND organization_id = $2`, [customerId, orgId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const cardNumber = result.rows[0].card_number || generateCardNumber(customerId);

        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: cardNumber,
            scale: 3,
            height: 15,
            includetext: true,
            textxalign: 'center'
        });

        res.json({
            barcode: `data:image/png;base64,${barcodeBuffer.toString('base64')}`,
            cardNumber
        });
    } catch (error) {
        console.error('Barcode generation error:', error);
        res.status(500).json({ error: 'Ошибка генерации штрихкода' });
    }
});

/**
 * Печать карты (HTML шаблон)
 */
router.get('/card/:customerId/print', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;

        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(`
            SELECT c.*, COALESCE(SUM(lt.points), 0) as balance
            FROM customers c
            LEFT JOIN loyalty_transactions lt ON c.id = lt.customer_id
            WHERE c.id = $1 AND c.organization_id = $2
            GROUP BY c.id
        `, [customerId, orgId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const customer = result.rows[0];
        const cardNumber = customer.card_number || generateCardNumber(customerId);

        // QR код
        const qrData = JSON.stringify({ type: 'LOYALTY_CARD', cardNumber, customerId: parseInt(customerId) });
        const qrImage = await QRCode.toDataURL(qrData, { width: 150, margin: 1 });

        // Генерируем HTML для печати
        const cardHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Карта лояльности - ${customer.name}</title>
    <style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; }
        .card {
            width: 85.6mm; height: 53.98mm;
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%);
            color: white;
            border-radius: 10px;
            padding: 8mm;
            box-sizing: border-box;
            position: relative;
        }
        .logo { font-size: 18px; font-weight: bold; margin-bottom: 5mm; }
        .logo span { color: #ffd700; }
        .card-number {
            font-size: 14px;
            letter-spacing: 2px;
            margin: 8mm 0 3mm;
            font-family: monospace;
        }
        .customer-name {
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 3mm;
        }
        .level {
            font-size: 10px;
            color: #ffd700;
        }
        .qr-code {
            position: absolute;
            right: 5mm;
            top: 50%;
            transform: translateY(-50%);
            background: white;
            padding: 2mm;
            border-radius: 5px;
        }
        .qr-code img { width: 25mm; height: 25mm; display: block; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">1С <span>Бонус</span></div>
        <div class="card-number">${formatCardNumber(cardNumber)}</div>
        <div class="customer-name">${customer.name}</div>
        <div class="level">${getCustomerLevel(customer.balance)}</div>
        <div class="qr-code">
            <img src="${qrImage}" alt="QR">
        </div>
    </div>
</body>
</html>`;

        res.json({
            html: cardHTML,
            cardNumber,
            customerName: customer.name
        });
    } catch (error) {
        console.error('Print card error:', error);
        res.status(500).json({ error: 'Ошибка генерации карты' });
    }
});

// ============ ТРАНЗАКЦИИ БАЛЛОВ ============

/**
 * Начислить баллы
 */
router.post('/earn', authenticateToken, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || 1;
        // Получить настройки
        const settingsResult = await pool.query(`SELECT * FROM loyalty_settings WHERE organization_id = $1`, [orgId]);
        const settings = settingsResult.rows[0] || { cashback_percent: 2, min_purchase: 10000, enabled: true };

        if (!settings.enabled) {
            return res.json({ success: false, message: 'Программа лояльности отключена' });
        }

        if (amount < (settings.min_purchase || 0)) {
            return res.json({
                success: false,
                message: `Минимальная сумма для начисления: ${settings.min_purchase} сум`
            });
        }

        const points = Math.floor(amount * (settings.cashback_percent || 2) / 100);

        const result = await pool.query(`
            INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
            VALUES ($1, 'earn', $2, $3, $4, $5, $6)
            RETURNING *
        `, [customerId, points, saleId, description || 'Начисление за покупку', req.user.id, orgId]);

        res.json({
            success: true,
            transaction: result.rows[0],
            pointsEarned: points,
            message: `Начислено ${points} баллов`
        });
    } catch (error) {
        console.error('Earn points error:', error);
        res.status(500).json({ error: 'Ошибка начисления баллов' });
    }
});

/**
 * Списать баллы
 */
router.post('/spend', authenticateToken, async (req, res) => {
    try {
        const { customerId, points, saleId, description } = req.body;

        const orgId = req.user?.organization_id || 1;
        // Проверить баланс
        const balanceResult = await pool.query(`
            SELECT COALESCE(SUM(points), 0) as balance 
            FROM loyalty_transactions 
            WHERE customer_id = $1 AND organization_id = $2
        `, [customerId, orgId]);

        const balance = parseInt(balanceResult.rows[0].balance) || 0;

        if (points > balance) {
            return res.status(400).json({
                error: 'Недостаточно баллов',
                balance,
                requested: points
            });
        }

        const result = await pool.query(`
            INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
            VALUES ($1, 'spend', $2, $3, $4, $5, $6)
            RETURNING *
        `, [customerId, -points, saleId, description || 'Оплата баллами', req.user.id, orgId]);

        res.json({
            success: true,
            transaction: result.rows[0],
            pointsSpent: points,
            newBalance: balance - points,
            message: `Списано ${points} баллов`
        });
    } catch (error) {
        console.error('Spend points error:', error);
        res.status(500).json({ error: 'Ошибка списания баллов' });
    }
});

/**
 * История транзакций клиента
 */
router.get('/transactions/:customerId', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(`
            SELECT lt.*, u.full_name as created_by_name
            FROM loyalty_transactions lt
            LEFT JOIN users u ON lt.created_by = u.id
            WHERE lt.customer_id = $1 AND lt.organization_id = $2
            ORDER BY lt.created_at DESC
            LIMIT $3 OFFSET $4
        `, [customerId, orgId, limit, offset]);

        // Подтягиваем товары из продаж для каждой транзакции с sale_id
        const transactions = result.rows;
        for (const tx of transactions) {
            if (tx.sale_id) {
                try {
                    const itemsRes = await pool.query(`
                        SELECT si.quantity, si.price, p.name as product_name
                        FROM sale_items si
                        LEFT JOIN products p ON si.product_id = p.id
                        WHERE si.sale_id = $1
                        ORDER BY si.id
                    `, [tx.sale_id]);
                    tx.sale_items = itemsRes.rows;
                } catch (e) {
                    tx.sale_items = [];
                }
            } else {
                tx.sale_items = [];
            }
        }

        res.json({ transactions });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Ошибка получения истории' });
    }
});

/**
 * Поиск клиента по карте/QR
 */
router.post('/scan', authenticateToken, async (req, res) => {
    try {
        const { cardNumber, qrData } = req.body;

        let searchNumber = cardNumber;

        // Если пришли данные QR
        if (qrData) {
            try {
                const parsed = JSON.parse(qrData);
                if (parsed.type === 'LOYALTY_CARD') {
                    searchNumber = parsed.cardNumber;
                }
            } catch (e) {
                searchNumber = qrData;
            }
        }

        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(`
            SELECT c.*, COALESCE(SUM(lt.points), 0) as balance
            FROM customers c
            LEFT JOIN loyalty_transactions lt ON c.id = lt.customer_id
            WHERE c.card_number = $1 AND c.organization_id = $2
            GROUP BY c.id
        `, [searchNumber, orgId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Карта не найдена' });
        }

        const customer = result.rows[0];
        res.json({
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                cardNumber: customer.card_number,
                balance: parseInt(customer.balance) || 0,
                level: getCustomerLevel(customer.balance)
            }
        });
    } catch (error) {
        console.error('Scan card error:', error);
        res.status(500).json({ error: 'Ошибка сканирования карты' });
    }
});

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

function generateCardNumber(customerId) {
    const prefix = '7777';
    const paddedId = String(customerId).padStart(8, '0');
    const checksum = calculateLuhn(prefix + paddedId);
    return prefix + paddedId + checksum;
}

function calculateLuhn(number) {
    let sum = 0;
    let alternate = false;
    for (let i = number.length - 1; i >= 0; i--) {
        let n = parseInt(number.charAt(i), 10);
        if (alternate) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        alternate = !alternate;
    }
    return String((10 - (sum % 10)) % 10);
}

function formatCardNumber(number) {
    return number.replace(/(.{4})/g, '$1 ').trim();
}

function getCustomerLevel(points) {
    const p = parseInt(points) || 0;
    if (p >= 1000000) return '💎 Diamond';
    if (p >= 500000) return '🥇 Gold';
    if (p >= 100000) return '🥈 Silver';
    if (p >= 10000) return '🥉 Bronze';
    return '⭐ Standard';
}

// ============ АЛИАСЫ ДЛЯ МОБИЛЬНОГО ПРИЛОЖЕНИЯ ============

/**
 * GET /api/loyalty/program — алиас для /settings (мобильное приложение)
 */
router.get('/program', authenticateToken, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || 1;
        const result = await pool.query(`SELECT * FROM loyalty_settings WHERE organization_id = $1`, [orgId]);

        const defaults = {
            id: 1, name: 'Программа лояльности', description: 'Накапливайте баллы за каждую покупку',
            cashback_percent: 2, min_purchase: 10000, points_expiry_days: 365,
            welcome_bonus: 1000, birthday_bonus: 5000, referral_bonus: 2000,
            max_discount_percent: 30, points_to_currency: 1, enabled: true
        };

        const settings = result.rows[0] || defaults;
        res.json({
            name: settings.name || 'Программа лояльности',
            description: settings.description || 'Накапливайте баллы за каждую покупку',
            pointsRate: settings.cashback_percent || 2,
            pointValue: settings.points_to_currency || 1,
            ...settings
        });
    } catch (error) {
        console.error('Loyalty program error:', error);
        res.json({ name: 'Программа лояльности', pointsRate: 2, pointValue: 1, enabled: true });
    }
});

/**
 * GET /api/loyalty/check/:phone — поиск клиента по телефону
 */
router.get('/check/:phone', authenticateToken, async (req, res) => {
    try {
        const { phone } = req.params;
        const orgId = req.user?.organization_id;

        let query = `
            SELECT c.*, 
                   COALESCE(c.loyalty_points, 0) as points,
                   (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as total_purchases
            FROM customers c
            WHERE (c.phone ILIKE $1 OR c.phone ILIKE $2 OR c.name ILIKE $3)
        `;
        const params = [`%${phone}%`, `%${phone.replace(/[^\d]/g, '')}%`, `%${phone}%`];

        if (orgId) {
            query += ` AND c.organization_id = $4`;
            params.push(orgId);
        }
        query += ` LIMIT 1`;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const customer = result.rows[0];
        res.json({
            customer: {
                id: customer.id,
                name: customer.name,
                full_name: customer.name,
                phone: customer.phone,
                email: customer.email,
                points: parseInt(customer.points) || parseInt(customer.loyalty_points) || 0,
                loyalty_points: parseInt(customer.loyalty_points) || 0,
                total_purchases: parseInt(customer.total_purchases) || 0,
                level: getCustomerLevel(customer.loyalty_points || 0),
                loyalty_level: getCustomerLevel(customer.loyalty_points || 0),
                created_at: customer.created_at
            }
        });
    } catch (error) {
        console.error('Check balance error:', error);
        res.status(500).json({ error: 'Ошибка поиска клиента' });
    }
});

/**
 * POST /api/loyalty/add-points — алиас для начисления баллов (мобильное приложение)
 */
router.post('/add-points', authenticateToken, async (req, res) => {
    try {
        const { customerId, points, reason } = req.body;

        if (!customerId || !points) {
            return res.status(400).json({ error: 'Укажите клиента и количество баллов' });
        }

        const orgId = req.user?.organization_id || 1;

        // Добавить баллы напрямую в customers
        let query = `UPDATE customers 
             SET loyalty_points = COALESCE(loyalty_points, 0) + $1
             WHERE id = $2 AND organization_id = $3`;
        const params = [parseInt(points), customerId, orgId];

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        // Записать транзакцию
        try {
            await pool.query(`
                INSERT INTO loyalty_transactions (customer_id, transaction_type, points, description, created_by, organization_id)
                VALUES ($1, 'earn', $2, $3, $4, $5)
            `, [customerId, parseInt(points), reason || 'Ручное начисление', req.user.id, orgId]);
        } catch (e) {
            console.log('Loyalty transaction log skipped:', e.message);
        }

        res.json({
            success: true,
            pointsEarned: parseInt(points),
            newBalance: result.rows[0].loyalty_points,
            message: `Начислено ${points} баллов`
        });
    } catch (error) {
        console.error('Add points error:', error);
        res.status(500).json({ error: 'Ошибка начисления баллов' });
    }
});

/**
 * GET /api/loyalty/customers/:id — получить данные клиента по ID
 */
router.get('/customers/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organization_id || 1;

        const result = await pool.query(`
            SELECT c.*, 
                   COALESCE(c.loyalty_points, 0) as points,
                   (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND organization_id = $2) as total_purchases
            FROM customers c
            WHERE c.id = $1 AND c.organization_id = $2
        `, [id, orgId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const customer = result.rows[0];
        res.json({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            points: parseInt(customer.points) || 0,
            loyalty_points: parseInt(customer.loyalty_points) || 0,
            total_purchases: parseInt(customer.total_purchases) || 0,
            level: getCustomerLevel(customer.loyalty_points || 0)
        });
    } catch (error) {
        console.error('Get customer points error:', error);
        res.status(500).json({ error: 'Ошибка получения данных клиента' });
    }
});

/**
 * POST /api/loyalty/redeem — списание баллов (алиас для мобильного приложения)
 */
router.post('/redeem', authenticateToken, async (req, res) => {
    try {
        const { customerId, points, saleId } = req.body;

        if (!customerId || !points) {
            return res.status(400).json({ error: 'Укажите клиента и количество баллов' });
        }

        const orgId = req.user?.organization_id || 1;
        // Проверить баланс
        const customerResult = await pool.query(
            'SELECT loyalty_points FROM customers WHERE id = $1 AND organization_id = $2',
            [customerId, orgId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }

        const balance = parseInt(customerResult.rows[0].loyalty_points) || 0;

        if (points > balance) {
            return res.status(400).json({
                error: 'Недостаточно баллов',
                balance,
                requested: points
            });
        }

        // Списать баллы
        await pool.query(
            'UPDATE customers SET loyalty_points = loyalty_points - $1 WHERE id = $2 AND organization_id = $3',
            [parseInt(points), customerId, orgId]
        );

        // Записать транзакцию
        try {
            await pool.query(`
                INSERT INTO loyalty_transactions (customer_id, transaction_type, points, sale_id, description, created_by, organization_id)
                VALUES ($1, 'spend', $2, $3, 'Оплата баллами', $4, $5)
            `, [customerId, -parseInt(points), saleId, req.user.id, orgId]);
        } catch (e) {
            console.log('Loyalty transaction log skipped:', e.message);
        }

        res.json({
            success: true,
            pointsSpent: parseInt(points),
            newBalance: balance - parseInt(points),
            message: `Списано ${points} баллов`
        });
    } catch (error) {
        console.error('Redeem points error:', error);
        res.status(500).json({ error: 'Ошибка списания баллов' });
    }
});

// Removed duplicate barcode route (already defined at line 182)
export default router;
