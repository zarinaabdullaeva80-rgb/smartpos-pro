import express from 'express';
import pool from '../config/database.js';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// BOT SETTINGS API - For customers to configure their own bot
// ============================================================================

/**
 * GET /api/telegram/bot-settings
 * Get bot settings for current license
 */
router.get('/bot-settings', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;

        if (!licenseId) {
            return res.status(400).json({ error: 'License not found' });
        }

        const result = await pool.query(
            `SELECT id, bot_username, bot_first_name, webhook_url, is_active, is_verified, created_at, updated_at
             FROM telegram_bots WHERE license_id = $1`,
            [licenseId]
        );

        if (result.rows.length === 0) {
            return res.json({ configured: false });
        }

        const bot = result.rows[0];
        res.json({
            configured: true,
            bot: {
                id: bot.id,
                username: bot.bot_username,
                firstName: bot.bot_first_name,
                webhookUrl: bot.webhook_url,
                isActive: bot.is_active,
                isVerified: bot.is_verified,
                createdAt: bot.created_at,
                updatedAt: bot.updated_at
            }
        });
    } catch (error) {
        console.error('Error getting bot settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/telegram/bot-settings
 * Save or update bot token for current license
 */
router.post('/bot-settings', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const { botToken } = req.body;

        if (!licenseId) {
            return res.status(400).json({ error: 'License not found' });
        }

        if (!botToken || !botToken.includes(':')) {
            return res.status(400).json({ error: 'Invalid bot token format' });
        }

        // Verify token with Telegram API
        const verifyResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const verifyData = await verifyResponse.json();

        if (!verifyData.ok) {
            return res.status(400).json({ error: 'Invalid bot token. Please check and try again.' });
        }

        const botInfo = verifyData.result;
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        // Check if bot already exists for this license
        const existing = await pool.query(
            'SELECT id FROM telegram_bots WHERE license_id = $1',
            [licenseId]
        );

        if (existing.rows.length > 0) {
            // Update existing bot
            await pool.query(
                `UPDATE telegram_bots 
                 SET bot_token = $1, bot_username = $2, bot_first_name = $3, 
                     webhook_secret = $4, is_verified = true, is_active = true, updated_at = NOW()
                 WHERE license_id = $5`,
                [botToken, botInfo.username, botInfo.first_name, webhookSecret, licenseId]
            );
        } else {
            // Create new bot entry
            await pool.query(
                `INSERT INTO telegram_bots (license_id, bot_token, bot_username, bot_first_name, webhook_secret, is_verified, is_active)
                 VALUES ($1, $2, $3, $4, $5, true, true)`,
                [licenseId, botToken, botInfo.username, botInfo.first_name, webhookSecret]
            );
        }

        res.json({
            success: true,
            bot: {
                username: botInfo.username,
                firstName: botInfo.first_name
            },
            webhookSecret
        });
    } catch (error) {
        console.error('Error saving bot settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/telegram/setup-webhook
 * Setup webhook for the bot
 */
router.post('/setup-webhook', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const { webhookBaseUrl } = req.body;

        if (!licenseId) {
            return res.status(400).json({ error: 'License not found' });
        }

        // Get bot settings
        const result = await pool.query(
            'SELECT bot_token, webhook_secret FROM telegram_bots WHERE license_id = $1',
            [licenseId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Bot not configured. Please add bot token first.' });
        }

        const { bot_token, webhook_secret } = result.rows[0];
        const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook/${webhook_secret}`;

        // Set webhook on Telegram
        const response = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query']
            })
        });

        const data = await response.json();

        if (!data.ok) {
            return res.status(400).json({ error: 'Failed to set webhook: ' + data.description });
        }

        // Save webhook URL
        await pool.query(
            'UPDATE telegram_bots SET webhook_url = $1, updated_at = NOW() WHERE license_id = $2',
            [webhookUrl, licenseId]
        );

        res.json({ success: true, webhookUrl });
    } catch (error) {
        console.error('Error setting up webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/telegram/test-message
 * Send test message to all linked chats
 */
router.post('/test-message', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;
        const { message } = req.body;

        if (!licenseId) {
            return res.status(400).json({ error: 'License not found' });
        }

        // Get bot token
        const botResult = await pool.query(
            'SELECT bot_token FROM telegram_bots WHERE license_id = $1 AND is_active = true',
            [licenseId]
        );

        if (botResult.rows.length === 0) {
            return res.status(400).json({ error: 'Bot not configured' });
        }

        const botToken = botResult.rows[0].bot_token;

        // Get all active chats for this license
        const chatsResult = await pool.query(
            'SELECT chat_id FROM telegram_chats WHERE license_id = $1 AND is_active = true',
            [licenseId]
        );

        if (chatsResult.rows.length === 0) {
            return res.status(400).json({ error: 'No active chats. Send /start to your bot first.' });
        }

        let sent = 0;
        for (const chat of chatsResult.rows) {
            try {
                await sendMessageWithToken(botToken, chat.chat_id, `🔔 Тестовое сообщение\n\n${message || 'Это тестовое сообщение от SmartPOS Pro!'}`);
                sent++;
            } catch (e) {
                console.error('Error sending to chat:', chat.chat_id, e);
            }
        }

        res.json({ success: true, sent });
    } catch (error) {
        console.error('Error sending test message:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/telegram/bot-settings
 * Disable bot for current license
 */
router.delete('/bot-settings', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;

        if (!licenseId) {
            return res.status(400).json({ error: 'License not found' });
        }

        // Get bot token to delete webhook
        const result = await pool.query(
            'SELECT bot_token FROM telegram_bots WHERE license_id = $1',
            [licenseId]
        );

        if (result.rows.length > 0) {
            const botToken = result.rows[0].bot_token;

            // Delete webhook
            await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);

            // Deactivate bot in database
            await pool.query(
                'UPDATE telegram_bots SET is_active = false, updated_at = NOW() WHERE license_id = $1',
                [licenseId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error disabling bot:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/telegram/chats
 * Get all linked chats for current license
 */
router.get('/chats', authenticate, async (req, res) => {
    try {
        const licenseId = req.user.license_id;

        const result = await pool.query(
            `SELECT id, chat_id, username, first_name, is_active, created_at
             FROM telegram_chats 
             WHERE license_id = $1
             ORDER BY created_at DESC`,
            [licenseId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/telegram/chats/:id
 * Remove a chat link
 */
router.delete('/chats/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const licenseId = req.user.license_id;

        await pool.query(
            'DELETE FROM telegram_chats WHERE id = $1 AND license_id = $2',
            [id, licenseId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// WEBHOOK HANDLER - Multi-tenant webhook for all bots
// ============================================================================

/**
 * POST /api/telegram/webhook/:secret
 * Webhook endpoint for Telegram updates (multi-tenant)
 */
router.post('/webhook/:secret', async (req, res) => {
    try {
        const { secret } = req.params;
        const update = req.body;

        // Find bot by webhook secret
        const botResult = await pool.query(
            'SELECT id, license_id, bot_token FROM telegram_bots WHERE webhook_secret = $1 AND is_active = true',
            [secret]
        );

        if (botResult.rows.length === 0) {
            return res.sendStatus(404);
        }

        const bot = botResult.rows[0];

        if (update.message) {
            await handleMessageMultiTenant(update.message, bot);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.sendStatus(500);
    }
});

/**
 * Handle message for multi-tenant bot
 */
async function handleMessageMultiTenant(message, bot) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const username = message.from.username;
    const firstName = message.from.first_name;

    // /start command - register chat
    if (text === '/start') {
        // Check if chat already exists
        const existing = await pool.query(
            'SELECT id FROM telegram_chats WHERE chat_id = $1 AND license_id = $2',
            [chatId, bot.license_id]
        );

        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO telegram_chats (chat_id, username, first_name, license_id, is_active)
                 VALUES ($1, $2, $3, $4, true)`,
                [chatId, username, firstName, bot.license_id]
            );
        }

        await sendMessageWithToken(bot.bot_token, chatId,
            `✅ Добро пожаловать в SmartPOS Pro!\n\n` +
            `Вы подключены к системе уведомлений.\n\n` +
            `Доступные команды:\n` +
            `/sales - 📊 Продажи за сегодня\n` +
            `/stock - 📦 Критические остатки\n` +
            `/help - ℹ️ Помощь`
        );
        return;
    }

    // /sales command
    if (text === '/sales') {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(total_amount), 0) as total
            FROM sales
            WHERE DATE(document_date) = CURRENT_DATE
            AND status = 'confirmed'
            AND license_id = $1
        `, [bot.license_id]);

        const { count, total } = result.rows[0];
        await sendMessageWithToken(bot.bot_token, chatId,
            `📊 <b>Продажи за сегодня:</b>\n\n` +
            `Чеков: ${count}\n` +
            `Сумма: ${parseFloat(total).toLocaleString('ru-RU')} сум`
        );
        return;
    }

    // /stock command
    if (text === '/stock') {
        const result = await pool.query(`
            SELECT p.name, COALESCE(SUM(im.quantity), 0) as qty
            FROM products p
            LEFT JOIN inventory_movements im ON p.id = im.product_id
            WHERE p.license_id = $1
            GROUP BY p.id, p.name
            HAVING COALESCE(SUM(im.quantity), 0) < 10
            ORDER BY COALESCE(SUM(im.quantity), 0)
            LIMIT 10
        `, [bot.license_id]);

        if (result.rows.length === 0) {
            await sendMessageWithToken(bot.bot_token, chatId, '✅ Все товары в норме!');
        } else {
            let msg = '⚠️ <b>Товары с низким остатком:</b>\n\n';
            result.rows.forEach(row => {
                msg += `• ${row.name}: ${row.qty} шт.\n`;
            });
            await sendMessageWithToken(bot.bot_token, chatId, msg);
        }
        return;
    }

    // /help or unknown
    await sendMessageWithToken(bot.bot_token, chatId,
        `ℹ️ <b>Доступные команды:</b>\n\n` +
        `/sales - 📊 Продажи за сегодня\n` +
        `/stock - 📦 Критические остатки\n` +
        `/help - ℹ️ Эта справка`
    );
}

/**
 * Send message using specific bot token
 */
async function sendMessageWithToken(botToken, chatId, text) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });

    if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Send notification to all chats of a license
 */
export async function sendLicenseNotification(licenseId, title, message) {
    try {
        // Get bot token
        const botResult = await pool.query(
            'SELECT bot_token FROM telegram_bots WHERE license_id = $1 AND is_active = true',
            [licenseId]
        );

        if (botResult.rows.length === 0) {
            return false;
        }

        const botToken = botResult.rows[0].bot_token;

        // Get all active chats
        const chatsResult = await pool.query(
            'SELECT chat_id FROM telegram_chats WHERE license_id = $1 AND is_active = true',
            [licenseId]
        );

        const text = `<b>${title}</b>\n\n${message}`;

        for (const chat of chatsResult.rows) {
            try {
                await sendMessageWithToken(botToken, chat.chat_id, text);
            } catch (e) {
                console.error('Error sending notification to chat:', e);
            }
        }

        return true;
    } catch (error) {
        console.error('Error sending license notification:', error);
        return false;
    }
}

export default router;
