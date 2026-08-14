/**
 * Click Shop API Route (Prepare & Complete Webhooks)
 * SmartPOS Pro
 */

import express from 'express';
import crypto from 'crypto';
import pool from '../config/database.js';
import { getClickConfig } from '../config/paymentConfig.js';

const router = express.Router();

// Helper to log payment provider requests & responses
async function logProviderRequest(provider, method, headers, body, response, req) {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
        await pool.query(
            `INSERT INTO payment_provider_logs 
            (provider, method, request_headers, request_body, response_body, ip_address) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [provider, method, JSON.stringify(headers), JSON.stringify(body), JSON.stringify(response), ip]
        );
    } catch (e) {
        console.error('⚠️ Log error:', e.message);
    }
}

// Generate MD5 hash
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 1. Click Prepare Endpoint (action = 0)
 */
router.post('/click/prepare', async (req, res) => {
    const body = req.body || {};
    const {
        click_trans_id,
        service_id,
        click_paydoc_send_id,
        merchant_trans_id,
        amount,
        action,
        error,
        error_note,
        sign_time,
        sign_string
    } = body;

    const config = getClickConfig();

    console.log('[CLICK PREPARE INCOMING]', JSON.stringify(body));

    const paramAmt = body.param_amount !== undefined && body.param_amount !== null ? body.param_amount : amount;
    const numAmt = parseFloat(paramAmt || 0);

    const possibleSigns = [
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${paramAmt}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${amount}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${numAmt.toFixed(2)}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${numAmt.toFixed(4)}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${Math.round(numAmt)}${action}${sign_time}`)
    ];

    if (!possibleSigns.includes(sign_string)) {
        console.error(`❌ Click Prepare SIGN CHECK FAILED! Received: ${sign_string}, Expected one of:`, possibleSigns);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -1,
            error_note: 'SIGN CHECK FAILED!'
        };
        await logProviderRequest('click', 'PREPARE_SIGN_ERR', req.headers, body, errResp, req);
        return res.json(errResp);
    }

    if (parseInt(action) !== 0) {
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -3,
            error_note: 'Action not found'
        };
        return res.json(errResp);
    }

    if (parseInt(error) < 0) {
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -6,
            error_note: error_note || 'Transaction cancelled by Click'
        };
        return res.json(errResp);
    }

    // 2. Check Order existence in SmartPOS Pro
    let sale = null;
    try {
        const strVal = String(merchant_trans_id).trim();
        const isNum = /^\d+$/.test(strVal);
        let saleRes;
        if (isNum) {
            saleRes = await pool.query(
                `SELECT id, total_amount, final_amount, status, payment_status, organization_id 
                 FROM sales WHERE id = $1 OR document_number = $2 OR document_number = $3 LIMIT 1`,
                [parseInt(strVal), strVal, `ПРД-${strVal}`]
            );
        } else {
            saleRes = await pool.query(
                `SELECT id, total_amount, final_amount, status, payment_status, organization_id 
                 FROM sales WHERE document_number = $1 OR document_number = $2 LIMIT 1`,
                [strVal, strVal.replace(/^ПРД-/, '')]
            );
        }
        sale = saleRes.rows[0] || null;
    } catch (e) {
        console.error('Error finding sale in Click Prepare:', e.message);
    }

    if (!sale) {
        console.error(`❌ Click Prepare ORDER NOT FOUND: ${merchant_trans_id}`);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -5,
            error_note: 'Order does not exist'
        };
        await logProviderRequest('click', 'PREPARE_NO_ORDER', req.headers, body, errResp, req);
        return res.json(errResp);
    }

    if (sale.payment_status === 'paid' || sale.status === 'paid') {
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -4,
            error_note: 'Already paid'
        };
        return res.json(errResp);
    }

    const expectedAmount = parseFloat(
        sale.final_amount !== null && sale.final_amount !== undefined && parseFloat(sale.final_amount) > 0
            ? sale.final_amount
            : sale.total_amount
    );
    const reqAmount = parseFloat(numAmt);

    if (Math.abs(expectedAmount - reqAmount) > 0.01) {
        console.error(`❌ Click Prepare INCORRECT AMOUNT: expected ${expectedAmount}, received ${reqAmount}`);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -2,
            error_note: `Incorrect amount. Expected: ${expectedAmount}, received: ${reqAmount}`
        };
        return res.json(errResp);
    }

    // 3. Create or Check transaction record in click_transactions
    let prepareId;
    try {
        const txCheck = await pool.query(
            'SELECT * FROM click_transactions WHERE click_trans_id = $1',
            [click_trans_id]
        );

        if (txCheck.rows.length > 0) {
            prepareId = txCheck.rows[0].id;
        } else {
            const insRes = await pool.query(
                `INSERT INTO click_transactions 
                (click_trans_id, service_id, click_paydoc_send_id, merchant_trans_id, amount, action, sign_time, status, organization_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'PREPARED', $8) 
                RETURNING id`,
                [
                    click_trans_id,
                    service_id,
                    click_paydoc_send_id || null,
                    merchant_trans_id,
                    reqAmount,
                    0,
                    sign_time,
                    sale.organization_id || 1
                ]
            );
            prepareId = insRes.rows[0].id;
        }

        // Update merchant_prepare_id
        await pool.query('UPDATE click_transactions SET merchant_prepare_id = $1 WHERE id = $2', [prepareId, prepareId]);
    } catch (e) {
        console.error('❌ Click Prepare DB Error:', e);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_prepare_id: null,
            error: -7,
            error_note: 'Database error'
        };
        return res.json(errResp);
    }

    const responsePayload = {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: prepareId,
        error: 0,
        error_note: 'Success'
    };

    await logProviderRequest('click', 'PREPARE_SUCCESS', req.headers, body, responsePayload, req);
    return res.json(responsePayload);
});

/**
 * 2. Click Complete Endpoint (action = 1)
 */
router.post('/click/complete', async (req, res) => {
    const body = req.body || {};
    const {
        click_trans_id,
        service_id,
        click_paydoc_send_id,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
        action,
        error,
        error_note,
        sign_time,
        sign_string
    } = body;

    const config = getClickConfig();

    console.log('[CLICK COMPLETE INCOMING]', JSON.stringify(body));

    const paramAmt = body.param_amount !== undefined && body.param_amount !== null ? body.param_amount : amount;
    const numAmt = parseFloat(paramAmt || 0);

    const possibleSigns = [
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${merchant_prepare_id}${paramAmt}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${merchant_prepare_id}${numAmt.toFixed(2)}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${merchant_prepare_id}${numAmt.toFixed(4)}${action}${sign_time}`),
        md5(`${click_trans_id}${service_id}${config.secretKey}${merchant_trans_id}${merchant_prepare_id}${Math.round(numAmt)}${action}${sign_time}`)
    ];

    if (!possibleSigns.includes(sign_string)) {
        console.error(`❌ Click Complete SIGN CHECK FAILED! Received: ${sign_string}, Expected one of:`, possibleSigns);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: null,
            error: -1,
            error_note: 'SIGN CHECK FAILED!'
        };
        await logProviderRequest('click', 'COMPLETE_SIGN_ERR', req.headers, body, errResp, req);
        return res.json(errResp);
    }

    if (parseInt(action) !== 1) {
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: null,
            error: -3,
            error_note: 'Action not found'
        };
        return res.json(errResp);
    }

    // Find prepare transaction
    const txRes = await pool.query(
        'SELECT * FROM click_transactions WHERE click_trans_id = $1 OR id = $2',
        [click_trans_id, merchant_prepare_id || 0]
    );

    if (txRes.rows.length === 0) {
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: null,
            error: -9,
            error_note: 'Transaction not found'
        };
        return res.json(errResp);
    }

    const tx = txRes.rows[0];

    if (tx.status === 'PAID') {
        const responsePayload = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: tx.id,
            error: 0,
            error_note: 'Success (Already paid)'
        };
        return res.json(responsePayload);
    }

    if (parseInt(error) < 0) {
        // Cancelled on Click side
        await pool.query(
            "UPDATE click_transactions SET status = 'CANCELLED', error = $1, error_note = $2 WHERE id = $3",
            [error, error_note || 'Cancelled', tx.id]
        );
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: tx.id,
            error: -6,
            error_note: 'Transaction cancelled'
        };
        return res.json(errResp);
    }

    // 2. Perform payment completion
    try {
        // Update click transaction
        await pool.query(
            "UPDATE click_transactions SET status = 'PAID', action = 1, error = 0, error_note = 'Success' WHERE id = $1",
            [tx.id]
        );

        // Update sale payment status in SmartPOS Pro
        const strMerch = String(merchant_trans_id).trim();
        const isNumMerch = /^\d+$/.test(strMerch);
        let saleRes;
        if (isNumMerch) {
            saleRes = await pool.query('SELECT * FROM sales WHERE id = $1 OR document_number = $2 LIMIT 1', [parseInt(strMerch), strMerch]);
        } else {
            saleRes = await pool.query('SELECT * FROM sales WHERE document_number = $1 LIMIT 1', [strMerch]);
        }

        if (saleRes.rows.length > 0) {
            const sale = saleRes.rows[0];
            if (sale.status === 'draft' || sale.status === 'pending') {
                const itemsRes = await pool.query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
                for (const item of itemsRes.rows) {
                    await pool.query(
                        `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, organization_id)
                         VALUES ($1, $2, 'sale', $3, $4, $5)`,
                        [item.product_id, sale.warehouse_id, sale.id, item.quantity, sale.organization_id || 1]
                    );
                }
                await pool.query(
                    `UPDATE sales SET payment_status = 'paid', status = 'confirmed', payment_method = 'click', updated_at = NOW() WHERE id = $1`,
                    [sale.id]
                );
            } else {
                await pool.query(
                    `UPDATE sales SET payment_status = 'paid', payment_method = 'click', updated_at = NOW() WHERE id = $1`,
                    [sale.id]
                );
            }
        }

        // Insert record into payments table
        try {
            await pool.query(
                `INSERT INTO payments 
                (document_number, document_date, payment_type, amount, payment_method, notes, organization_id) 
                VALUES ($1, NOW(), 'incoming', $2, 'click', $3, $4)`,
                [`CLICK-${click_trans_id}`, amount, `Оплата Click чека #${merchant_trans_id}`, tx.organization_id || 1]
            );
        } catch (pe) {
            console.error('Notice: Payment log error:', pe.message);
        }
    } catch (e) {
        console.error('❌ Click Complete DB Error:', e);
        const errResp = {
            click_trans_id,
            merchant_trans_id,
            merchant_confirm_id: tx.id,
            error: -7,
            error_note: 'Database update failed'
        };
        return res.json(errResp);
    }

    const responsePayload = {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: tx.id,
        error: 0,
        error_note: 'Success'
    };

    await logProviderRequest('click', 'COMPLETE_SUCCESS', req.headers, body, responsePayload, req);
    return res.json(responsePayload);
});

export default router;
