/**
 * QR Code Generator & Unified Payment Routes
 * SmartPOS Pro
 */

import express from 'express';
import QRCode from 'qrcode';
import pool from '../config/database.js';
import { getPaymeConfig, getClickConfig } from '../config/paymentConfig.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/payments/generate-qr
 * Generates Payme / Click dynamic links and SVG/PNG Data URL QR codes for POS terminal display
 */
router.post('/generate-qr', authenticateToken, async (req, res) => {
    try {
        const { order_id, provider = 'both' } = req.body || {};

        if (!order_id) {
            return res.status(400).json({ error: 'Параметр order_id обязателен' });
        }

        // 1. Fetch sale order from database
        const saleRes = await pool.query(
            'SELECT id, total_amount, payment_status, created_at, organization_id FROM sales WHERE id = $1',
            [order_id]
        );

        if (saleRes.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден в базе данных' });
        }

        const sale = saleRes.rows[0];
        const amountUz = parseFloat(sale.total_amount);

        const paymeConfig = getPaymeConfig();
        const clickConfig = getClickConfig();

        const result = {
            order_id: sale.id,
            amount: amountUz,
            payment_status: sale.payment_status,
            payme: null,
            click: null
        };

        // 2. Build Payme Dynamic Link & QR Code
        if (provider === 'payme' || provider === 'both') {
            const tiyinAmount = Math.round(amountUz * 100);
            // Format: m=merchant_id;ac.order_id=123;a=100000
            const paymeParams = `m=${paymeConfig.merchantId};ac.order_id=${sale.id};a=${tiyinAmount}`;
            const base64Params = Buffer.from(paymeParams).toString('base64');
            const paymeUrl = `${paymeConfig.checkoutUrl}/${base64Params}`;

            const qrDataUrl = await QRCode.toDataURL(paymeUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                margin: 2,
                color: {
                    dark: '#0052CC',
                    light: '#FFFFFF'
                }
            });

            result.payme = {
                url: paymeUrl,
                qr_code: qrDataUrl,
                tiyin_amount: tiyinAmount
            };
        }

        // 3. Build Click Dynamic Link & QR Code
        if (provider === 'click' || provider === 'both') {
            // Click URL Format: https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=...
            const encodedOrderId = encodeURIComponent(sale.id);
            const clickUrl = `https://my.click.uz/services/pay?service_id=${clickConfig.serviceId}&merchant_id=${clickConfig.merchantId}&amount=${amountUz}&transaction_param=${encodedOrderId}`;

            const qrDataUrl = await QRCode.toDataURL(clickUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                margin: 2,
                color: {
                    dark: '#00A651',
                    light: '#FFFFFF'
                }
            });

            result.click = {
                url: clickUrl,
                qr_code: qrDataUrl,
                card_payment_url: `https://my.click.uz/services/pay?service_id=${clickConfig.serviceId}&merchant_id=${clickConfig.merchantId}&amount=${amountUz}&transaction_param=${encodedOrderId}&pay_by_card=1`
            };
        }

        return res.json(result);
    } catch (error) {
        console.error('❌ QR Generation Error:', error);
        return res.status(500).json({ error: 'Ошибка генерации QR-кода' });
    }
});

/**
 * GET /api/payments/status/:order_id
 * Returns real-time payment status of an order for POS cashier screen polling
 */
router.get('/status/:order_id', authenticateToken, async (req, res) => {
    try {
        const { order_id } = req.params;

        const saleRes = await pool.query(
            'SELECT id, total_amount, payment_status, payment_method, updated_at FROM sales WHERE id = $1',
            [order_id]
        );

        if (saleRes.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const sale = saleRes.rows[0];

        // Check recent logs for provider responses
        const logsRes = await pool.query(
            `SELECT provider, method, created_at FROM payment_provider_logs 
             WHERE request_body::text LIKE $1 OR response_body::text LIKE $1 
             ORDER BY created_at DESC LIMIT 5`,
            [`%${order_id}%`]
        );

        return res.json({
            order_id: sale.id,
            total_amount: sale.total_amount,
            payment_status: sale.payment_status,
            payment_method: sale.payment_method,
            updated_at: sale.updated_at,
            recent_activity: logsRes.rows
        });
    } catch (error) {
        console.error('❌ Payment Status Check Error:', error);
        return res.status(500).json({ error: 'Ошибка проверки статуса платежа' });
    }
});

/**
 * GET /api/payments/logs
 * Returns audit logs of Click and Payme requests for troubleshooting
 */
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const provider = req.query.provider;

        let query = 'SELECT * FROM payment_provider_logs';
        const params = [];

        if (provider) {
            query += ' WHERE provider = $1';
            params.push(provider);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const logsRes = await pool.query(query, params);
        return res.json({ logs: logsRes.rows });
    } catch (error) {
        console.error('❌ Logs query error:', error);
        return res.status(500).json({ error: 'Ошибка получения логов платежей' });
    }
});

export default router;
