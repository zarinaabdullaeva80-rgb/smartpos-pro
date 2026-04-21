import nodemailer from 'nodemailer';
import pool from '../config/database.js';

// Создать transporter
let transporter;

const initEmailTransporter = () => {
    if (transporter) return transporter;

    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    };

    // Если SMTP не настроен - использовать ethereal для тестов
    if (!process.env.SMTP_USER) {
        console.warn('SMTP not configured, emails will not be sent');
        return null;
    }

    transporter = nodemailer.createTransport(config);

    // Проверить подключение
    transporter.verify((error, success) => {
        if (error) {
            console.error('SMTP connection error:', error);
        } else {
            console.log('✓ SMTP server ready');
        }
    });

    return transporter;
};

/**
 * Отправить email
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    const transport = initEmailTransporter();

    if (!transport) {
        console.warn('Email not sent (SMTP not configured):', { to, subject });
        return { success: false, error: 'SMTP not configured' };
    }

    try {
        const info = await transport.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            html
        });

        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Отправить email кампанию
 */
export const sendEmailCampaign = async (campaignId) => {
    try {
        // Получить кампанию
        const campaignResult = await pool.query(`
            SELECT ec.*, et.subject, et.body
            FROM email_campaigns ec
            LEFT JOIN email_templates et ON ec.template_id = et.id
            WHERE ec.id = $1
        `, [campaignId]);

        if (campaignResult.rows.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaign = campaignResult.rows[0];

        // Получить получателей
        const recipientsResult = await pool.query(`
            SELECT er.*, c.email, c.name
            FROM email_recipients er
            JOIN counterparties c ON er.customer_id = c.id
            WHERE er.campaign_id = $1 AND er.status = 'pending'
            LIMIT 100
        `, [campaignId]);

        const recipients = recipientsResult.rows;
        let sent = 0;
        let failed = 0;

        // Обновить статус кампании
        await pool.query(`
            UPDATE email_campaigns 
            SET status = 'sending', started_at = NOW()
            WHERE id = $1
        `, [campaignId]);

        // Отправить каждому получателю
        for (const recipient of recipients) {
            try {
                // Персонализировать контент
                let html = campaign.body || '';
                html = html.replace(/{{name}}/g, recipient.name || 'Клиент');
                html = html.replace(/{{email}}/g, recipient.email);

                const result = await sendEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    html
                });

                if (result.success) {
                    sent++;
                    await pool.query(`
                        UPDATE email_recipients 
                        SET status = 'sent', sent_at = NOW()
                        WHERE id = $1
                    `, [recipient.id]);
                } else {
                    failed++;
                    await pool.query(`
                        UPDATE email_recipients 
                        SET status = 'failed', error_message = $2
                        WHERE id = $1
                    `, [recipient.id, result.error]);
                }
            } catch (error) {
                failed++;
                console.error(`Error sending to ${recipient.email}:`, error);
            }

            // Пауза между отправками (чтобы не заблокировали)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Обновить статус кампании
        const finalStatus = failed === 0 ? 'sent' : (sent === 0 ? 'failed' : 'partial');
        await pool.query(`
            UPDATE email_campaigns 
            SET status = $1, finished_at = NOW(), sent_count = $2, failed_count = $3
            WHERE id = $4
        `, [finalStatus, sent, failed, campaignId]);

        return { success: true, sent, failed };

    } catch (error) {
        console.error('Error sending campaign:', error);

        // Обновить статус на ошибку
        await pool.query(`
            UPDATE email_campaigns 
            SET status = 'failed', error_message = $2
            WHERE id = $1
        `, [campaignId, error.message]);

        return { success: false, error: error.message };
    }
};

/**
 * Отправить уведомление по email
 */
export const sendNotificationEmail = async (userId, title, message) => {
    try {
        // Получить email пользователя
        const userResult = await pool.query(`
            SELECT email, full_name
            FROM users
            WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return { success: false, error: 'User not found' };
        }

        const user = userResult.rows[0];

        const html = `
            <h2>${title}</h2>
            <p>Здравствуйте, ${user.full_name}!</p>
            <p>${message}</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
                Это автоматическое уведомление из системы "1С Бухгалтерия"
            </p>
        `;

        return await sendEmail({
            to: user.email,
            subject: title,
            html,
            text: message
        });
    } catch (error) {
        console.error('Error sending notification email:', error);
        return { success: false, error: error.message };
    }
};

export default {
    sendEmail,
    sendEmailCampaign,
    sendNotificationEmail
};
