import pool from '../config/database.js';

/**
 * Middleware для проверки валидности лицензии
 * Применяется ко всем защищённым API endpoints
 */
export const validateLicense = async (req, res, next) => {
    // Разрешить доступ к определённым endpoints без проверки лицензии
    const exemptPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/license/validate',
        '/api/license/activate',
        '/api/license/info',
        '/api/health'
    ];

    // Проверить путь
    if (exemptPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    try {
        // Получить device_id из headers
        const device_id = req.headers['x-device-id'];

        if (!device_id) {
            // В режиме разработки разрешаем доступ без device_id
            if (process.env.NODE_ENV === 'development') {
                return next();
            }
            return res.status(403).json({
                error: 'Требуется идентификатор устройства',
                code: 'DEVICE_ID_REQUIRED'
            });
        }

        // Найти активацию устройства
        const activationResult = await pool.query(`
            SELECT 
                la.*,
                l.status as license_status,
                l.expires_at,
                l.license_type,
                l.features
            FROM license_activations la
            JOIN licenses l ON la.license_id = l.id
            WHERE la.device_id = $1 AND la.is_active = true
        `, [device_id]);

        if (activationResult.rows.length === 0) {
            return res.status(403).json({
                error: 'Устройство не активировано',
                code: 'DEVICE_NOT_ACTIVATED'
            });
        }

        const activation = activationResult.rows[0];

        // Проверить статус лицензии
        if (activation.license_status !== 'active') {
            return res.status(403).json({
                error: `Лицензия ${activation.license_status}`,
                code: 'LICENSE_INACTIVE',
                status: activation.license_status
            });
        }

        // Проверить срок действия
        if (activation.expires_at && new Date(activation.expires_at) < new Date()) {
            // Обновить статус лицензии
            await pool.query(`
                UPDATE licenses SET status = 'expired' WHERE id = $1
            `, [activation.license_id]);

            return res.status(403).json({
                error: 'Лицензия истекла',
                code: 'LICENSE_EXPIRED',
                expires_at: activation.expires_at
            });
        }

        // Обновить last_seen
        pool.query(`
            UPDATE license_activations
            SET last_seen = NOW(), last_ip = $1
            WHERE id = $2
        `, [req.ip, activation.id]).catch(err => {
            console.error('Error updating activation last_seen:', err);
        });

        // Добавить информацию о лицензии в req
        req.license = {
            id: activation.license_id,
            type: activation.license_type,
            features: activation.features,
            expires_at: activation.expires_at
        };

        next();

    } catch (error) {
        console.error('License validation error:', error);

        // В режиме разработки разрешаем доступ при ошибках
        if (process.env.NODE_ENV === 'development') {
            console.warn('Development mode: bypassing license check due to error');
            return next();
        }

        res.status(500).json({
            error: 'Ошибка проверки лицензии',
            code: 'LICENSE_CHECK_ERROR'
        });
    }
};

/**
 * Middleware для проверки конкретной функции лицензии
 * Использование: checkLicenseFeature('advanced_reports')
 */
export const checkLicenseFeature = (feature) => {
    return (req, res, next) => {
        if (!req.license) {
            return res.status(403).json({
                error: 'Лицензия не проверена',
                code: 'LICENSE_NOT_VALIDATED'
            });
        }

        const features = req.license.features || {};

        if (!features[feature]) {
            return res.status(403).json({
                error: `Функция "${feature}" недоступна в вашей лицензии`,
                code: 'FEATURE_NOT_AVAILABLE',
                required_feature: feature
            });
        }

        next();
    };
};

/**
 * Периодическая проверка истёкших лицензий
 * Запускать раз в час
 */
export const checkExpiredLicenses = async () => {
    try {
        await pool.query('SELECT check_expired_licenses()');
        console.log('✓ Checked expired licenses');
    } catch (error) {
        console.error('Error checking expired licenses:', error);
    }
};

export default {
    validateLicense,
    checkLicenseFeature,
    checkExpiredLicenses
};
