import pool from '../config/database.js';
import nodemailer from 'nodemailer';

// Инициализация таблицы настроек алертов
const initAlertsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_settings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                email_enabled BOOLEAN DEFAULT FALSE,
                telegram_enabled BOOLEAN DEFAULT FALSE,
                telegram_chat_id VARCHAR(100),
                alert_on_critical BOOLEAN DEFAULT TRUE,
                alert_on_error BOOLEAN DEFAULT FALSE,
                alert_on_warning BOOLEAN DEFAULT FALSE,
                email_address VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_settings_user ON alert_settings(user_id);

            CREATE TABLE IF NOT EXISTS alert_history (
                id SERIAL PRIMARY KEY,
                error_id INTEGER REFERENCES error_logs(id) ON DELETE CASCADE,
                channel VARCHAR(20),
                recipient VARCHAR(255),
                status VARCHAR(20),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ Таблица alert_settings готова');
    } catch (error) {
        console.error('Alert settings table error:', error.message);
    }
};
// Lazy init — таблица создаётся при первом использовании, не при импорте
let alertsTableReady = false;
const ensureAlertsTable = async () => {
    if (alertsTableReady) return;
    await initAlertsTable();
    alertsTableReady = true;
};

// Email transporter (настраивается через env)
const getEmailTransporter = () => {
    if (!process.env.SMTP_HOST) return null;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Telegram API URL
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN
    ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
    : null;

/**
 * Отправить алерт на критическую ошибку
 */
export async function sendErrorAlert(error) {
    try {
        await ensureAlertsTable();
        // Получаем всех админов с настроенными алертами
        const settings = await pool.query(`
            SELECT as2.*, u.email as user_email, u.username
            FROM alert_settings as2
            JOIN users u ON as2.user_id = u.id
            WHERE (as2.alert_on_critical = true AND $1 = 'critical')
               OR (as2.alert_on_error = true AND $1 = 'error')
               OR (as2.alert_on_warning = true AND $1 = 'warning')
        `, [error.severity]);

        const results = [];

        for (const setting of settings.rows) {
            // Email алерт
            if (setting.email_enabled && (setting.email_address || setting.user_email)) {
                const emailResult = await sendEmailAlert(
                    setting.email_address || setting.user_email,
                    error
                );
                results.push(emailResult);
                await logAlert(error.id, 'email', setting.email_address || setting.user_email, emailResult);
            }

            // Telegram алерт
            if (setting.telegram_enabled && setting.telegram_chat_id) {
                const telegramResult = await sendTelegramAlert(
                    setting.telegram_chat_id,
                    error
                );
                results.push(telegramResult);
                await logAlert(error.id, 'telegram', setting.telegram_chat_id, telegramResult);
            }
        }

        return results;
    } catch (err) {
        console.error('Error sending alert:', err);
        return [];
    }
}

/**
 * Отправить Email алерт
 */
async function sendEmailAlert(email, error) {
    const transporter = getEmailTransporter();
    if (!transporter) {
        return { success: false, error: 'SMTP not configured' };
    }

    try {
        const severityEmoji = {
            critical: '🔴',
            error: '🟠',
            warning: '🟡'
        };

        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@1c-accounting.local',
            to: email,
            subject: `${severityEmoji[error.severity] || '⚪'} [${error.severity.toUpperCase()}] ${error.message.substring(0, 50)}`,
            html: `
                <h2>${severityEmoji[error.severity] || '⚪'} ${error.severity.toUpperCase()}: ${error.type}</h2>
                <p><strong>Сообщение:</strong> ${error.message}</p>
                ${error.component ? `<p><strong>Компонент:</strong> ${error.component}</p>` : ''}
                ${error.url ? `<p><strong>URL:</strong> ${error.url}</p>` : ''}
                <p><strong>Время:</strong> ${new Date(error.created_at).toLocaleString('ru-RU')}</p>
                ${error.stack_trace ? `<pre style="background:#f4f4f4;padding:10px;overflow:auto">${error.stack_trace}</pre>` : ''}
                <hr>
                <p><a href="${process.env.ADMIN_URL || 'http://localhost:3001'}">Открыть админ-панель</a></p>
            `
        });

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Отправить Telegram алерт
 */
async function sendTelegramAlert(chatId, error) {
    if (!TELEGRAM_API_URL) {
        return { success: false, error: 'Telegram not configured' };
    }

    try {
        const severityEmoji = {
            critical: '🔴',
            error: '🟠',
            warning: '🟡'
        };

        const text = `${severityEmoji[error.severity] || '⚪'} <b>${error.severity.toUpperCase()}</b>: ${error.type}\n\n` +
            `<b>Сообщение:</b> ${error.message}\n` +
            (error.component ? `<b>Компонент:</b> ${error.component}\n` : '') +
            (error.url ? `<b>URL:</b> ${error.url}\n` : '') +
            `<b>Время:</b> ${new Date(error.created_at).toLocaleString('ru-RU')}`;

        const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
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

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Логировать отправку алерта
 */
async function logAlert(errorId, channel, recipient, result) {
    try {
        await pool.query(`
            INSERT INTO alert_history (error_id, channel, recipient, status, error_message)
            VALUES ($1, $2, $3, $4, $5)
        `, [errorId, channel, recipient, result.success ? 'sent' : 'failed', result.error || null]);
    } catch (err) {
        console.error('Error logging alert:', err.message);
    }
}

/**
 * Тестовый алерт
 */
export async function sendTestAlert(userId, channel) {
    await ensureAlertsTable();
    const testError = {
        id: null,
        severity: 'critical',
        type: 'test',
        message: 'Это тестовое уведомление от системы 1С Бухгалтерия',
        component: 'AlertService',
        url: null,
        created_at: new Date()
    };

    const settings = await pool.query(`
        SELECT * FROM alert_settings WHERE user_id = $1
    `, [userId]);

    if (settings.rows.length === 0) {
        return { success: false, error: 'Настройки не найдены' };
    }

    const setting = settings.rows[0];

    if (channel === 'email') {
        return await sendEmailAlert(setting.email_address, testError);
    } else if (channel === 'telegram') {
        return await sendTelegramAlert(setting.telegram_chat_id, testError);
    }

    return { success: false, error: 'Unknown channel' };
}

export default { sendErrorAlert, sendTestAlert };
