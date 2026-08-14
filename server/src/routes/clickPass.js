/**
 * Click Pass API Route (Payment via scanned customer Click Pass token/code)
 * SmartPOS Pro
 */

import express from 'express';
import crypto from 'crypto';
import pool from '../config/database.js';
import { getClickConfig } from '../config/paymentConfig.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Generate Digest header for Click Pass API
function generateClickAuthHeader(merchantUserId, secretKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const digest = crypto.createHash('sha1').update(timestamp + secretKey).digest('hex');
    return {
        timestamp,
        digest,
        header: `${merchantUserId}:${digest}:${timestamp}`
    };
}

/**
 * POST /api/payments/click-pass/pay
 * Initiates payment via customer's 6-digit Click Pass code / token
 */
router.post('/click-pass/pay', authenticateToken, async (req, res) => {
    try {
        const { order_id, click_pass_token, amount } = req.body || {};

        if (!order_id || !click_pass_token) {
            return res.status(400).json({ error: 'Параметры order_id и click_pass_token обязательны' });
        }

        // 1. Check order in SmartPOS Pro
        const saleRes = await pool.query(
            'SELECT id, total_amount, payment_status, organization_id FROM sales WHERE id = $1',
            [order_id]
        );

        if (saleRes.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const sale = saleRes.rows[0];

        if (sale.payment_status === 'paid') {
            return res.status(400).json({ error: 'Заказ уже оплачен' });
        }

        const payAmount = amount ? parseFloat(amount) : parseFloat(sale.total_amount);

        const config = getClickConfig();
        const auth = generateClickAuthHeader(config.merchantUserId, config.secretKey);

        // Prepare request body for Click Pass Merchant API
        const clickPassPayload = {
            service_id: parseInt(config.serviceId),
            merchant_trans_id: order_id.toString(),
            amount: payAmount,
            token: click_pass_token.toString().trim()
        };

        // In test mode or when mock enabled, return simulated success / invoke Click Pass API
        let apiResult;
        if (config.isTest && (click_pass_token === '111111' || click_pass_token === '000000' || click_pass_token.startsWith('TEST'))) {
            // Simulated Test Response
            apiResult = {
                error_code: 0,
                error_note: 'Success',
                payment_id: Math.floor(Date.now() / 1000),
                status: 'SUCCESS'
            };
        } else {
            // Live Click Pass API Request
            try {
                const fetchRes = await fetch(`${config.apiUrl}/click_pass/pay`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Auth': auth.header
                    },
                    body: JSON.stringify(clickPassPayload)
                });
                apiResult = await fetchRes.json();
            } catch (netErr) {
                console.error('❌ Click Pass HTTP Error:', netErr.message);
                return res.status(502).json({
                    error: 'Ошибка соединения с сервером Click Pass',
                    details: netErr.message
                });
            }
        }

        // Log request
        try {
            await pool.query(
                `INSERT INTO payment_provider_logs 
                (provider, method, request_headers, request_body, response_body, ip_address) 
                VALUES ('click_pass', 'PAY', $1, $2, $3, $4)`,
                [
                    JSON.stringify({ Auth: auth.header }),
                    JSON.stringify(clickPassPayload),
                    JSON.stringify(apiResult),
                    req.ip || ''
                ]
            );
        } catch (le) { /* ignore log error */ }

        if (apiResult.error_code === 0 || apiResult.status === 'SUCCESS' || apiResult.error === 0) {
            // Success -> Mark order paid
            await pool.query(
                `UPDATE sales 
                 SET payment_status = 'paid', payment_method = 'click_pass', updated_at = NOW() 
                 WHERE id = $1`,
                [order_id]
            );

            // Record transaction
            await pool.query(
                `INSERT INTO click_transactions 
                (click_trans_id, service_id, merchant_trans_id, amount, action, payment_type, status, organization_id) 
                VALUES ($1, $2, $3, $4, 1, 'CLICK_PASS', 'PAID', $5)
                ON CONFLICT (click_trans_id) DO UPDATE SET status = 'PAID'`,
                [
                    apiResult.payment_id || Date.now(),
                    config.serviceId,
                    order_id,
                    payAmount,
                    sale.organization_id || 1
                ]
            );

            // Add payment record
            try {
                await pool.query(
                    `INSERT INTO payments 
                    (document_number, document_date, payment_type, amount, payment_method, notes, organization_id) 
                    VALUES ($1, NOW(), 'incoming', $2, 'click_pass', $3, $4)`,
                    [`CLICKPASS-${apiResult.payment_id || Date.now()}`, payAmount, `Click Pass чек #${order_id}`, sale.organization_id || 1]
                );
            } catch (e) { /* ignore */ }

            return res.json({
                success: true,
                message: 'Оплата через Click Pass успешно проведена!',
                payment_id: apiResult.payment_id || Date.now(),
                order_id
            });
        } else {
            return res.status(400).json({
                success: false,
                error: apiResult.error_note || apiResult.message || 'Ошибка оплаты Click Pass',
                code: apiResult.error_code || apiResult.error
            });
        }
    } catch (error) {
        console.error('❌ Click Pass Error:', error);
        return res.status(500).json({ error: 'Ошибка обработки Click Pass платежа' });
    }
});

export default router;
