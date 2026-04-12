import pool from '../config/database.js';

/**
 * Middleware для добавления организации к запросу
 * Получает organization_id из пользователя и добавляет к req
 */
export const attachOrganization = async (req, res, next) => {
    try {
        if (req.user && req.user.id) {
            // Получить organization_id из пользователя
            const result = await pool.query(
                'SELECT organization_id FROM users WHERE id = $1',
                [req.user.id]
            );

            if (result.rows.length > 0 && result.rows[0].organization_id) {
                req.organizationId = result.rows[0].organization_id;
            } else {
                // Дефолтная организация
                req.organizationId = 1;
            }
        } else {
            req.organizationId = 1;
        }
        next();
    } catch (error) {
        console.error('Error attaching organization:', error);
        req.organizationId = 1;
        next();
    }
};

/**
 * Middleware для проверки лицензии
 */
export const checkLicense = async (req, res, next) => {
    try {
        const orgId = req.organizationId || 1;

        const result = await pool.query(`
            SELECT o.*, l.expires_at as license_expires, l.plan, l.max_users, l.max_products
            FROM organizations o
            LEFT JOIN licenses l ON o.id = l.organization_id
            WHERE o.id = $1 AND o.is_active = true
        `, [orgId]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Организация не найдена или неактивна' });
        }

        const org = result.rows[0];

        // Проверить срок лицензии
        if (org.license_expires && new Date(org.license_expires) < new Date()) {
            return res.status(403).json({
                error: 'Срок лицензии истёк',
                license_expired: true,
                expires_at: org.license_expires
            });
        }

        req.organization = org;
        next();
    } catch (error) {
        console.error('Error checking license:', error);
        next(); // Пропускаем если ошибка проверки
    }
};

export default { attachOrganization, checkLicense };
