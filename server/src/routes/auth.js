import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { logAudit } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Распродажа]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Неверные учетные данные
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags: [Распродажа]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Пользователь создан
 *       400:
 *         description: Ошибка валидации
 */

// TEST endpoint to verify file is loaded
router.get('/test', (req, res) => {
    console.log('✅ TEST endpoint called - auth.js is loaded correctly!');
    res.json({ message: 'Auth route is working! File loaded correctly.' });
});


// Регистрация (только для администратора)
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, fullName, roleId } = req.body;

        // Проверка существующего пользователя
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }

        // Хеширование пароля
        const passwordHash = await bcrypt.hash(password, 10);

        // Создание пользователя
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, full_name, role_id`,
            [username, email, passwordHash, fullName, roleId || 5]
        );

        const user = result.rows[0];

        res.status(201).json({
            message: 'Пользователь создан',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name
            }
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход в систему
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        console.log('Login attempt for:', username);

        // 1. Поиск пользователя в таблице users (безопасный запрос с fallback)
        let result;
        try {
            result = await pool.query(
                'SELECT id, username, email, password_hash, full_name, role, is_active, user_type FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );
        } catch (userQueryErr) {
            console.error('Error querying users table:', userQueryErr.message);
            // Fallback: минимальный запрос
            try {
                result = await pool.query(
                    'SELECT id, username, email, password_hash, full_name, role, is_active FROM users WHERE LOWER(username) = LOWER($1)',
                    [username]
                );
            } catch (fallbackErr) {
                console.error('Fallback query also failed:', fallbackErr.message);
                return res.status(500).json({ error: 'Ошибка базы данных', details: fallbackErr.message });
            }
        }

        // Попробуем получить license_id отдельно (может не существовать)
        let userLicenseId = null;
        if (result.rows.length > 0) {
            try {
                const licRes = await pool.query('SELECT license_id FROM users WHERE id = $1', [result.rows[0].id]);
                userLicenseId = licRes.rows[0]?.license_id || null;
            } catch (e) {
                // license_id column may not exist yet - that's ok
            }
        }

        let user;
        let isFirstTimeLicenseLogin = false;

        if (result.rows.length === 0) {
            console.log('User not found in users table, checking licenses for:', username);

            // 2. Поиск в таблице licenses
            let licenseResult;
            try {
                licenseResult = await pool.query(
                    'SELECT id, customer_username, customer_password_hash, customer_name, customer_email, company_name, status FROM licenses WHERE customer_username = $1',
                    [username]
                );
            } catch (licQueryErr) {
                console.log('Cannot query licenses table:', licQueryErr.message);
                return res.status(401).json({ error: 'Неверные учетные данные' });
            }

            if (licenseResult.rows.length === 0) {
                return res.status(401).json({ error: 'Неверные учетные данные' });
            }

            const licenseData = licenseResult.rows[0];

            if (licenseData.status !== 'active') {
                return res.status(401).json({ error: 'Лицензия неактивна или заблокирована' });
            }

            if (!licenseData.customer_password_hash) {
                return res.status(401).json({ error: 'Пароль лицензии не установлен' });
            }

            const validLicensePassword = await bcrypt.compare(password, licenseData.customer_password_hash);
            if (!validLicensePassword) {
                return res.status(401).json({ error: 'Неверные учетные данные' });
            }

            // Авто-создание пользователя для лицензии
            try {
                const newUserResult = await pool.query(
                    `INSERT INTO users (username, email, password_hash, full_name, role)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, username, email, full_name, role`,
                    [
                        licenseData.customer_username,
                        licenseData.customer_email || `${licenseData.customer_username}@smartpos.local`,
                        licenseData.customer_password_hash,
                        licenseData.customer_name || licenseData.customer_username,
                        'Администратор',
                    ]
                );
                user = newUserResult.rows[0];
                userLicenseId = licenseData.id;

                // Попытка привязать license_id (если колонка существует)
                try {
                    await pool.query('UPDATE users SET license_id = $1 WHERE id = $2', [licenseData.id, user.id]);
                } catch (e) { /* license_id column may not exist */ }

                isFirstTimeLicenseLogin = true;
            } catch (createErr) {
                console.error('Error creating user for license:', createErr.message);
                return res.status(500).json({ error: 'Ошибка создания пользователя' });
            }

        } else {
            user = result.rows[0];
            user.license_id = userLicenseId;

            if (!user.is_active) {
                return res.status(401).json({ error: 'Учетная запись деактивирована' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Неверные учетные данные' });
            }

            // Проверить статус лицензии (если привязана)
            if (userLicenseId) {
                try {
                    const licCheck = await pool.query(
                        'SELECT status, expires_at FROM licenses WHERE id = $1',
                        [userLicenseId]
                    );
                    if (licCheck.rows.length === 0) {
                        // Лицензия удалена
                        return res.status(403).json({ 
                            error: 'Лицензия удалена. Обратитесь к администратору.',
                            code: 'LICENSE_DELETED'
                        });
                    }
                    const licStatus = licCheck.rows[0];
                    if (licStatus.status === 'expired') {
                        return res.status(403).json({ 
                            error: 'Лицензия истекла. Обратитесь к администратору.',
                            code: 'LICENSE_EXPIRED'
                        });
                    }
                    if (licStatus.status === 'suspended') {
                        return res.status(403).json({ 
                            error: 'Лицензия приостановлена. Обратитесь к администратору.',
                            code: 'LICENSE_SUSPENDED'
                        });
                    }
                    if (licStatus.status !== 'active') {
                        return res.status(403).json({ 
                            error: 'Лицензия неактивна. Обратитесь к администратору.',
                            code: 'LICENSE_INACTIVE'
                        });
                    }
                    // Проверить срок действия
                    if (licStatus.expires_at && new Date(licStatus.expires_at) < new Date()) {
                        await pool.query('UPDATE licenses SET status = $1 WHERE id = $2', ['expired', userLicenseId]);
                        return res.status(403).json({ 
                            error: 'Лицензия истекла. Обратитесь к администратору.',
                            code: 'LICENSE_EXPIRED'
                        });
                    }
                } catch (licCheckErr) {
                    console.log('License check error:', licCheckErr.message);
                }
            }
        }

        // Обновление времени последнего входа
        try {
            await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        } catch (e) { /* not critical */ }

        // Получить роли через RBAC (может не существовать)
        let userRoles = [];
        let primaryRole = user.role || 'cashier';
        try {
            const rolesResult = await pool.query(
                `SELECT r.name, r.code
                 FROM user_roles ur
                 JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = $1`,
                [user.id]
            );
            if (rolesResult.rows.length > 0) {
                userRoles = rolesResult.rows.map(r => r.name);
                primaryRole = rolesResult.rows[0].name;
            }
        } catch (rbacErr) {
            console.log('RBAC tables not available, using users.role:', rbacErr.message);
            userRoles = [primaryRole];
        }

        // Генерация токена
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: primaryRole, licenseId: userLicenseId },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        console.log('Login successful for:', username);

        // Получить полные данные лицензии для клиента
        let licenseData = null;
        let serverConfig = null;
        if (userLicenseId) {
            try {
                const licFullRes = await pool.query(
                    `SELECT id, license_key, license_type, status, expires_at, 
                            max_devices, max_users, features, customer_name, company_name,
                            server_type, server_url
                     FROM licenses WHERE id = $1`,
                    [userLicenseId]
                );
                if (licFullRes.rows.length > 0) {
                    const lic = licFullRes.rows[0];
                    licenseData = {
                        id: lic.id,
                        type: lic.license_type,
                        status: lic.status,
                        expires_at: lic.expires_at,
                        max_devices: lic.max_devices,
                        max_users: lic.max_users,
                        features: lic.features,
                        customer_name: lic.customer_name,
                        company_name: lic.company_name,
                        server_type: lic.server_type || 'cloud',
                        server_url: lic.server_url || null
                    };
                    serverConfig = { type: lic.server_type, url: lic.server_url };
                }
            } catch (e) {
                console.log('Could not fetch license data:', e.message);
            }
        }

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: primaryRole,
                roles: userRoles,
                license_id: userLicenseId,
                user_type: user.user_type || 'employee',
                is_first_login: isFirstTimeLicenseLogin
            },
            license: licenseData,
            serverConfig
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получение текущего пользователя (с authenticate middleware)
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, secret);

        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active,
                    u.user_level, u.license_id, u.shop_id, u.user_type
             FROM users u
             WHERE u.id = $1 AND u.is_active = true`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        // Возвращаем объект пользователя напрямую (без обёртки { user: ... })
        // Клиенты ожидают response.data.id, а не response.data.user.id
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            fullName: user.full_name,
            role: user.role,
            user_level: user.user_level,
            license_id: user.license_id,
            shop_id: user.shop_id,
            user_type: user.user_type
        });
    } catch (error) {
        res.status(401).json({ error: 'Недействительный токен' });
    }
});

/**
 * POST /api/auth/change-password
 * Смена пароля текущего пользователя (требует старый пароль)
 */
router.post('/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (e) {
            return res.status(401).json({ error: 'Недействительный токен' });
        }

        const { old_password, new_password } = req.body;
        if (!old_password || !new_password) {
            return res.status(400).json({ error: 'Укажите старый и новый пароль' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Новый пароль должен быть минимум 6 символов' });
        }

        // Получить текущий хеш пароля
        const userResult = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE id = $1',
            [decoded.userId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = userResult.rows[0];

        // Проверить старый пароль
        const isValid = await bcrypt.compare(old_password, user.password_hash);
        if (!isValid) {
            return res.status(400).json({ error: 'Неверный текущий пароль' });
        }

        // Хешировать новый пароль и обновить
        const newHash = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, user.id]
        );

        console.log(`Password changed for user: ${user.username}`);

        try {
            await logAudit(user.id, 'password_changed', 'users', user.id, null, { by: 'self' });
        } catch (auditErr) {
            console.log('Audit log skipped:', auditErr.message);
        }

        res.json({ message: 'Пароль успешно изменён' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * POST /api/auth/refresh
 * Обновление JWT-токена без повторного ввода пароля
 * Мобильное приложение вызывает этот endpoint при получении 401
 */
router.post('/refresh', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

        // Верифицируем даже истёкший токен (ignoreExpiration) — только для refresh
        let decoded;
        try {
            decoded = jwt.verify(token, secret, { ignoreExpiration: true });
        } catch (e) {
            return res.status(401).json({ error: 'Недействительный токен' });
        }

        // Проверить, что пользователь всё ещё активен
        const result = await pool.query(
            'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = $1 AND is_active = true',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь деактивирован' });
        }

        const user = result.rows[0];

        // Выпустить новый токен
        const newToken = jwt.sign(
            { userId: user.id, username: user.username, role: user.role, licenseId: decoded.licenseId },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        console.log('Token refreshed for:', user.username);

        res.json({
            token: newToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: 'Ошибка обновления токена' });
    }
});

export default router;
