import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';

const router = express.Router();

// Получение пользователей
router.get('/', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login, 
               u.created_at, string_agg(r.name, ', ') as role_names
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id`;
        const params = [];
        if (userLicenseId) {
            query += ' WHERE u.license_id = $1';
            params.push(userLicenseId);
        }
        query += ` GROUP BY u.id, u.username, u.email, u.full_name, u.is_active, u.last_login, u.created_at
        ORDER BY u.created_at DESC`;
        const result = await pool.query(query, params);

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание пользователя с генерацией пароля
router.post('/', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { username, email, fullName, roleId } = req.body;
        const bcrypt = await import('bcrypt');

        // Генерация случайного пароля
        const generatedPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(generatedPassword, 10);

        // Создать пользователя БЕЗ role_id
        const userLicenseId = req.user.license_id;

        // Создать пользователя
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, license_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, full_name`,
            [username, email, passwordHash, fullName, userLicenseId]
        );

        const newUser = result.rows[0];

        // Назначить роль через user_roles
        if (roleId) {
            await pool.query(
                `INSERT INTO user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
                [newUser.id, roleId, req.user.id]
            );
        }

        await logAudit(req.user.id, 'CREATE', 'users', newUser.id, null, newUser, req.ip);

        res.status(201).json({
            message: 'Пользователь создан',
            user: newUser,
            password: generatedPassword // Отправляем сгенерированный пароль
        });
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление пользователя
router.put('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { id } = req.params;
        const { email, fullName, roleId, isActive } = req.body;

        const oldData = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

        // Обновить пользователя БЕЗ role_id
        const userLicenseId = req.user.license_id;

        // Обновить пользователя
        let query = `UPDATE users SET email = $1, full_name = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`;
        const params = [email, fullName, isActive, id];
        if (userLicenseId) {
            query += ' AND license_id = $5';
            params.push(userLicenseId);
        }
        query += ' RETURNING id, username, email, full_name, is_active';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Обновить роль через user_roles
        if (roleId) {
            // Удалить старые роли
            await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
            // Назначить новую роль
            await pool.query(
                `INSERT INTO user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
                [id, roleId, req.user.id]
            );
        }

        await logAudit(req.user.id, 'UPDATE', 'users', id, oldData.rows[0], result.rows[0], req.ip);

        res.json({ message: 'Пользователь обновлен', user: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Сброс пароля
router.post('/:id/reset-password', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { id } = req.params;
        const bcrypt = await import('bcrypt');

        // Генерация нового пароля
        const newPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(newPassword, 10);

        const result = await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING username',
            [passwordHash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        await logAudit(req.user.id, 'RESET_PASSWORD', 'users', id, null, null, req.ip);

        res.json({
            message: 'Пароль сброшен',
            username: result.rows[0].username,
            password: newPassword
        });
    } catch (error) {
        console.error('Ошибка сброса пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение ролей
router.get('/roles', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = 'SELECT * FROM roles';
        const params = [];
        if (userLicenseId) {
            query += ' WHERE license_id = $1 OR license_id IS NULL';
            params.push(userLicenseId);
        }
        query += ' ORDER BY name';
        const result = await pool.query(query, params);
        res.json({ roles: result.rows });
    } catch (error) {
        console.error('Ошибка получения ролей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение журнала аудита
router.get('/audit-log', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const userLicenseId = req.user.license_id;
        let query = `SELECT al.*, u.username, u.full_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id`;
        const params = [limit, offset];
        if (userLicenseId) {
            query += ' WHERE al.license_id = $3';
            params.push(userLicenseId);
        }
        query += ` ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`;
        const result = await pool.query(query, params);

        res.json({ logs: result.rows });
    } catch (error) {
        console.error('Ошибка получения журнала аудита:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
