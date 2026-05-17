import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { handleTelegramUpdate } from '../services/telegramAdminBot.js';

const router = express.Router();

// GET /api/telegram/bot-settings - Get current bot settings
router.get('/bot-settings', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const result = await pool.query(
            'SELECT * FROM telegram_bots WHERE organization_id = $1 LIMIT 1',
            [orgId]
        );
        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Error fetching bot settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/telegram/bot-settings - Save bot settings
router.post('/bot-settings', authenticate, async (req, res) => {
    try {
        const { botToken } = req.body;
        const orgId = req.user?.organization_id;

        let botUsername = 'SmartPOSBot';
        let botName = 'SmartPOS Bot';

        if (botToken) {
            try {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.ok && data.result) {
                        botUsername = data.result.username;
                        botName = data.result.first_name;
                    }
                }
            } catch (err) {
                console.warn('Could not contact Telegram API:', err.message);
            }
        }

        const checkResult = await pool.query(
            'SELECT id FROM telegram_bots WHERE organization_id = $1',
            [orgId]
        );

        let result;
        if (checkResult.rows.length > 0) {
            result = await pool.query(
                `UPDATE telegram_bots 
                 SET bot_token = $1, bot_username = $2, bot_name = $3, updated_at = NOW() 
                 WHERE organization_id = $4 RETURNING *`,
                [botToken, botUsername, botName, orgId]
            );
        } else {
            result = await pool.query(
                `INSERT INTO telegram_bots (bot_token, bot_username, bot_name, organization_id)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [botToken, botUsername, botName, orgId]
            );
        }

        res.json({ success: true, bot: result.rows[0] });
    } catch (error) {
        console.error('Error saving bot settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/telegram/bot-settings - Delete bot settings
router.delete('/bot-settings', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        await pool.query('DELETE FROM telegram_bots WHERE organization_id = $1', [orgId]);
        res.json({ success: true, message: 'Settings deleted' });
    } catch (error) {
        console.error('Error deleting bot settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/telegram/chats - Get active chats
router.get('/chats', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const result = await pool.query(
            'SELECT * FROM telegram_chats WHERE organization_id = $1 ORDER BY created_at DESC',
            [orgId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/telegram/chats/:id - Remove a chat
router.delete('/chats/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organization_id;
        await pool.query(
            'DELETE FROM telegram_chats WHERE id = $1 AND organization_id = $2',
            [id, orgId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/telegram/setup-webhook - Setup Telegram webhook
router.post('/setup-webhook', authenticate, async (req, res) => {
    try {
        const { webhookBaseUrl } = req.body;
        const orgId = req.user?.organization_id;

        const botResult = await pool.query(
            'SELECT bot_token FROM telegram_bots WHERE organization_id = $1 LIMIT 1',
            [orgId]
        );

        if (botResult.rows.length === 0) {
            return res.status(400).json({ error: 'Bot is not configured' });
        }

        const botToken = botResult.rows[0].bot_token;
        const webhookUrl = `${webhookBaseUrl}/api/telegram/webhook/${botToken}`;

        let success = false;
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
            if (response.ok) {
                const data = await response.json();
                success = data.ok;
            }
        } catch (err) {
            console.error('Failed to set webhook:', err);
        }

        res.json({ success, webhookUrl });
    } catch (error) {
        console.error('Error setting up webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/telegram/test-message - Send test message
router.post('/test-message', authenticate, async (req, res) => {
    try {
        const { message } = req.body;
        const orgId = req.user?.organization_id;

        const botResult = await pool.query(
            'SELECT bot_token FROM telegram_bots WHERE organization_id = $1 LIMIT 1',
            [orgId]
        );

        if (botResult.rows.length === 0) {
            return res.status(400).json({ error: 'Bot is not configured' });
        }

        const botToken = botResult.rows[0].bot_token;
        const chats = await pool.query(
            'SELECT chat_id FROM telegram_chats WHERE organization_id = $1',
            [orgId]
        );

        if (chats.rows.length === 0) {
            return res.status(400).json({ error: 'No active chats connected' });
        }

        let sentCount = 0;
        for (const chat of chats.rows) {
            try {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chat.chat_id,
                        text: message || 'Тестовое сообщение от SmartPOS Pro'
                    })
                });
                if (response.ok) sentCount++;
            } catch (err) {
                console.error(`Failed to send test message to chat ${chat.chat_id}:`, err);
            }
        }

        res.json({ success: sentCount > 0, sent: sentCount });
    } catch (error) {
        console.error('Error sending test message:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/telegram/webhook/admin - Webhook for the system admin Telegram bot
router.post('/webhook/admin', async (req, res) => {
    try {
        await handleTelegramUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('[TELEGRAM-BOT] Webhook receiver error:', err.message);
        res.sendStatus(500);
    }
});

export default router;
