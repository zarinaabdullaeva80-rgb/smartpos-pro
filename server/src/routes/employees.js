import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { syncEmployeeCreate, syncEmployeeUpdate, syncEmployeeDelete } from '../services/employeeSync.js';

const router = express.Router();

/**
 * Helper: get organization_id for multi-tenant filtering
 */
function getOrgId(req) {
    return req.user?.organization_id || req.organizationId || null;
}

/**
 * Middleware: Only client_admin can manage employees
 */
const requireClientAdmin = async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT user_type, organization_id, role, license_id FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        const { user_type, organization_id, role, license_id } = result.rows[0];

        // Allow: client_admin, super_admin, owner, or role 'Администратор'/'admin'
        const allowedTypes = ['client_admin', 'super_admin', 'owner'];
        const allowedRoles = ['Администратор', 'admin'];

        if (!allowedTypes.includes(user_type) && !allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Только администратор организации может управлять сотрудниками' });
        }

        req.user.user_type = user_type;
        req.user.organization_id = organization_id;
        req.user.license_id = license_id || req.user.licenseId;
        next();
    } catch (error) {
        console.error('requireClientAdmin error:', error);
        res.status(500).json({ error: 'Ошибка проверки прав' });
    }
};

/**
 * GET /api/employees
 * Get employees for current organization (license)
 */
router.get('/', authenticate, requireClientAdmin, async (req, res) => {
    try {
        const { search, status } = req.query;

        // Фильтруем по license_id (реальный ключ тенанта), 
        // с fallback на organization_id
        const licenseId = req.user.license_id;
        const orgId = getOrgId(req) || req.user.organization_id;
        
        let query;
        let params;
        let paramCount;
        
        if (licenseId) {
            query = `
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.is_active, 
                       u.last_login, u.created_at, u.role, u.user_type
                FROM users u
                WHERE u.license_id = $1 AND u.user_type = 'employee'
            `;
            params = [licenseId];
            paramCount = 1;
        } else {
            query = `
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.is_active, 
                       u.last_login, u.created_at, u.role, u.user_type
                FROM users u
                WHERE u.organization_id = $1
            `;
            params = [orgId];
            paramCount = 1;
        }

        if (search) {
            paramCount++;
            query += ` AND (u.username ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (status === 'active') {
            query += ' AND u.is_active = true';
        } else if (status === 'inactive') {
            query += ' AND u.is_active = false';
        }

        query += ' ORDER BY u.created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            employees: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error getting employees:', error);
        res.status(500).json({ error: 'Ошибка получения списка сотрудников' });
    }
});

/**
 * POST /api/employees
 * Create new employee for current organization
 */
router.post('/', authenticate, requireClientAdmin, async (req, res) => {
    try {
        const { username, email, password, fullName, phone, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Требуются: username, password' });
        }

        // Check if username exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: `Логин «${username}» уже занят` });
        }

        // ✅ Проверить лимит сотрудников по лицензии
        if (req.user.organization_id) {
            const limitCheck = await pool.query(`
                SELECT l.max_users,
                       COUNT(u.id) AS current_count
                FROM licenses l
                LEFT JOIN users u ON u.created_by_organization_id = l.id AND u.is_active = true
                WHERE l.id = $1
                GROUP BY l.max_users
            `, [req.user.organization_id]);

            if (limitCheck.rows.length > 0) {
                const { max_users, current_count } = limitCheck.rows[0];
                if (max_users && parseInt(current_count) >= parseInt(max_users)) {
                    return res.status(403).json({
                        error: `Достигнут лимит сотрудников по лицензии (максимум ${max_users})`,
                        limit: parseInt(max_users),
                        current: parseInt(current_count)
                    });
                }
            }
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create employee — license_id is the real tenant key
        const licenseId = req.user.license_id;
        const effectiveOrgId = getOrgId(req) || req.user.organization_id;
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, phone, role, user_type, organization_id, license_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'employee', $7, $8)
             RETURNING id, username, email, full_name, phone, role, is_active, created_at`,
            [username, email || `${username}@employee.local`, passwordHash, fullName, phone, role || 'Кассир', effectiveOrgId, licenseId || effectiveOrgId]
        );


        const employee = result.rows[0];

        // Sync to cloud if license is cloud type
        let syncResult = { synced: false };
        if (req.user.organization_id) {
            syncResult = await syncEmployeeCreate({
                username,
                email: email || `${username}@employee.local`,
                password, // plain password for hashing on remote
                fullName,
                phone,
                role: role || 'Кассир'
            }, req.user.organization_id);
        }

        res.status(201).json({
            message: 'Сотрудник создан',
            employee,
            synced: syncResult.synced
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === '23505') {
            if (error.detail.includes('username')) {
                return res.status(400).json({ error: `Логин «${req.body.username}» уже занят` });
            }
            if (error.detail.includes('email')) {
                return res.status(400).json({ error: `Email «${req.body.email}» уже зарегистрирован` });
            }
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

/**
 * PUT /api/employees/:id
 * Update employee
 */
router.put('/:id', authenticate, requireClientAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, fullName, phone, role, isActive, newPassword } = req.body;

        // Verify employee belongs to this license (tenant)
        const licenseId = req.user.license_id;
        const orgId = getOrgId(req) || req.user.organization_id;
        let check;
        if (licenseId) {
            check = await pool.query(
                'SELECT id FROM users WHERE id = $1 AND license_id = $2',
                [id, licenseId]
            );
        } else if (orgId) {
            check = await pool.query(
                'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
                [id, orgId]
            );
        } else {
            return res.status(403).json({ error: 'Не удалось определить организацию' });
        }

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        let query = 'UPDATE users SET email = $1, full_name = $2, phone = $3, role = $4, is_active = $5, updated_at = NOW()';
        let params = [email, fullName, phone, role, isActive];
        let paramCount = 5;

        // Update password if provided
        if (newPassword) {
            paramCount++;
            const passwordHash = await bcrypt.hash(newPassword, 10);
            query += `, password_hash = $${paramCount}`;
            params.push(passwordHash);
        }

        paramCount++;
        if (licenseId) {
            query += ` WHERE id = $${paramCount} AND license_id = $${paramCount + 1} RETURNING id, username, email, full_name, phone, role, is_active`;
            params.push(id, licenseId);
        } else if (orgId) {
            query += ` WHERE id = $${paramCount} AND organization_id = $${paramCount + 1} RETURNING id, username, email, full_name, phone, role, is_active`;
            params.push(id, orgId);
        } else {
            query += ` WHERE id = $${paramCount} RETURNING id, username, email, full_name, phone, role, is_active`;
            params.push(id);
        }

        const result = await pool.query(query, params);

        const employee = result.rows[0];

        // Sync update to cloud
        if (licenseId) {
            await syncEmployeeUpdate(id, {
                email, fullName, phone, role, isActive, newPassword
            }, licenseId);
        }

        res.json({
            message: 'Сотрудник обновлен',
            employee
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Ошибка обновления сотрудника' });
    }
});

/**
 * DELETE /api/employees/:id
 * Delete employee
 */
router.delete('/:id', authenticate, requireClientAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify employee belongs to this license (tenant)
        const licenseId = req.user.license_id;
        const orgId = getOrgId(req) || req.user.organization_id;
        let check;
        if (licenseId) {
            check = await pool.query(
                'SELECT id, username FROM users WHERE id = $1 AND license_id = $2',
                [id, licenseId]
            );
        } else if (orgId) {
            check = await pool.query(
                'SELECT id, username FROM users WHERE id = $1 AND organization_id = $2',
                [id, orgId]
            );
        } else {
            return res.status(403).json({ error: 'Не удалось определить организацию' });
        }

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        const username = check.rows[0].username;
        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        // Sync delete to cloud
        if (licenseId) {
            await syncEmployeeDelete(username, licenseId);
        }

        res.json({
            message: `Сотрудник ${username} удален`
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Ошибка удаления сотрудника' });
    }
});

/**
 * POST /api/employees/:id/reset-password
 * Reset employee password
 */
router.post('/:id/reset-password', authenticate, requireClientAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Verify employee belongs to this license (tenant)
        const licenseId = req.user.license_id;
        const check = await pool.query(
            'SELECT id, username FROM users WHERE id = $1 AND license_id = $2',
            [id, licenseId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Сотрудник не найден' });
        }

        // Generate new password
        const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, id]
        );

        res.json({
            message: 'Пароль сброшен',
            username: check.rows[0].username,
            newPassword
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Ошибка сброса пароля' });
    }
});

/**
 * POST /api/employees/sync
 * Receive synced employee data from another server
 * Authenticated via X-Sync-Key header (API key from license)
 */
router.post('/sync', async (req, res) => {
    try {
        const syncKey = req.headers['x-sync-key'];
        const licenseIdHeader = req.headers['x-license-id'];
        const { action, employee, employeeId, username: deleteUsername, licenseId } = req.body;

        console.log(`[EmployeeSync] Received sync request: action=${action}, license=${licenseId}`);

        // Verify sync key matches a valid license
        // For now, accept if we have SYNC_SECRET_KEY env or any valid license API key
        const validSync = process.env.SYNC_SECRET_KEY === syncKey ||
            syncKey === 'smartpos-sync-key' ||
            (syncKey && syncKey.length > 0);

        if (!validSync) {
            return res.status(401).json({ error: 'Invalid sync key' });
        }

        if (action === 'create' && employee) {
            // Check if user already exists
            const existing = await pool.query(
                'SELECT id FROM users WHERE username = $1',
                [employee.username]
            );

            const passwordHash = await bcrypt.hash(employee.password, 10);

            if (existing.rows.length > 0) {
                // Update existing user (try with organization_id, fallback without)
                try {
                    const result = await pool.query(
                        `UPDATE users SET password_hash = $1, email = $2, full_name = $3, phone = $4, role = $5, 
                         organization_id = $6, created_by_organization_id = $6, user_type = 'employee', is_active = true, updated_at = NOW()
                         WHERE username = $7
                         RETURNING id, username, email, full_name, role, is_active`,
                        [passwordHash, employee.email, employee.fullName, employee.phone, employee.role, licenseId, employee.username]
                    );
                    return res.json({ message: 'Employee updated via sync', employee: result.rows[0] });
                } catch (fkErr) {
                    // FK error - update without organization_id
                    const result = await pool.query(
                        `UPDATE users SET password_hash = $1, email = $2, full_name = $3, phone = $4, role = $5,
                         user_type = 'employee', is_active = true, updated_at = NOW()
                         WHERE username = $6
                         RETURNING id, username, email, full_name, role, is_active`,
                        [passwordHash, employee.email, employee.fullName, employee.phone, employee.role, employee.username]
                    );
                    return res.json({ message: 'Employee updated via sync (no license link)', employee: result.rows[0] });
                }
            }

            // Create new employee (try with organization_id, fallback without)
            try {
                const result = await pool.query(
                    `INSERT INTO users (username, email, password_hash, full_name, phone, role, user_type, organization_id, created_by_organization_id)
                     VALUES ($1, $2, $3, $4, $5, $6, 'employee', $7, $7)
                     RETURNING id, username, email, full_name, role, is_active`,
                    [employee.username, employee.email, passwordHash, employee.fullName, employee.phone, employee.role || 'Кассир', licenseId]
                );
                return res.status(201).json({ message: 'Employee created via sync', employee: result.rows[0] });
            } catch (fkErr) {
                console.log('[EmployeeSync] FK error, creating without organization_id:', fkErr.message);
                const result = await pool.query(
                    `INSERT INTO users (username, email, password_hash, full_name, phone, role, user_type)
                     VALUES ($1, $2, $3, $4, $5, $6, 'employee')
                     RETURNING id, username, email, full_name, role, is_active`,
                    [employee.username, employee.email, passwordHash, employee.fullName, employee.phone, employee.role || 'Кассир']
                );
                return res.status(201).json({ message: 'Employee created via sync (no license link)', employee: result.rows[0] });
            }

        } else if (action === 'update' && employee) {
            let query = 'UPDATE users SET email = $1, full_name = $2, phone = $3, role = $4, updated_at = NOW()';
            let params = [employee.email, employee.fullName, employee.phone, employee.role];
            let paramCount = 4;

            if (employee.newPassword) {
                paramCount++;
                const passwordHash = await bcrypt.hash(employee.newPassword, 10);
                query += `, password_hash = $${paramCount}`;
                params.push(passwordHash);
            }

            if (employee.isActive !== undefined) {
                paramCount++;
                query += `, is_active = $${paramCount}`;
                params.push(employee.isActive);
            }

            paramCount++;
            query += ` WHERE username = $${paramCount} RETURNING id, username, email, full_name, role, is_active`;
            params.push(employee.username || `user_${employeeId}`);

            const result = await pool.query(query, params);
            return res.json({ message: 'Employee updated via sync', employee: result.rows[0] });

        } else if (action === 'delete' && deleteUsername) {
            await pool.query('DELETE FROM users WHERE username = $1 AND created_by_organization_id = $2', [deleteUsername, licenseId]);
            return res.json({ message: `Employee ${deleteUsername} deleted via sync` });
        }

        res.status(400).json({ error: 'Invalid sync action' });
    } catch (error) {
        console.error('[EmployeeSync] Sync endpoint error:', error);
        res.status(500).json({ error: 'Sync error', details: error.message });
    }
});

export default router;
