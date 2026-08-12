/**
 * Payme Merchant API (JSON-RPC 2.0) Route
 * SmartPOS Pro
 */

import express from 'express';
import pool from '../config/database.js';
import { getPaymeConfig } from '../config/paymentConfig.js';

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

// Payme Error codes generator
function paymeError(id, code, messageRu, messageUz = '', messageEn = '') {
    return {
        jsonrpc: '2.0',
        id: id || null,
        error: {
            code,
            message: {
                ru: messageRu,
                uz: messageUz || messageRu,
                en: messageEn || messageRu
            }
        }
    };
}

// Main JSON-RPC Handler
router.post('/payme', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const { method, params, id } = req.body || {};

    // 1. Validate HTTP Basic Auth
    const base64Auth = authHeader.replace(/^Basic\s+/i, '');
    const credentials = Buffer.from(base64Auth, 'base64').toString('utf-8');
    const [login, secretKey] = credentials.split(':');

    const config = getPaymeConfig();
    if (login !== 'Paycom' || (secretKey !== config.secretKey && secretKey !== config.testKey)) {
        const errResp = paymeError(id, -32504, 'Неаутентифицированный доступ');
        await logProviderRequest('payme', method || 'AUTH_FAIL', req.headers, req.body, errResp, req);
        return res.json(errResp);
    }

    if (!method || !params) {
        const errResp = paymeError(id, -32600, 'Некорректный JSON-RPC запрос');
        return res.json(errResp);
    }

    let responsePayload;

    try {
        switch (method) {
            case 'CheckPerformTransaction':
                responsePayload = await handleCheckPerformTransaction(id, params);
                break;
            case 'CreateTransaction':
                responsePayload = await handleCreateTransaction(id, params);
                break;
            case 'PerformTransaction':
                responsePayload = await handlePerformTransaction(id, params);
                break;
            case 'CancelTransaction':
                responsePayload = await handleCancelTransaction(id, params);
                break;
            case 'CheckTransaction':
                responsePayload = await handleCheckTransaction(id, params);
                break;
            case 'GetStatement':
                responsePayload = await handleGetStatement(id, params);
                break;
            default:
                responsePayload = paymeError(id, -32601, 'Запрашиваемый метод не найден');
                break;
        }
    } catch (error) {
        console.error(`❌ Payme RPC Error (${method}):`, error);
        responsePayload = paymeError(id, -32400, 'Внутренняя ошибка системы');
    }

    await logProviderRequest('payme', method, req.headers, req.body, responsePayload, req);
    return res.json(responsePayload);
});

// Helper to find sale by integer ID or string document_number
async function findSaleByIdOrDocNum(orderId) {
    if (!orderId) return null;
    const strVal = String(orderId).trim();
    const isNum = /^\d+$/.test(strVal);
    try {
        let res;
        if (isNum) {
            res = await pool.query(
                `SELECT id, total_amount, final_amount, status, payment_status, organization_id 
                 FROM sales WHERE id = $1 OR document_number = $2 LIMIT 1`,
                [parseInt(strVal), strVal]
            );
        } else {
            res = await pool.query(
                `SELECT id, total_amount, final_amount, status, payment_status, organization_id 
                 FROM sales WHERE document_number = $1 LIMIT 1`,
                [strVal]
            );
        }
        return res.rows[0] || null;
    } catch (e) {
        console.error('Error finding sale:', e.message);
        return null;
    }
}

/**
 * 1. CheckPerformTransaction
 */
async function handleCheckPerformTransaction(id, params) {
    const { amount, account } = params;
    const orderId = account?.order_id;

    if (!orderId) {
        return paymeError(id, -31050, 'Заказ не указан');
    }

    const sale = await findSaleByIdOrDocNum(orderId);

    if (!sale) {
        return paymeError(id, -31050, 'Заказ не найден в базе SmartPOS Pro');
    }

    if (sale.payment_status === 'paid') {
        return paymeError(id, -31099, 'Заказ уже оплачен');
    }

    const saleAmount = parseFloat(sale.final_amount || sale.total_amount || 0);

    // Convert sale.total_amount to tiyin (1 UZS = 100 tiyins)
    const expectedAmountTiyin = Math.round(saleAmount * 100);

    if (Math.abs(expectedAmountTiyin - amount) > 1) {
        return paymeError(id, -31001, `Неверная сумма. Ожидалось: ${expectedAmountTiyin} тийинов, получено: ${amount}`);
    }

    return {
        jsonrpc: '2.0',
        id,
        result: {
            allow: true,
            detail: {
                receipt_type: 0
            }
        }
    };
}

/**
 * 2. CreateTransaction
 */
async function handleCreateTransaction(id, params) {
    const { id: transId, time, amount, account, detail } = params;
    const orderId = account?.order_id;

    // First validate CheckPerformTransaction conditions
    const checkResult = await handleCheckPerformTransaction(id, params);
    if (checkResult.error) {
        // If error is order already paid, let's verify if this transaction already created it
        const existingTx = await pool.query('SELECT * FROM payme_transactions WHERE id = $1', [transId]);
        if (existingTx.rows.length === 0) {
            return checkResult;
        }
    }

    const existingTx = await pool.query('SELECT * FROM payme_transactions WHERE id = $1', [transId]);

    const TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours timeout
    const now = Date.now();

    if (existingTx.rows.length > 0) {
        const tx = existingTx.rows[0];
        if (parseInt(tx.state) === 1) {
            if (now - parseInt(tx.create_time) > TIMEOUT_MS) {
                // Timeout exceeded -> Cancel
                await pool.query(
                    'UPDATE payme_transactions SET state = -1, reason = 4, cancel_time = $1 WHERE id = $2',
                    [now, transId]
                );
                return paymeError(id, -31008, 'Превышено время ожидания транзакции');
            }
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    create_time: parseInt(tx.create_time),
                    transaction: tx.id,
                    state: 1
                }
            };
        } else {
            return paymeError(id, -31008, 'Транзакция уже обработана');
        }
    } else {
        const sale = await findSaleByIdOrDocNum(orderId);
        const internalOrderId = sale?.id || (parseInt(orderId) || 0);

        // Check if there is another pending transaction for this order
        const otherTx = await pool.query(
            'SELECT * FROM payme_transactions WHERE account_order_id = $1 AND state = 1',
            [internalOrderId]
        );
        if (otherTx.rows.length > 0) {
            return paymeError(id, -31050, 'Для данного заказа уже создан активный платеж');
        }

        const orgId = sale?.organization_id || 1;

        const createTime = now;
        const receivers = detail?.share ? JSON.stringify(detail.share) : null;

        await pool.query(
            `INSERT INTO payme_transactions 
            (id, payme_time, amount, account_order_id, create_time, state, receivers, organization_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [transId, time, amount, internalOrderId, createTime, 1, receivers, orgId]
        );

        return {
            jsonrpc: '2.0',
            id,
            result: {
                create_time: createTime,
                transaction: transId,
                state: 1
            }
        };
    }
}

/**
 * 3. PerformTransaction
 */
async function handlePerformTransaction(id, params) {
    const { id: transId } = params;

    const txRes = await pool.query('SELECT * FROM payme_transactions WHERE id = $1', [transId]);

    if (txRes.rows.length === 0) {
        return paymeError(id, -31003, 'Транзакция не найдена');
    }

    const tx = txRes.rows[0];
    const state = parseInt(tx.state);
    const now = Date.now();

    if (state === 1) {
        const TIMEOUT_MS = 12 * 60 * 60 * 1000;
        if (now - parseInt(tx.create_time) > TIMEOUT_MS) {
            await pool.query(
                'UPDATE payme_transactions SET state = -1, reason = 4, cancel_time = $1 WHERE id = $2',
                [now, transId]
            );
            return paymeError(id, -31008, 'Превышено время ожидания транзакции');
        }

        const performTime = now;

        // 1. Update Payme transaction state
        await pool.query(
            'UPDATE payme_transactions SET state = 2, perform_time = $1 WHERE id = $2',
            [performTime, transId]
        );

        // 2. Update SmartPOS Pro sale status
        const orderId = tx.account_order_id;
        await pool.query(
            `UPDATE sales 
             SET payment_status = 'paid', payment_method = 'payme', updated_at = NOW() 
             WHERE id = $1`,
            [orderId]
        );

        // 3. Insert record into payments table
        const amountUz = parseFloat(tx.amount) / 100;
        try {
            await pool.query(
                `INSERT INTO payments 
                (document_number, document_date, payment_type, amount, payment_method, notes, organization_id) 
                VALUES ($1, NOW(), 'incoming', $2, 'payme', $3, $4)`,
                [`PAYME-${transId}`, amountUz, `Оплата Payme чека #${orderId}`, tx.organization_id || 1]
            );
        } catch (pe) {
            console.error('Notice: Payment log error:', pe.message);
        }

        return {
            jsonrpc: '2.0',
            id,
            result: {
                transaction: transId,
                perform_time: performTime,
                state: 2
            }
        };
    } else if (state === 2) {
        return {
            jsonrpc: '2.0',
            id,
            result: {
                transaction: transId,
                perform_time: parseInt(tx.perform_time),
                state: 2
            }
        };
    } else {
        return paymeError(id, -31008, 'Невозможно выполнить отмененную транзакцию');
    }
}

/**
 * 4. CancelTransaction
 */
async function handleCancelTransaction(id, params) {
    const { id: transId, reason } = params;

    const txRes = await pool.query('SELECT * FROM payme_transactions WHERE id = $1', [transId]);

    if (txRes.rows.length === 0) {
        return paymeError(id, -31003, 'Транзакция не найдена');
    }

    const tx = txRes.rows[0];
    const state = parseInt(tx.state);
    const now = Date.now();

    if (state === 1) {
        // Cancel before perform -> state = -1
        await pool.query(
            'UPDATE payme_transactions SET state = -1, cancel_time = $1, reason = $2 WHERE id = $3',
            [now, reason, transId]
        );
        return {
            jsonrpc: '2.0',
            id,
            result: {
                transaction: transId,
                cancel_time: now,
                state: -1
            }
        };
    } else if (state === 2) {
        // Cancel after perform -> state = -2
        await pool.query(
            'UPDATE payme_transactions SET state = -2, cancel_time = $1, reason = $2 WHERE id = $3',
            [now, reason, transId]
        );

        // Revert order status in SmartPOS Pro
        await pool.query(
            `UPDATE sales SET payment_status = 'unpaid', updated_at = NOW() WHERE id = $1`,
            [tx.account_order_id]
        );

        return {
            jsonrpc: '2.0',
            id,
            result: {
                transaction: transId,
                cancel_time: now,
                state: -2
            }
        };
    } else {
        // Already cancelled
        return {
            jsonrpc: '2.0',
            id,
            result: {
                transaction: transId,
                cancel_time: parseInt(tx.cancel_time),
                state
            }
        };
    }
}

/**
 * 5. CheckTransaction
 */
async function handleCheckTransaction(id, params) {
    const { id: transId } = params;

    const txRes = await pool.query('SELECT * FROM payme_transactions WHERE id = $1', [transId]);

    if (txRes.rows.length === 0) {
        return paymeError(id, -31003, 'Транзакция не найдена');
    }

    const tx = txRes.rows[0];

    return {
        jsonrpc: '2.0',
        id,
        result: {
            create_time: parseInt(tx.create_time),
            perform_time: parseInt(tx.perform_time || 0),
            cancel_time: parseInt(tx.cancel_time || 0),
            transaction: tx.id,
            state: parseInt(tx.state),
            reason: tx.reason ? parseInt(tx.reason) : null
        }
    };
}

/**
 * 6. GetStatement
 */
async function handleGetStatement(id, params) {
    const { from, to } = params;

    const txsRes = await pool.query(
        `SELECT * FROM payme_transactions 
         WHERE create_time >= $1 AND create_time <= $2 
         ORDER BY create_time ASC`,
        [from, to]
    );

    const transactions = txsRes.rows.map(tx => ({
        id: tx.id,
        time: parseInt(tx.payme_time),
        amount: parseInt(tx.amount),
        account: { order_id: tx.account_order_id },
        create_time: parseInt(tx.create_time),
        perform_time: parseInt(tx.perform_time || 0),
        cancel_time: parseInt(tx.cancel_time || 0),
        transaction: tx.id,
        state: parseInt(tx.state),
        reason: tx.reason ? parseInt(tx.reason) : null,
        receivers: tx.receivers ? JSON.parse(tx.receivers) : null
    }));

    return {
        jsonrpc: '2.0',
        id,
        result: { transactions }
    };
}

export default router;
