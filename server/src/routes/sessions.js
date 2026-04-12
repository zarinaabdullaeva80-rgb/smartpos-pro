import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Инициализация таблиц безопасности
const initSecurityTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255),
                ip_address VARCHAR(50),
                user_agent TEXT,
                device_info JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                last_activity TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);

            CREATE TABLE IF NOT EXISTS blocked_ips (
                id SERIAL PRIMARY KEY,
                ip_address VARCHAR(50) UNIQUE,
                reason TEXT,
                blocked_by INTEGER REFERENCES users(id),
                blocked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_blocked_ips ON blocked_ips(ip_address);

            CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                ip_address VARCHAR(50),
                username VARCHAR(255),
                success BOOLEAN,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
            CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);
        `);
        console.log('✓ Таблицы безопасности готовы');
    } catch (error) {
        console.error('Security tables error:', error.message);
    }
};
// Lazy init — таблицы создаются при первом запросе, не при импорте
let securityTablesReady = false;
router.use(async (req, res, next) => {
    if (!securityTablesReady) {
        await initSecurityTables();
        securityTablesReady = true;
    }
    next();
});

// Получить активные сессии
router.get('/', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, u.username, u.full_name, u.email
            FROM user_sessions s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.is_active = true
            ORDER BY s.last_activity DESC
        `);

        res.json({ sessions: result.rows });
    } catch (error) {
        console.error('Sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Завершить сессию
router.delete('/:id', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(`
            UPDATE user_sessions SET is_active = false WHERE id = $1
        `, [id]);

        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        console.error('Terminate session error:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// Завершить ВСЕ сессии (кроме текущей)
router.post('/terminate-all', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE user_sessions SET is_active = false 
            WHERE is_active = true AND user_id != $1
            RETURNING id
        `, [req.user.id]);

        res.json({ success: true, terminated: result.rowCount });
    } catch (error) {
        console.error('Terminate all sessions error:', error);
        res.status(500).json({ error: 'Failed to terminate sessions' });
    }
});

// Завершить все сессии пользователя
router.delete('/user/:userId', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(`
            UPDATE user_sessions SET is_active = false 
            WHERE user_id = $1 AND is_active = true
            RETURNING id
        `, [userId]);

        res.json({ success: true, terminated: result.rowCount });
    } catch (error) {
        console.error('Terminate user sessions error:', error);
        res.status(500).json({ error: 'Failed to terminate sessions' });
    }
});

// ============= IP БЛОКИРОВКА =============

// Получить заблокированные IP
router.get('/blocked-ips', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, u.username as blocked_by_name
            FROM blocked_ips b
            LEFT JOIN users u ON b.blocked_by = u.id
            ORDER BY b.created_at DESC
        `);

        res.json({ blockedIps: result.rows });
    } catch (error) {
        console.error('Blocked IPs error:', error);
        res.status(500).json({ error: 'Failed to get blocked IPs' });
    }
});

// Заблокировать IP
router.post('/block-ip', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { ip_address, reason, duration_hours } = req.body;
        const userId = req.user.id;

        if (!ip_address) {
            return res.status(400).json({ error: 'IP address required' });
        }

        const blocked_until = duration_hours
            ? new Date(Date.now() + duration_hours * 60 * 60 * 1000)
            : null;

        await pool.query(`
            INSERT INTO blocked_ips (ip_address, reason, blocked_by, blocked_until)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (ip_address) DO UPDATE SET
                reason = $2,
                blocked_by = $3,
                blocked_until = $4,
                created_at = NOW()
        `, [ip_address, reason, userId, blocked_until]);

        res.json({ success: true, message: `IP ${ip_address} blocked` });
    } catch (error) {
        console.error('Block IP error:', error);
        res.status(500).json({ error: 'Failed to block IP' });
    }
});

// Разблокировать IP
router.delete('/block-ip/:ip', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { ip } = req.params;

        await pool.query('DELETE FROM blocked_ips WHERE ip_address = $1', [ip]);

        res.json({ success: true, message: `IP ${ip} unblocked` });
    } catch (error) {
        console.error('Unblock IP error:', error);
        res.status(500).json({ error: 'Failed to unblock IP' });
    }
});

// ============= ПОПЫТКИ ВХОДА =============

// Получить попытки входа
router.get('/login-attempts', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { hours = 24, failed_only } = req.query;

        let query = `
            SELECT * FROM login_attempts
            WHERE created_at > NOW() - INTERVAL '${parseInt(hours)} hours'
        `;

        if (failed_only === 'true') {
            query += ` AND success = false`;
        }

        query += ` ORDER BY created_at DESC LIMIT 200`;

        const result = await pool.query(query);

        // Группировка по IP для анализа
        const byIp = {};
        result.rows.forEach(row => {
            if (!byIp[row.ip_address]) {
                byIp[row.ip_address] = { total: 0, failed: 0 };
            }
            byIp[row.ip_address].total++;
            if (!row.success) byIp[row.ip_address].failed++;
        });

        // Подозрительные IP (более 5 неудачных попыток)
        const suspicious = Object.entries(byIp)
            .filter(([, data]) => data.failed >= 5)
            .map(([ip, data]) => ({ ip, ...data }));

        res.json({
            attempts: result.rows,
            suspicious,
            summary: {
                total: result.rows.length,
                failed: result.rows.filter(r => !r.success).length
            }
        });
    } catch (error) {
        console.error('Login attempts error:', error);
        res.status(500).json({ error: 'Failed to get login attempts' });
    }
});

// Middleware для проверки блокировки IP (экспортируется для использования)
export const checkBlockedIp = async (req, res, next) => {
    try {
        const ip = req.ip || req.connection?.remoteAddress;

        const result = await pool.query(`
            SELECT * FROM blocked_ips 
            WHERE ip_address = $1 
            AND (blocked_until IS NULL OR blocked_until > NOW())
        `, [ip]);

        if (result.rows.length > 0) {
            return res.status(403).json({
                error: 'IP blocked',
                reason: result.rows[0].reason,
                until: result.rows[0].blocked_until
            });
        }

        next();
    } catch (error) {
        next(); // Продолжаем если ошибка
    }
};

// Функция для записи попытки входа
export const logLoginAttempt = async (ip, username, success, userAgent) => {
    try {
        await pool.query(`
            INSERT INTO login_attempts (ip_address, username, success, user_agent)
            VALUES ($1, $2, $3, $4)
        `, [ip, username, success, userAgent]);
    } catch (error) {
        console.error('Log login attempt error:', error.message);
    }
};

export default router;
