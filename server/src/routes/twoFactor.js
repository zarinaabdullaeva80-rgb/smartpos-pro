import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * Setup 2FA - Generate secret and QR code
 */
router.post('/setup', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `1C Accounting (${req.user.username})`,
            length: 32
        });

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // Save secret to database (temporarily)
        await pool.query(`
            UPDATE users 
            SET two_factor_temp_secret = $1
            WHERE id = $2
        `, [secret.base32, userId]);

        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl,
            otpauth_url: secret.otpauth_url
        });

    } catch (error) {
        console.error('Error setting up 2FA:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify and enable 2FA
 */
router.post('/verify', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        // Get temp secret
        const result = await pool.query(`
            SELECT two_factor_temp_secret 
            FROM users 
            WHERE id = $1
        `, [userId]);

        if (!result.rows[0]?.two_factor_temp_secret) {
            return res.status(400).json({ error: '2FA not set up. Call /setup first' });
        }

        const secret = result.rows[0].two_factor_temp_secret;

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow 2 time steps (±60 seconds)
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Enable 2FA - move temp secret to permanent
        await pool.query(`
            UPDATE users 
            SET two_factor_secret = $1,
                two_factor_enabled = true,
                two_factor_temp_secret = NULL
            WHERE id = $2
        `, [secret, userId]);

        res.json({
            success: true,
            message: '2FA enabled successfully'
        });

    } catch (error) {
        console.error('Error verifying 2FA:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Disable 2FA
 */
router.post('/disable', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        // Verify password
        const userResult = await pool.query(`
            SELECT password, two_factor_secret 
            FROM users 
            WHERE id = $1
        `, [userId]);

        const user = userResult.rows[0];

        // Verify 2FA token
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Disable 2FA
        await pool.query(`
            UPDATE users 
            SET two_factor_secret = NULL,
                two_factor_enabled = false
            WHERE id = $1
        `, [userId]);

        res.json({
            success: true,
            message: '2FA disabled'
        });

    } catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Validate 2FA token (use during login)
 */
router.post('/validate', authenticate, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        const result = await pool.query(`
            SELECT two_factor_secret, two_factor_enabled 
            FROM users 
            WHERE id = $1
        `, [userId]);

        const user = result.rows[0];

        if (!user.two_factor_enabled) {
            return res.status(400).json({ error: '2FA not enabled' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        res.json({
            valid: verified
        });

    } catch (error) {
        console.error('Error validating 2FA:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate backup codes
 */
router.post('/backup-codes', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Generate 10 backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            backupCodes.push(code);
        }

        // Save hashed codes to database
        await pool.query(`
            UPDATE users 
            SET two_factor_backup_codes = $1
            WHERE id = $2
        `, [JSON.stringify(backupCodes), userId]);

        res.json({
            backupCodes: backupCodes,
            message: 'Save these codes in a safe place. Each can only be used once.'
        });

    } catch (error) {
        console.error('Error generating backup codes:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
