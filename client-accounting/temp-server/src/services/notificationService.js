import pool from '../config/database.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class NotificationService {
    constructor() {
        this.emailTransporter = null;
        this.initEmailTransporter();
    }

    // Инициализация email транспорта
    async initEmailTransporter() {
        try {
            // Получаем настройки из system_settings
            const settingsResult = await pool.query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'notifications'"
            );

            if (settingsResult.rows.length > 0) {
                const settings = settingsResult.rows[0].setting_value;

                if (settings.email_enabled) {
                    this.emailTransporter = nodemailer.createTransporter({
                        host: settings.smtp_host,
                        port: settings.smtp_port,
                        secure: settings.smtp_secure || false,
                        auth: {
                            user: settings.smtp_user,
                            pass: settings.smtp_password
                        }
                    });

                    console.log('✅ Email transporter initialized');
                }
            }
        } catch (error) {
            console.error('❌ Error initializing email transporter:', error);
        }
    }

    // Создать уведомление
    async createNotification({ userId, type, category, title, message, data = {}, priority = 'normal', actionUrl = null, expiresAt = null }) {
        try {
            const result = await pool.query(
                `INSERT INTO notifications (user_id, type, category, title, message, data, priority, action_url, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [userId, type, category, title, message, JSON.stringify(data), priority, actionUrl, expiresAt]
            );

            const notification = result.rows[0];

            // Автоматически отправить по подпискам
            await this.sendNotificationBySubscriptions(notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Создать уведомление из шаблона
    async createFromTemplate(templateCode, userId, variables = {}) {
        try {
            // Получить шаблон
            const templateResult = await pool.query(
                'SELECT * FROM notification_templates WHERE code = $1 AND is_active = true',
                [templateCode]
            );

            if (templateResult.rows.length === 0) {
                throw new Error(`Template ${templateCode} not found`);
            }

            const template = templateResult.rows[0];

            // Заменить переменные в шаблоне
            const title = this.replaceVariables(template.title_template, variables);
            const message = this.replaceVariables(template.message_template, variables);

            // Создать уведомление
            return await this.createNotification({
                userId,
                type: 'info', // Можно параметризовать
                category: template.category,
                title,
                message,
                data: variables,
                priority: template.default_priority
            });
        } catch (error) {
            console.error('Error creating notification from template:', error);
            throw error;
        }
    }

    // Заменить переменные в шаблоне
    replaceVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    // Отправить уведомление по подпискам пользователя
    async sendNotificationBySubscriptions(notification) {
        try {
            // Получить подписки пользователя для данной категории
            const subsResult = await pool.query(
                `SELECT * FROM notification_subscriptions 
                 WHERE user_id = $1 AND category = $2 AND is_enabled = true`,
                [notification.user_id, notification.category]
            );

            for (const sub of subsResult.rows) {
                switch (sub.channel) {
                    case 'email':
                        await this.sendEmailNotification(notification);
                        break;
                    case 'push':
                        await this.sendPushNotification(notification);
                        break;
                    case 'telegram':
                        await this.sendTelegramNotification(notification);
                        break;
                }
            }
        } catch (error) {
            console.error('Error sending by subscriptions:', error);
        }
    }

    // Отправить email уведомление
    async sendEmailNotification(notification) {
        try {
            if (!this.emailTransporter) {
                console.log('Email transporter not configured');
                return;
            }

            // Получить email пользователя
            const userResult = await pool.query(
                'SELECT email FROM users WHERE id = $1',
                [notification.user_id]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const userEmail = userResult.rows[0].email;

            // Получить настройки
            const settingsResult = await pool.query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'notifications'"
            );
            const settings = settingsResult.rows[0]?.setting_value || {};

            // Отправить email
            const info = await this.emailTransporter.sendMail({
                from: settings.smtp_from || process.env.SMTP_FROM,
                to: userEmail,
                subject: notification.title,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">${notification.title}</h2>
                        <p>${notification.message}</p>
                        ${notification.action_url ? `<a href="${notification.action_url}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Открыть</a>` : ''}
                        <hr style="margin-top: 20px; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px;">Это автоматическое уведомление от системы 1С Бухгалтерия</p>
                    </div>
                `
            });

            // Записать в лог
            await pool.query(
                `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, sent_at, metadata)
                 VALUES ($1, 'email', $2, 'sent', NOW(), $3)`,
                [notification.id, userEmail, JSON.stringify({ messageId: info.messageId })]
            );

            console.log(`✅ Email sent to ${userEmail}`);
        } catch (error) {
            console.error('Error sending email:', error);

            // Записать ошибку в лог
            await pool.query(
                `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, error_message)
                 VALUES ($1, 'email', $2, 'failed', $3)`,
                [notification.id, userResult?.rows[0]?.email || 'unknown', error.message]
            );
        }
    }

    // Отправить push уведомление (через Socket.IO если подключен)
    async sendPushNotification(notification) {
        try {
            // Используем Socket.IO для real-time push в браузер
            const { default: { io } } = await import('../index.js').catch(() => ({ default: { io: null } }));
            if (io) {
                io.to(`user_${notification.user_id}`).emit('notification', {
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    category: notification.category,
                    created_at: notification.created_at
                });
                console.log(`📱 Push sent via Socket.IO to user ${notification.user_id}`);
            } else {
                console.log(`📱 Push notification (Socket.IO not available): ${notification.title}`);
            }

            // Log delivery
            await pool.query(
                `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, sent_at)
                 VALUES ($1, 'push', $2, 'sent', NOW())`,
                [notification.id, `user_${notification.user_id}`]
            ).catch(() => {});
        } catch (error) {
            console.error('Error sending push:', error.message);
        }
    }

    // Отправить Telegram уведомление
    async sendTelegramNotification(notification) {
        try {
            // Загрузить конфиг Telegram из system_settings
            const configResult = await pool.query(
                "SELECT setting_value FROM system_settings WHERE setting_key = 'telegram'"
            );

            if (configResult.rows.length === 0) {
                console.log('📨 Telegram not configured — skipping');
                return;
            }

            const config = configResult.rows[0].setting_value;

            if (!config.enabled || !config.bot_token || !config.chat_id) {
                console.log('📨 Telegram disabled or missing bot_token/chat_id');
                return;
            }

            // Форматируем сообщение
            const typeEmoji = {
                info: 'ℹ️', warning: '⚠️', error: '🚨', success: '✅'
            };
            const emoji = typeEmoji[notification.type] || '📋';
            const text = `${emoji} <b>${notification.title}</b>\n\n${notification.message}\n\n🕐 ${new Date().toLocaleString('ru-RU')}`;

            // Отправляем через Telegram Bot API
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.chat_id,
                    text,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();

            if (result.ok) {
                console.log(`📨 Telegram notification sent: ${notification.title}`);
                // Log delivery
                await pool.query(
                    `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, sent_at, metadata)
                     VALUES ($1, 'telegram', $2, 'sent', NOW(), $3)`,
                    [notification.id, config.chat_id, JSON.stringify({ message_id: result.result?.message_id })]
                ).catch(() => {});
            } else {
                console.error('Telegram API error:', result.description);
                await pool.query(
                    `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, error_message)
                     VALUES ($1, 'telegram', $2, 'failed', $3)`,
                    [notification.id, config.chat_id, result.description]
                ).catch(() => {});
            }
        } catch (error) {
            console.error('Error sending Telegram notification:', error.message);
        }
    }

    // Получить уведомления пользователя
    async getUserNotifications(userId, { limit = 50, offset = 0, onlyUnread = false } = {}) {
        try {
            let query = `
                SELECT * FROM notifications 
                WHERE user_id = $1 
                ${onlyUnread ? 'AND is_read = false' : ''}
                AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC 
                LIMIT $2 OFFSET $3
            `;

            const result = await pool.query(query, [userId, limit, offset]);

            // Подсчитать непрочитанные
            const countResult = await pool.query(
                'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
                [userId]
            );

            return {
                notifications: result.rows,
                unreadCount: parseInt(countResult.rows[0].unread_count)
            };
        } catch (error) {
            console.error('Error getting notifications:', error);
            throw error;
        }
    }

    // Пометить как прочитанное
    async markAsRead(notificationId, userId) {
        try {
            const result = await pool.query(
                `UPDATE notifications 
                 SET is_read = true, read_at = NOW() 
                 WHERE id = $1 AND user_id = $2 
                 RETURNING *`,
                [notificationId, userId]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error marking as read:', error);
            throw error;
        }
    }

    // Пометить все как прочитанные
    async markAllAsRead(userId) {
        try {
            await pool.query(
                `UPDATE notifications 
                 SET is_read = true, read_at = NOW() 
                 WHERE user_id = $1 AND is_read = false`,
                [userId]
            );
        } catch (error) {
            console.error('Error marking all as read:', error);
            throw error;
        }
    }

    // Получить подписки пользователя
    async getUserSubscriptions(userId) {
        try {
            const result = await pool.query(
                'SELECT * FROM notification_subscriptions WHERE user_id = $1',
                [userId]
            );

            return result.rows;
        } catch (error) {
            console.error('Error getting subscriptions:', error);
            throw error;
        }
    }

    // Обновить подписку
    async updateSubscription(userId, channel, category, isEnabled) {
        try {
            const result = await pool.query(
                `INSERT INTO notification_subscriptions (user_id, channel, category, is_enabled)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, channel, category) 
                 DO UPDATE SET is_enabled = $4, updated_at = NOW()
                 RETURNING *`,
                [userId, channel, category, isEnabled]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }

    // Удалить старые уведомления
    async cleanupOldNotifications(daysOld = 30) {
        try {
            const result = await pool.query(
                `DELETE FROM notifications 
                 WHERE created_at < NOW() - INTERVAL '${daysOld} days'
                 OR (expires_at IS NOT NULL AND expires_at < NOW())
                 RETURNING id`
            );

            console.log(`🧹 Cleaned up ${result.rowCount} old notifications`);
            return result.rowCount;
        } catch (error) {
            console.error('Error cleaning up notifications:', error);
            throw error;
        }
    }
}

export default new NotificationService();
