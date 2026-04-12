import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// Admin role constant
const ADMIN_ROLE = '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440';

/**
 * Generate unique license key XXXX-XXXX-XXXX-XXXX
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
    return parts.join('-');
}

/**
 * POST /api/onboarding/register
 * Register a new client organization with license key
 */
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { license_key, company_name, admin_username, admin_password, admin_full_name } = req.body;

        if (!license_key || !company_name || !admin_username || !admin_password) {
            return res.status(400).json({ 
                error: 'Required fields: license_key, company_name, admin_username, admin_password' 
            });
        }

        if (admin_password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        await client.query('BEGIN');

        // Find organization by license key
        const orgResult = await client.query(
            'SELECT * FROM organizations WHERE license_key = $1 AND is_active = true',
            [license_key]
        );

        if (orgResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Invalid license key' });
        }

        const org = orgResult.rows[0];

        if (org.license_expires_at && new Date(org.license_expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'License expired', expires_at: org.license_expires_at });
        }

        // Check if already registered
        const existingUsers = await client.query(
            'SELECT COUNT(*) as cnt FROM users WHERE organization_id = $1',
            [org.id]
        );

        if (parseInt(existingUsers.rows[0].cnt) > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Organization already registered. Use login instead.' });
        }

        // Update organization name
        await client.query(
            'UPDATE organizations SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [company_name, org.id]
        );

        // Create admin user
        const hashedPassword = await bcrypt.hash(admin_password, 10);
        const userResult = await client.query(
            `INSERT INTO users (username, password_hash, role, full_name, organization_id, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)
             RETURNING id, username, role, full_name, organization_id`,
            [admin_username, hashedPassword, ADMIN_ROLE, admin_full_name || admin_username, org.id]
        );

        const user = userResult.rows[0];
        await client.query('COMMIT');

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role, organization_id: org.id },
            process.env.JWT_SECRET || 'smartpos-jwt-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Get license info
        const licenseResult = await pool.query(
            'SELECT * FROM licenses WHERE organization_id = $1 AND is_active = true LIMIT 1',
            [org.id]
        );
        const license = licenseResult.rows[0] || {};

        res.status(201).json({
            success: true,
            message: 'Organization registered successfully',
            user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            organization: { id: org.id, name: company_name, code: org.code },
            license: {
                plan: license.plan || 'basic',
                max_users: license.max_users || 5,
                max_products: license.max_products || 1000,
                expires_at: license.expires_at || org.license_expires_at
            },
            token
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Onboarding error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    } finally {
        client.release();
    }
});

/**
 * POST /api/onboarding/create-license
 * Create a new license for a client (admin only)
 */
router.post('/create-license', async (req, res) => {
    try {
        const masterKey = req.headers['x-master-key'];
        if (masterKey !== (process.env.MASTER_KEY || 'smartpos-master-2026')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { plan = 'basic', days = 365, company_name } = req.body;

        const licenseKey = generateLicenseKey();
        const code = 'ORG-' + Date.now().toString(36).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        const maxUsers = plan === 'enterprise' ? 100 : plan === 'pro' ? 20 : 5;
        const maxProducts = plan === 'enterprise' ? 50000 : plan === 'pro' ? 5000 : 1000;

        const orgResult = await pool.query(
            `INSERT INTO organizations (name, code, license_key, license_expires_at, is_active)
             VALUES ($1, $2, $3, $4, true) RETURNING *`,
            [company_name || 'New Client', code, licenseKey, expiresAt]
        );
        const org = orgResult.rows[0];

        await pool.query(
            `INSERT INTO licenses (license_key, organization_id, plan, max_users, max_products, expires_at, is_active, activated_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)`,
            [licenseKey, org.id, plan, maxUsers, maxProducts, expiresAt]
        );

        res.status(201).json({
            success: true,
            license_key: licenseKey,
            organization: { id: org.id, name: org.name, code: org.code },
            plan,
            limits: { max_users: maxUsers, max_products: maxProducts },
            expires_at: expiresAt,
            days
        });
    } catch (error) {
        console.error('Create license error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/onboarding/verify/:key
 * Verify a license key is valid (public)
 */
router.get('/verify/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const result = await pool.query(
            `SELECT o.id, o.name, o.license_expires_at, o.is_active,
                    l.plan, l.max_users, l.max_products,
                    (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
             FROM organizations o
             LEFT JOIN licenses l ON o.id = l.organization_id AND l.is_active = true
             WHERE o.license_key = $1`,
            [key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'License key not found' });
        }

        const org = result.rows[0];
        const isExpired = org.license_expires_at && new Date(org.license_expires_at) < new Date();
        const isRegistered = parseInt(org.user_count) > 0;

        res.json({
            valid: org.is_active && !isExpired,
            registered: isRegistered,
            organization: org.name,
            plan: org.plan || 'basic',
            expires_at: org.license_expires_at,
            expired: isExpired
        });
    } catch (error) {
        console.error('Verify license error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
