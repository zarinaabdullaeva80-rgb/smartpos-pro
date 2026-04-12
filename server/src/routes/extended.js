/**
 * API для расширенных функций товаров и платежей
 * Серийные номера, комплекты, рассрочка, сертификаты, SMS, реферралы
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// ============ СЕРИЙНЫЕ НОМЕРА ============

// Список товаров с количеством серийных номеров
router.get('/serials/products', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id, p.name, p.code, p.barcode,
                   COUNT(sn.id) as serials_count,
                   COUNT(CASE WHEN sn.status = 'available' THEN 1 END) as available
            FROM products p
            LEFT JOIN serial_numbers sn ON p.id = sn.product_id
            GROUP BY p.id, p.name, p.code, p.barcode
            HAVING COUNT(sn.id) > 0
            ORDER BY p.name
        `);
        res.json({ products: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/serials/:productId', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { status } = req.query;

        let query = `SELECT * FROM serial_numbers WHERE product_id = $1`;
        const params = [productId];

        if (status) {
            query += ` AND status = $2`;
            params.push(status);
        }
        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);
        res.json({ serials: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/serials', authenticateToken, async (req, res) => {
    try {
        const { product_id, serial_numbers, serials, warranty_until } = req.body;
        const serialList = serial_numbers || serials || [];

        const inserted = [];
        for (const sn of serialList) {
            try {
                const result = await pool.query(`
                    INSERT INTO serial_numbers (product_id, serial_number, warranty_until)
                    VALUES ($1, $2, $3) RETURNING *
                `, [product_id, sn, warranty_until]);
                inserted.push(result.rows[0]);
            } catch (e) {
                // Пропускаем дубликаты
            }
        }

        res.json({ success: true, inserted, count: inserted.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /serials/:productId - альтернативный формат для клиента
router.post('/serials/:productId', authenticateToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { serials, serial_numbers, warranty_until } = req.body;
        const serialList = serials || serial_numbers || [];

        const inserted = [];
        for (const sn of serialList) {
            try {
                const result = await pool.query(`
                    INSERT INTO serial_numbers (product_id, serial_number, warranty_until)
                    VALUES ($1, $2, $3) RETURNING *
                `, [productId, sn, warranty_until || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)]);
                inserted.push(result.rows[0]);
            } catch (e) {
                // Пропускаем дубликаты
            }
        }

        res.json({ success: true, inserted, count: inserted.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ КОМПЛЕКТЫ ============

router.get('/bundles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, 
                   COALESCE(SUM(bi.quantity * p.price_sale), 0) as components_price,
                   COUNT(bi.id) as items_count
            FROM product_bundles b
            LEFT JOIN bundle_items bi ON b.id = bi.bundle_id
            LEFT JOIN products p ON bi.product_id = p.id
            GROUP BY b.id
            ORDER BY b.name
        `);
        res.json({ bundles: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/bundles', authenticateToken, async (req, res) => {
    try {
        const { name, sku, price, discount_percent, items } = req.body;

        const bundleResult = await pool.query(`
            INSERT INTO product_bundles (name, sku, price, discount_percent)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [name, sku, price, discount_percent || 0]);

        const bundle = bundleResult.rows[0];

        for (const item of items) {
            await pool.query(`
                INSERT INTO bundle_items (bundle_id, product_id, quantity)
                VALUES ($1, $2, $3)
            `, [bundle.id, item.product_id, item.quantity]);
        }

        res.json({ success: true, bundle });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ РАССРОЧКА ============

// Список всех рассрочек
router.get('/installments', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT is2.*, ip.name as plan_name, ip.months,
                   c.name as customer_name, c.phone as customer_phone,
                   s.total as sale_total
            FROM installment_sales is2
            JOIN installment_plans ip ON is2.plan_id = ip.id
            LEFT JOIN customers c ON is2.customer_id = c.id
            JOIN sales s ON is2.sale_id = s.id
            ORDER BY is2.created_at DESC
        `);
        res.json({ installments: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/installments/plans', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM installment_plans WHERE is_active = true ORDER BY months
        `);
        res.json({ plans: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/installments', authenticateToken, async (req, res) => {
    try {
        const { sale_id, customer_id, plan_id, down_payment } = req.body;

        // Получить план
        const planResult = await pool.query(`SELECT * FROM installment_plans WHERE id = $1`, [plan_id]);
        const plan = planResult.rows[0];

        // Получить сумму продажи
        const saleResult = await pool.query(`SELECT total FROM sales WHERE id = $1`, [sale_id]);
        const total = parseFloat(saleResult.rows[0].total);

        const dp = parseFloat(down_payment) || 0;
        const remaining = total - dp;
        const interest = remaining * (plan.interest_rate / 100);
        const totalWithInterest = remaining + interest;
        const monthly = totalWithInterest / plan.months;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.months);

        const installmentResult = await pool.query(`
            INSERT INTO installment_sales 
            (sale_id, customer_id, plan_id, total_amount, down_payment, monthly_payment, remaining_amount, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [sale_id, customer_id, plan_id, totalWithInterest, dp, monthly, totalWithInterest, startDate, endDate]);

        const installment = installmentResult.rows[0];

        // Создать платежи
        for (let i = 1; i <= plan.months; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            await pool.query(`
                INSERT INTO installment_payments (installment_sale_id, payment_number, due_date, amount)
                VALUES ($1, $2, $3, $4)
            `, [installment.id, i, dueDate, monthly]);
        }

        // Обновить продажу
        await pool.query(`UPDATE sales SET has_installment = true WHERE id = $1`, [sale_id]);

        res.json({ success: true, installment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/installments/:customerId', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const result = await pool.query(`
            SELECT is.*, ip.name as plan_name, s.total as sale_total
            FROM installment_sales is
            JOIN installment_plans ip ON is.plan_id = ip.id
            JOIN sales s ON is.sale_id = s.id
            WHERE is.customer_id = $1
            ORDER BY is.created_at DESC
        `, [customerId]);
        res.json({ installments: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ПОДАРОЧНЫЕ СЕРТИФИКАТЫ ============

router.get('/gift-certificates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM gift_certificates ORDER BY created_at DESC LIMIT 100
        `);
        res.json({ certificates: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/gift-certificates', authenticateToken, async (req, res) => {
    try {
        const { value, recipient_name, recipient_phone, message, expires_days } = req.body;

        const code = generateCertificateCode();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (expires_days || 365));

        const result = await pool.query(`
            INSERT INTO gift_certificates 
            (code, initial_value, current_value, recipient_name, recipient_phone, message, expires_at)
            VALUES ($1, $2, $2, $3, $4, $5, $6) RETURNING *
        `, [code, value, recipient_name, recipient_phone, message, expiresAt]);

        res.json({ success: true, certificate: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/gift-certificates/redeem', authenticateToken, async (req, res) => {
    try {
        const { code, sale_id, amount } = req.body;

        const certResult = await pool.query(`
            SELECT * FROM gift_certificates WHERE code = $1 AND is_active = true
        `, [code]);

        if (certResult.rows.length === 0) {
            return res.status(404).json({ error: 'Сертификат не найден или неактивен' });
        }

        const cert = certResult.rows[0];

        if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Сертификат истёк' });
        }

        const redeemAmount = Math.min(amount, cert.current_value);
        const newValue = cert.current_value - redeemAmount;

        await pool.query(`
            UPDATE gift_certificates SET current_value = $1, is_active = $2 WHERE id = $3
        `, [newValue, newValue > 0, cert.id]);

        await pool.query(`
            INSERT INTO gift_certificate_usage (certificate_id, sale_id, amount_used, used_by)
            VALUES ($1, $2, $3, $4)
        `, [cert.id, sale_id, redeemAmount, req.user.id]);

        res.json({
            success: true,
            redeemed: redeemAmount,
            remaining: newValue
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ РЕФЕРРАЛЬНАЯ ПРОГРАММА ============

router.get('/referral/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM referral_settings WHERE id = 1`);
        res.json({ settings: result.rows[0] || {} });
    } catch (error) {
        res.json({ settings: {} });
    }
});

router.post('/referral/apply', authenticateToken, async (req, res) => {
    try {
        const { referee_id, referral_code } = req.body;

        // Найти реферера
        const referrerResult = await pool.query(`
            SELECT id, name FROM customers WHERE referral_code = $1
        `, [referral_code]);

        if (referrerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Реферальный код не найден' });
        }

        const referrer = referrerResult.rows[0];

        if (referrer.id === referee_id) {
            return res.status(400).json({ error: 'Нельзя использовать свой код' });
        }

        // Создать связь
        await pool.query(`
            UPDATE customers SET referred_by = $1 WHERE id = $2
        `, [referrer.id, referee_id]);

        await pool.query(`
            INSERT INTO referrals (referrer_id, referee_id, referral_code)
            VALUES ($1, $2, $3)
        `, [referrer.id, referee_id, referral_code]);

        res.json({ success: true, referrer_name: referrer.name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ WISHLIST ============

router.get('/wishlist/:customerId', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const result = await pool.query(`
            SELECT wi.*, p.name, p.price_sale as price, p.image_url,
                   COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id = p.id), 0) as stock
            FROM wishlist_items wi
            JOIN wishlists w ON wi.wishlist_id = w.id
            JOIN products p ON wi.product_id = p.id
            WHERE w.customer_id = $1
            ORDER BY wi.added_at DESC
        `, [customerId]);
        res.json({ items: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/wishlist', authenticateToken, async (req, res) => {
    try {
        const { customer_id, product_id } = req.body;

        // Получить или создать wishlist
        let wishlistResult = await pool.query(`
            SELECT id FROM wishlists WHERE customer_id = $1 AND is_default = true
        `, [customer_id]);

        let wishlistId;
        if (wishlistResult.rows.length === 0) {
            const newWishlist = await pool.query(`
                INSERT INTO wishlists (customer_id, is_default) VALUES ($1, true) RETURNING id
            `, [customer_id]);
            wishlistId = newWishlist.rows[0].id;
        } else {
            wishlistId = wishlistResult.rows[0].id;
        }

        await pool.query(`
            INSERT INTO wishlist_items (wishlist_id, product_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
        `, [wishlistId, product_id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ СРОКИ ГОДНОСТИ ============

router.get('/expiry/alerts', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM check_expiring_products()`);
        res.json({ alerts: result.rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ЧАЕВЫЕ ============

router.post('/tips', authenticateToken, async (req, res) => {
    try {
        const { sale_id, employee_id, amount, payment_method } = req.body;

        const result = await pool.query(`
            INSERT INTO tips (sale_id, employee_id, amount, payment_method)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [sale_id, employee_id, amount, payment_method]);

        await pool.query(`
            UPDATE sales SET tip_amount = COALESCE(tip_amount, 0) + $1 WHERE id = $2
        `, [amount, sale_id]);

        res.json({ success: true, tip: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ВСПОМОГАТЕЛЬНЫЕ ============

function generateCertificateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export default router;
