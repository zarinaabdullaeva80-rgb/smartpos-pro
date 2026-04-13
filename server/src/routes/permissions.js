import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Получить все права доступа
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, code, name, description, module, action
            FROM permissions 
            ORDER BY module, action
        `);

        // Группировка по модулям
        const grouped = result.rows.reduce((acc, perm) => {
            if (!acc[perm.module]) {
                acc[perm.module] = [];
            }
            acc[perm.module].push(perm);
            return acc;
        }, {});

        res.json({
            permissions: result.rows,
            grouped: grouped
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить все роли
router.get('/roles', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id,
                r.code,
                r.name,
                r.description,
                r.is_system,
                r.created_at,
                COUNT(DISTINCT rp.permission_id) as permissions_count,
                COUNT(DISTINCT ur.user_id) as users_count
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN user_roles ur ON r.id = ur.role_id
            GROUP BY r.id, r.code, r.name, r.description, r.is_system, r.created_at
            ORDER BY r.created_at
        `);

        // Filter by organization_id for non-system roles
        const userLicenseId = req.user?.organization_id;
        const filteredRows = result.rows.filter(r =>
            r.is_system || !r.organization_id || r.organization_id === userLicenseId
        );

        res.json(filteredRows);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить права конкретной роли
router.get('/roles/:roleId/permissions', authenticate, async (req, res) => {
    try {
        const { roleId } = req.params;

        const result = await pool.query(`
            SELECT p.*
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = $1
            ORDER BY p.module, p.action
        `, [roleId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить роли пользователя
router.get('/user/:userId/roles', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(`
            SELECT r.*, ur.assigned_at
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1
            ORDER BY ur.assigned_at DESC
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user roles:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить все права пользователя (через роли)
router.get('/user/:userId/permissions', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(`
            SELECT DISTINCT p.*
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $1
            ORDER BY p.module, p.action
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Проверить наличие права у пользователя
router.get('/check/:permissionCode', authenticate, async (req, res) => {
    try {
        const { permissionCode } = req.params;
        const userId = req.user.userId;

        const result = await pool.query(`
            SELECT COUNT(*) > 0 as has_permission
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1 AND p.code = $2
        `, [userId, permissionCode]);

        res.json({
            hasPermission: result.rows[0].has_permission,
            permissionCode: permissionCode,
            userId: userId
        });
    } catch (error) {
        console.error('Error checking permission:', error);
        res.status(500).json({ error: error.message });
    }
});

// Назначить роль пользователю
router.post('/user/:userId/roles/:roleId', authenticate, async (req, res) => {
    try {
        const { userId, roleId } = req.params;
        const assignedBy = req.user.userId;

        await pool.query(`
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role_id) DO NOTHING
        `, [userId, roleId, assignedBy]);

        res.json({
            success: true,
            message: 'Роль успешно назначена пользователю'
        });
    } catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить роль у пользователя
router.delete('/user/:userId/roles/:roleId', authenticate, async (req, res) => {
    try {
        const { userId, roleId } = req.params;

        await pool.query(`
            DELETE FROM user_roles
            WHERE user_id = $1 AND role_id = $2
        `, [userId, roleId]);

        res.json({
            success: true,
            message: 'Роль успешно удалена у пользователя'
        });
    } catch (error) {
        console.error('Error removing role:', error);
        res.status(500).json({ error: error.message });
    }
});

// Создать новую роль
router.post('/roles', authenticate, async (req, res) => {
    try {
        const { code, name, description, permissions } = req.body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Создать роль
            const roleResult = await client.query(`
                INSERT INTO roles (code, name, description, is_system, organization_id)
                VALUES ($1, $2, $3, false, $4)
                RETURNING *
            `, [code, name, description, req.user.organization_id]);

            const role = roleResult.rows[0];

            // Назначить права роли
            if (permissions && Array.isArray(permissions)) {
                for (const permId of permissions) {
                    await client.query(`
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES ($1, $2)
                    `, [role.id, permId]);
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                role: role
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обновить роль
router.put('/roles/:roleId', authenticate, async (req, res) => {
    try {
        const { roleId } = req.params;
        const { name, description, permissions } = req.body;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Проверить что роль не системная
            const checkResult = await client.query(`
                SELECT is_system FROM roles WHERE id = $1
            `, [roleId]);

            if (checkResult.rows[0]?.is_system) {
                throw new Error('Нельзя изменять системные роли');
            }

            // Обновить роль
            await client.query(`
                UPDATE roles 
                SET name = $1, description = $2, updated_at = NOW()
                WHERE id = $3
            `, [name, description, roleId]);

            // Удалить старые права
            await client.query(`
                DELETE FROM role_permissions WHERE role_id = $1
            `, [roleId]);

            // Назначить новые права
            if (permissions && Array.isArray(permissions)) {
                for (const permId of permissions) {
                    await client.query(`
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES ($1, $2)
                    `, [roleId, permId]);
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Роль успешно обновлена'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить роль
router.delete('/roles/:roleId', authenticate, async (req, res) => {
    try {
        const { roleId } = req.params;

        // Проверить что роль не системная
        const checkResult = await pool.query(`
            SELECT is_system FROM roles WHERE id = $1
        `, [roleId]);

        if (checkResult.rows[0]?.is_system) {
            return res.status(403).json({ error: 'Нельзя удалять системные роли' });
        }

        await pool.query(`
            DELETE FROM roles WHERE id = $1
        `, [roleId]);

        res.json({
            success: true,
            message: 'Роль успешно удалена'
        });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
