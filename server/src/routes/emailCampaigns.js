import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Создать транспорт для отправки писем
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Убедиться, что таблицы существуют
const ensureTables = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS email_campaigns (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            subject VARCHAR(500) NOT NULL,
            body TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'draft',
            recipients_count INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            delivered_count INTEGER DEFAULT 0,
            opened_count INTEGER DEFAULT 0,
            clicked_count INTEGER DEFAULT 0,
            scheduled_at TIMESTAMP,
            sent_at TIMESTAMP,
            organization_id INTEGER,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS email_recipients (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            sent_at TIMESTAMP,
            opened_at TIMESTAMP,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
};

// Lazy init — таблицы создаются при первом запросе, не при импорте
let tablesReady = false;
const ensureTablesOnce = async () => {
    if (tablesReady) return;
    try {
        await ensureTables();
        tablesReady = true;
    } catch (err) {
        console.error('EmailCampaigns: table init error:', err.message);
    }
};
router.use(async (req, res, next) => {
    await ensureTablesOnce();
    next();
});

/**
 * GET /api/email-campaigns
 * Получить список кампаний
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let query = `
            SELECT ec.*, u.full_name as creator_name
            FROM email_campaigns ec
            LEFT JOIN users u ON ec.created_by = u.id
            WHERE 1=1
        `;
        const params = [];
        if (orgId) {
            query += ` AND (ec.organization_id = $1 OR ec.organization_id IS NULL)`;
            params.push(orgId);
        }
        query += ` ORDER BY ec.created_at DESC`;

        const result = await pool.query(query, params);

        // Статистика
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_campaigns,
                COALESCE(SUM(sent_count), 0) as total_sent,
                COALESCE(AVG(CASE WHEN sent_count > 0 THEN (opened_count::float / sent_count * 100) ELSE 0 END), 0) as avg_open_rate,
                COALESCE(AVG(CASE WHEN opened_count > 0 THEN (clicked_count::float / opened_count * 100) ELSE 0 END), 0) as avg_click_rate
            FROM email_campaigns
            ${orgId ? 'WHERE organization_id = $1 OR organization_id IS NULL' : ''}
        `, orgId ? [orgId] : []);

        // Количество подписчиков (клиенты с email)
        const subscribersResult = await pool.query(`
            SELECT COUNT(*) as count FROM customers WHERE email IS NOT NULL AND email != ''
            ${orgId ? 'AND (organization_id = $1 OR organization_id IS NULL)' : ''}
        `, orgId ? [orgId] : []);

        res.json({
            campaigns: result.rows,
            stats: {
                total_sent: parseInt(statsResult.rows[0]?.total_sent || 0),
                avg_open_rate: Math.round(parseFloat(statsResult.rows[0]?.avg_open_rate || 0)),
                avg_click_rate: Math.round(parseFloat(statsResult.rows[0]?.avg_click_rate || 0)),
                subscribers: parseInt(subscribersResult.rows[0]?.count || 0)
            }
        });
    } catch (error) {
        console.error('EmailCampaigns GET error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * POST /api/email-campaigns
 * Создать новую кампанию
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, subject, body, scheduledAt, recipientEmails } = req.body;
        const orgId = req.user?.organization_id;

        if (!name || !subject || !body) {
            return res.status(400).json({ error: 'Укажите название, тему и текст кампании' });
        }

        const result = await pool.query(`
            INSERT INTO email_campaigns (name, subject, body, status, scheduled_at, organization_id, created_by, recipients_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            name, subject, body,
            scheduledAt ? 'scheduled' : 'draft',
            scheduledAt || null,
            orgId,
            req.user.id,
            recipientEmails?.length || 0
        ]);

        const campaign = result.rows[0];

        // Если переданы конкретные получатели — сохранить их
        if (recipientEmails && recipientEmails.length > 0) {
            for (const email of recipientEmails) {
                await pool.query(`
                    INSERT INTO email_recipients (campaign_id, email) VALUES ($1, $2)
                `, [campaign.id, email]);
            }
        }

        // WebSocket: уведомить о новой кампании
        const io = req.app.get('io');
        if (io) {
            io.emit('campaign:created', { campaign });
        }

        res.status(201).json({ campaign, message: 'Кампания создана' });
    } catch (error) {
        console.error('EmailCampaigns POST error:', error);
        res.status(500).json({ error: 'Ошибка создания кампании' });
    }
});

/**
 * POST /api/email-campaigns/:id/send
 * Отправить кампанию
 */
router.post('/:id/send', authenticate, async (req, res) => {
    const { id } = req.params;
    const orgId = req.user?.organization_id;
    const io = req.app.get('io');

    try {
        // Получить кампанию
        const campResult = await pool.query(
            'SELECT * FROM email_campaigns WHERE id = $1', [id]
        );
        if (campResult.rows.length === 0) {
            return res.status(404).json({ error: 'Кампания не найдена' });
        }
        const campaign = campResult.rows[0];

        if (campaign.status === 'sent') {
            return res.status(400).json({ error: 'Кампания уже отправлена' });
        }

        // Обновить статус на "sending"
        await pool.query(
            `UPDATE email_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`, [id]
        );

        // Получить получателей: сначала из email_recipients, иначе — все клиенты с email
        let recipients = [];
        const recipientsResult = await pool.query(
            'SELECT email, name FROM email_recipients WHERE campaign_id = $1', [id]
        );

        if (recipientsResult.rows.length > 0) {
            recipients = recipientsResult.rows;
        } else {
            // Взять всех клиентов с email из данной лицензии
            const customersResult = await pool.query(`
                SELECT email, name FROM customers 
                WHERE email IS NOT NULL AND email != ''
                ${orgId ? 'AND (organization_id = $1 OR organization_id IS NULL)' : ''}
                LIMIT 500
            `, orgId ? [orgId] : []);
            recipients = customersResult.rows;
        }

        if (recipients.length === 0) {
            await pool.query(
                `UPDATE email_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1`, [id]
            );
            return res.status(400).json({ error: 'Нет получателей для отправки. Добавьте клиентов с email.' });
        }

        // Немедленно ответить клиенту — отправка идёт в фоне
        res.json({
            success: true,
            message: `Отправка начата. Получателей: ${recipients.length}`,
            recipientsCount: recipients.length
        });

        // Отправка в фоне
        (async () => {
            let sentCount = 0;
            let failedCount = 0;

            try {
                const transporter = createTransporter();

                for (const recipient of recipients) {
                    try {
                        await transporter.sendMail({
                            from: process.env.SMTP_FROM || process.env.SMTP_USER,
                            to: recipient.email,
                            subject: campaign.subject,
                            html: campaign.body,
                            text: campaign.body.replace(/<[^>]*>/g, '')
                        });
                        sentCount++;

                        // Обновить статус получателя
                        await pool.query(`
                            UPDATE email_recipients SET status = 'sent', sent_at = NOW()
                            WHERE campaign_id = $1 AND email = $2
                        `, [id, recipient.email]);

                    } catch (emailErr) {
                        failedCount++;
                        console.error(`EmailCampaigns: Failed to send to ${recipient.email}:`, emailErr.message);
                        await pool.query(`
                            UPDATE email_recipients SET status = 'failed', error_message = $1
                            WHERE campaign_id = $2 AND email = $3
                        `, [emailErr.message, id, recipient.email]);
                    }
                }

                // Обновить кампанию
                await pool.query(`
                    UPDATE email_campaigns 
                    SET status = 'sent', sent_at = NOW(), sent_count = $1, 
                        recipients_count = $2, updated_at = NOW()
                    WHERE id = $3
                `, [sentCount, recipients.length, id]);

                // WebSocket: уведомить десктоп об окончании отправки
                if (io) {
                    io.emit('campaign:sent', {
                        campaignId: parseInt(id),
                        sentCount,
                        failedCount,
                        status: 'sent'
                    });
                }

                console.log(`EmailCampaigns: Campaign ${id} sent. Success: ${sentCount}, Failed: ${failedCount}`);

            } catch (err) {
                console.error('EmailCampaigns: Critical send error:', err);
                await pool.query(
                    `UPDATE email_campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1`, [id]
                );
                if (io) {
                    io.emit('campaign:sent', { campaignId: parseInt(id), status: 'failed', error: err.message });
                }
            }
        })();

    } catch (error) {
        console.error('EmailCampaigns SEND error:', error);
        res.status(500).json({ error: 'Ошибка отправки кампании' });
    }
});

/**
 * DELETE /api/email-campaigns/:id
 * Удалить кампанию
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM email_campaigns WHERE id = $1 RETURNING id', [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Кампания не найдена' });
        }

        const io = req.app.get('io');
        if (io) io.emit('campaign:deleted', { campaignId: parseInt(id) });

        res.json({ success: true, message: 'Кампания удалена' });
    } catch (error) {
        console.error('EmailCampaigns DELETE error:', error);
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

export default router;
