import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

// Warn once if using fallback JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
if (!process.env.JWT_SECRET) {
    console.warn('[AUTH] ⚠️ JWT_SECRET не установлен! Используется небезопасный fallback. Установите JWT_SECRET в .env для production!');
}

export const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Единый запрос — все колонки с graceful fallback для расширенных полей
        let userData = null;
        try {
            const result = await pool.query(
                `SELECT id, username, email, full_name, role, is_active,
                        license_id, user_level, user_type, created_by_license_id, organization_id
                 FROM users WHERE id = $1 AND is_active = true`,
                [decoded.userId]
            );
            userData = result.rows[0] || null;
        } catch (extErr) {
            // Fallback: расширенные колонки могут отсутствовать в старой схеме
            const result = await pool.query(
                'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
            userData = result.rows[0] || null;
        }

        if (!userData) {
            return res.status(401).json({ error: 'Пользователь не найден' });
        }

        req.user = {
            id: userData.id,
            userId: userData.id,
            username: userData.username,
            email: userData.email,
            fullName: userData.full_name,
            role: userData.role,
            userLevel: userData.user_level || null,
            user_type: userData.user_type || null,
            license_id: userData.license_id || decoded.licenseId || null,
            licenseId: userData.license_id || decoded.licenseId || null,
            created_by_license_id: userData.created_by_license_id || null,
            organization_id: userData.organization_id || decoded.organization_id || 1
        };
        next();
    } catch (error) {
        console.error('[AUTH] Authentication error:', error.message);
        return res.status(401).json({ error: 'Недействительный токен' });
    }
};

// Alias for backward compatibility
export const authenticateToken = authenticate;

/**
 * Optional authentication - doesn't fail if no token, just sets req.user to null
 */
export const optionalAuthenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Graceful query — try extended columns first, fallback to base
        let userData = null;
        try {
            const result = await pool.query(
                `SELECT id, username, email, full_name, role, user_level, user_type, license_id, created_by_license_id, organization_id
                 FROM users WHERE id = $1 AND is_active = true`,
                [decoded.userId]
            );
            userData = result.rows[0] || null;
        } catch (e) {
            // Extended columns may not exist — fallback to base
            const result = await pool.query(
                'SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );
            userData = result.rows[0] || null;
        }

        if (!userData) {
            req.user = null;
            return next();
        }

        req.user = {
            id: userData.id,
            userId: userData.id,
            username: userData.username,
            email: userData.email,
            fullName: userData.full_name,
            role: userData.role,
            userLevel: userData.user_level || null,
            license_id: userData.license_id || decoded.licenseId || null,
            licenseId: userData.license_id || decoded.licenseId || null,
            created_by_license_id: userData.created_by_license_id || null,
            organization_id: userData.organization_id || decoded.organization_id || 1
        };
        next();
    } catch (error) {
        // On any error, just continue without user
        req.user = null;
        next();
    }
};

/**
 * Middleware для проверки роли пользователя
 * Обновлено для поддержки RBAC (user_roles table) с fallback на users.role
 * @param {...string} allowedRoles - Список разрешенных ролей (название ролей)
 */
export const authorize = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Проверяем роли через user_roles (RBAC)
            const roleResult = await pool.query(
                `SELECT r.name, r.code
                 FROM user_roles ur
                 JOIN roles r ON ur.role_id = r.id
                 WHERE ur.user_id = $1`,
                [req.user.id]
            );

            let userRoles = roleResult.rows.map(r => r.name);

            // Fallback на поле role в таблице users если нет назначенных ролей в RBAC
            if (userRoles.length === 0 && req.user.role) {
                console.log(`[AUTH] No RBAC roles, falling back to user.role: ${req.user.role}`);
                userRoles = [req.user.role];
            }

            if (userRoles.length === 0) {
                console.warn(`[AUTH] User ${req.user.id} has no roles assigned`);
                return res.status(403).json({ error: 'У пользователя нет назначенных ролей' });
            }

            console.log(`[AUTH] User ${req.user.id} roles:`, userRoles);

            // Проверить, есть ли у пользователя одна из разрешенных ролей или роль администратора
            // Also check user_type from authenticate middleware
            const userType = req.user?.user_type || '';
            const hasPermission = userRoles.some(role =>
                allowedRoles.includes(role) ||
                role === 'Администратор' ||
                role === 'admin' ||
                role.toLowerCase() === 'admin'
            ) || ['super_admin', 'admin', 'owner'].includes(userType);

            if (!hasPermission) {
                console.warn(`[AUTH] Access denied for user ${req.user.id}. Required: ${allowedRoles.join(', ')}, Has: ${userRoles.join(', ')}`);
                return res.status(403).json({
                    error: 'Недостаточно прав',
                    required: allowedRoles,
                    current: userRoles
                });
            }

            console.log(`[AUTH] Access granted for user ${req.user.id} with roles: ${userRoles.join(', ')}`);
            next();
        } catch (error) {
            console.error('[AUTH] Authorization error:', error);
            return res.status(500).json({ error: 'Ошибка авторизации' });
        }
    };
};

// Alias for backward compatibility
export const requireRole = authorize;

export const logAudit = async (userId, action, tableName, recordId, oldValues, newValues, ipAddress) => {
    try {
        await pool.query(
            `INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, action, tableName, recordId, oldValues, newValues, ipAddress]
        );
    } catch (error) {
        console.error('Ошибка записи в журнал аудита:', error);
    }
};

/**
 * Middleware для проверки наличия конкретного права у пользователя (RBAC)
 * @param {string} permissionCode - Код права (например: 'products.create', 'sales.read')
 * @returns {Function} Express middleware
 */
export function checkPermission(permissionCode) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Пользователь не аутентифицирован'
                });
            }

            // Проверить наличие права через роли пользователя
            const result = await pool.query(`
                SELECT COUNT(*) > 0 as has_permission
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1 AND p.name = $2
            `, [userId, permissionCode]);

            if (!result.rows[0].has_permission) {
                console.warn(`[RBAC] Access denied for user ${userId}, permission: ${permissionCode}`);
                return res.status(403).json({
                    error: 'Доступ запрещён',
                    requiredPermission: permissionCode,
                    message: `Требуется право: ${permissionCode}`
                });
            }

            console.log(`[RBAC] Permission granted for user ${userId}: ${permissionCode}`);
            next();
        } catch (error) {
            console.error('[RBAC] Permission check error:', error);
            res.status(500).json({ error: 'Ошибка проверки прав доступа' });
        }
    };
}

/**
 * Middleware для проверки наличия хотя бы одного из указанных прав
 * @param {string[]} permissionCodes - Массив кодов прав
 * @returns {Function} Express middleware
 */
export function checkAnyPermission(...permissionCodes) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Пользователь не аутентифицирован'
                });
            }

            const result = await pool.query(`
                SELECT COUNT(*) > 0 as has_permission
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1 AND p.code = ANY($2::text[])
            `, [userId, permissionCodes]);

            if (!result.rows[0].has_permission) {
                console.warn(`[RBAC] Access denied for user ${userId}, required any of: ${permissionCodes.join(', ')}`);
                return res.status(403).json({
                    error: 'Доступ запрещён',
                    requiredPermissions: permissionCodes
                });
            }

            next();
        } catch (error) {
            console.error('[RBAC] Permission check error:', error);
            res.status(500).json({ error: 'Ошибка проверки прав доступа' });
        }
    };
}

/**
 * Вспомогательная функция для проверки прав пользователя (для использования в коде)
 * @param {number} userId - ID пользователя
 * @param {string} permissionCode - Код права
 * @returns {Promise<boolean>} - true если право есть
 */
export async function hasPermission(userId, permissionCode) {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) > 0 as has_permission
            FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = $1 AND p.code = $2
        `, [userId, permissionCode]);

        return result.rows[0].has_permission;
    } catch (error) {
        console.error('[RBAC] hasPermission error:', error);
        return false;
    }
}

/**
 * Получить все права пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<string[]>} - Массив кодов прав
 */
export async function getUserPermissions(userId) {
    try {
        const result = await pool.query(`
            SELECT DISTINCT p.code
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = $1
        `, [userId]);

        return result.rows.map(row => row.code);
    } catch (error) {
        console.error('[RBAC] getUserPermissions error:', error);
        return [];
    }
}

