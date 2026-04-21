import pool from '../config/database.js';

/**
 * Middleware: attach organization_id from JWT token to request
 * Falls back to database lookup if not in token
 */
export const attachOrganization = async (req, res, next) => {
    try {
        // 1. From JWT token (fastest)
        if (req.user && req.user.organization_id) {
            req.organizationId = req.user.organization_id;
            return next();
        }

        // 2. From database lookup
        if (req.user && req.user.id) {
            const result = await pool.query(
                'SELECT organization_id FROM users WHERE id = $1',
                [req.user.id]
            );

            if (result.rows.length > 0 && result.rows[0].organization_id) {
                req.organizationId = result.rows[0].organization_id;
            } else {
                req.organizationId = 1;
            }
        } else {
            req.organizationId = 1;
        }
        next();
    } catch (error) {
        console.error('Error attaching organization:', error.message);
        req.organizationId = 1;
        next();
    }
};

/**
 * Middleware: enforce organization isolation
 * Blocks access if user has no valid organization
 */
export const enforceOrganization = (req, res, next) => {
    if (!req.organizationId) {
        return res.status(403).json({ error: 'Organization not found' });
    }
    next();
};

/**
 * Middleware: check license validity
 */
export const checkLicense = async (req, res, next) => {
    try {
        const orgId = req.organizationId || 1;

        const result = await pool.query(`
            SELECT o.*, l.expires_at as license_expires, l.plan, l.max_users, l.max_products
            FROM organizations o
            LEFT JOIN licenses l ON o.id = l.organization_id AND l.is_active = true
            WHERE o.id = $1 AND o.is_active = true
        `, [orgId]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Organization not found or inactive' });
        }

        const org = result.rows[0];

        if (org.license_expires && new Date(org.license_expires) < new Date()) {
            return res.status(403).json({
                error: 'License expired',
                license_expired: true,
                expires_at: org.license_expires
            });
        }

        req.organization = org;
        next();
    } catch (error) {
        console.error('Error checking license:', error.message);
        next();
    }
};

/**
 * Helper: build org-filtered query
 * Usage: const { text, values } = orgQuery('SELECT * FROM products', req.organizationId, [], 'WHERE');
 */
export function orgQuery(baseQuery, orgId, params = [], clause = 'WHERE') {
    const paramIndex = params.length + 1;
    const orgFilter = `${clause} organization_id = $${paramIndex}`;
    return {
        text: `${baseQuery} ${orgFilter}`,
        values: [...params, orgId]
    };
}

export default { attachOrganization, enforceOrganization, checkLicense, orgQuery };
