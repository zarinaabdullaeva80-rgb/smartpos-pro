import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';
import { sendTestAlert } from '../services/alerts.js';

const router = express.Router();

// Получить настройки алертов текущего пользователя
router.get('/settings', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        let result = await pool.query(`
            SELECT * FROM alert_settings WHERE user_id = $1
        `, [userId]);

        // Если нет настроек - создаём дефолтные
        if (result.rows.length === 0) {
            await pool.query(`
                INSERT INTO alert_settings (user_id) VALUES ($1)
            `, [userId]);
            result = await pool.query(`
                SELECT * FROM alert_settings WHERE user_id = $1
            `, [userId]);
        }

        res.json({ settings: result.rows[0] });
    } catch (error) {
        console.error('Get alert settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Обновить настройки алертов
router.put('/settings', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            email_enabled,
            telegram_enabled,
            telegram_chat_id,
            alert_on_critical,
            alert_on_error,
            alert_on_warning,
            email_address
        } = req.body;

        await pool.query(`
            INSERT INTO alert_settings (user_id, email_enabled, telegram_enabled, telegram_chat_id,
                alert_on_critical, alert_on_error, alert_on_warning, email_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
                email_enabled = $2,
                telegram_enabled = $3,
                telegram_chat_id = $4,
                alert_on_critical = $5,
                alert_on_error = $6,
                alert_on_warning = $7,
                email_address = $8,
                updated_at = NOW()
        `, [userId, email_enabled, telegram_enabled, telegram_chat_id,
            alert_on_critical, alert_on_error, alert_on_warning, email_address]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update alert settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Отправить тестовый алерт
router.post('/test', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { channel } = req.body; // 'email' или 'telegram'

        const result = await sendTestAlert(userId, channel);

        if (result.success) {
            res.json({ success: true, message: `Тестовое уведомление отправлено через ${channel}` });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Test alert error:', error);
        res.status(500).json({ error: 'Failed to send test alert' });
    }
});

// Получить историю алертов
router.get('/history', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const result = await pool.query(`
            SELECT ah.*, el.message as error_message, el.severity, el.type as error_type
            FROM alert_history ah
            LEFT JOIN error_logs el ON ah.error_id = el.id
            ORDER BY ah.created_at DESC
            LIMIT $1
        `, [parseInt(limit)]);

        res.json({ history: result.rows });
    } catch (error) {
        console.error('Alert history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// Получить статус алертов (для дашборда)
router.get('/status', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const [configuredCount, historyStats] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count FROM alert_settings WHERE email_enabled = true OR telegram_enabled = true`),
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'sent') as sent,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed
                FROM alert_history
                WHERE created_at > NOW() - INTERVAL '24 hours'
            `)
        ]);

        res.json({
            configured: parseInt(configuredCount.rows[0].count),
            last24h: historyStats.rows[0]
        });
    } catch (error) {
        console.error('Alert status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

export default router;
