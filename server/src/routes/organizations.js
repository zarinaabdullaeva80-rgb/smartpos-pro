import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * Генерация уникального ключа лицензии
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const parts = [];
    for (let i = 0; i < 4; i++) {
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        parts.push(part);
    }
    return parts.join('-'); // Формат: XXXX-XXXX-XXXX-XXXX
}

/**
 * Получить все организации (только для суперадмина)
 */
router.get('/', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, 
                   l.plan, l.expires_at as license_expires,
                   (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
                   (SELECT COUNT(*) FROM products WHERE organization_id = o.id) as product_count
            FROM organizations o
            LEFT JOIN licenses l ON o.id = l.organization_id AND l.is_active = true
            ORDER BY o.created_at DESC
        `);
        res.json({ organizations: result.rows });
    } catch (error) {
        console.error('Error getting organizations:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Создать новую организацию с лицензией
 */
router.post('/', authenticate, authorize('Администратор'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { name, plan = 'basic', expiresInDays = 30 } = req.body;

        // Генерация уникального кода организации
        const code = 'ORG-' + Date.now().toString(36).toUpperCase();
        const licenseKey = generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Создать организацию
        const orgResult = await client.query(`
            INSERT INTO organizations (name, code, license_key, license_expires_at, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `, [name, code, licenseKey, expiresAt]);

        const org = orgResult.rows[0];

        // Создать лицензию
        const maxUsers = plan === 'enterprise' ? 100 : plan === 'pro' ? 20 : 5;
        const maxProducts = plan === 'enterprise' ? 10000 : plan === 'pro' ? 5000 : 1000;

        await client.query(`
            INSERT INTO licenses (license_key, organization_id, plan, max_users, max_products, expires_at, is_active, activated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
        `, [licenseKey, org.id, plan, maxUsers, maxProducts, expiresAt]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Организация и лицензия созданы',
            organization: org,
            license_key: licenseKey,
            plan,
            expires_at: expiresAt
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating organization:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

/**
 * Активировать лицензию (публичный endpoint)
 */
router.post('/activate', async (req, res) => {
    try {
        const { license_key } = req.body;

        if (!license_key) {
            return res.status(400).json({ error: 'Ключ лицензии обязателен' });
        }

        // Найти организацию по ключу лицензии
        const result = await pool.query(`
            SELECT o.*, l.plan, l.max_users, l.max_products, l.expires_at
            FROM organizations o
            JOIN licenses l ON o.id = l.organization_id
            WHERE o.license_key = $1 AND o.is_active = true
        `, [license_key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена или недействительна' });
        }

        const org = result.rows[0];

        // Проверить срок
        if (new Date(org.expires_at) < new Date()) {
            return res.status(403).json({
                error: 'Срок лицензии истёк',
                expires_at: org.expires_at
            });
        }

        res.json({
            activated: true,
            organization: {
                id: org.id,
                name: org.name,
                code: org.code
            },
            license: {
                plan: org.plan,
                max_users: org.max_users,
                max_products: org.max_products,
                expires_at: org.expires_at
            }
        });
    } catch (error) {
        console.error('Error activating license:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Проверить статус лицензии
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const orgId = req.user.organization_id || 1;

        const result = await pool.query(`
            SELECT o.name, o.code, l.plan, l.max_users, l.max_products, l.expires_at,
                   (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as current_users,
                   (SELECT COUNT(*) FROM products WHERE organization_id = o.id) as current_products
            FROM organizations o
            LEFT JOIN licenses l ON o.id = l.organization_id AND l.is_active = true
            WHERE o.id = $1
        `, [orgId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Организация не найдена' });
        }

        const org = result.rows[0];
        const daysRemaining = org.expires_at
            ? Math.ceil((new Date(org.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
            : null;

        res.json({
            organization: org.name,
            plan: org.plan || 'basic',
            limits: {
                users: { current: parseInt(org.current_users), max: org.max_users },
                products: { current: parseInt(org.current_products), max: org.max_products }
            },
            expires_at: org.expires_at,
            days_remaining: daysRemaining,
            is_valid: daysRemaining === null || daysRemaining > 0
        });
    } catch (error) {
        console.error('Error getting license status:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
