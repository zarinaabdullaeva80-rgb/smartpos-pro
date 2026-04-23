import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// ★ Секрет для синхронизации между локальным сервером и Railway
const CLOUD_SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app';

/**
 * Синхронизация лицензии на облачный сервер Railway
 * Вызывается автоматически после создания лицензии на локальном сервере
 */
async function syncToCloud(licenseData) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify(licenseData),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        console.log('[SYNC] Cloud response:', result);
        return result;
    } catch (error) {
        console.error('[SYNC] Cloud sync failed (non-blocking):', error.message);
        return { error: error.message };
    }
}

/**
 * GET /api/license/resolve?key=XXXX-XXXX-XXXX-XXXX
 * Публичный endpoint (без аутентификации) — резолв лицензионного ключа в URL сервера.
 * Вызывается мобильным приложением при первом запуске до логина.
 */
router.get('/resolve', async (req, res) => {
    try {
        const { key } = req.query;

        if (!key || key.trim().length < 8) {
            return res.status(400).json({ valid: false, error: 'Введите лицензионный ключ' });
        }

        const result = await pool.query(
            `SELECT id, license_key, license_type, status, expires_at,
                    company_name, customer_name, server_type, server_url,
                    max_devices, max_users, features
             FROM licenses WHERE license_key = $1`,
            [key.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'Лицензионный ключ не найден' });
        }

        const license = result.rows[0];

        if (license.status !== 'active') {
            return res.status(403).json({
                valid: false,
                error: license.status === 'expired'
                    ? 'Лицензия истекла. Обратитесь к администратору.'
                    : `Лицензия ${license.status}. Обратитесь к администратору.`
            });
        }

        // Проверить срок действия
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await pool.query("UPDATE licenses SET status = 'expired' WHERE id = $1", [license.id]);
            return res.status(403).json({ valid: false, error: 'Лицензия истекла. Обратитесь к администратору.' });
        }

        // Определить URL сервера
        const currentServerUrl = `${req.protocol}://${req.get('host')}/api`;
        const serverUrl = license.server_url || currentServerUrl;

        res.json({
            valid: true,
            company_name: license.company_name || license.customer_name || 'Организация',
            server_url: serverUrl,
            server_type: license.server_type || 'cloud',
            license_type: license.license_type,
            expires_at: license.expires_at,
            max_devices: license.max_devices,
        });

    } catch (error) {
        console.error('[License Resolve] Error:', error.message);
        res.status(500).json({ valid: false, error: 'Ошибка сервера при проверке ключа' });
    }
});

/**
 * POST /api/license/validate
 * Проверка действительности лицензии
 */
router.post('/validate', async (req, res) => {
    try {
        const { license_key, device_id } = req.body;

        if (!license_key) {
            return res.status(400).json({ error: 'Требуется лицензионный ключ' });
        }

        // Попробовать проверить локально
        let licenseResult = null;
        try {
            licenseResult = await pool.query(`
                SELECT * FROM licenses
                WHERE license_key = $1
            `, [license_key]);
        } catch (dbError) {
            // Таблица licenses может не существовать в локальной БД — пропускаем
            console.log('[License] Local DB error (table may not exist):', dbError.message);
            licenseResult = { rows: [] };
        }

        if (licenseResult.rows.length === 0) {
            // Проверяем, не является ли ЭТОТ сервер облачным (Railway)
            // Если да — не вызываем сам себя (это вызовет бесконечный цикл!)
            const isCloudServer = process.env.RAILWAY_ENVIRONMENT
                || process.env.RAILWAY_PROJECT_ID
                || (req.get('host') || '').includes('railway.app');

            if (isCloudServer) {
                console.log('[License] Ключ не найден в облачной БД:', license_key);
                return res.status(404).json({
                    valid: false,
                    error: 'Лицензионный ключ не найден. Обратитесь к администратору.'
                });
            }

            // Локальный сервер — проверяем на центральном сервере Railway
            console.log('[License] Not found locally, checking Railway cloud server...');
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                const cloudResponse = await fetch('https://smartpos-pro-production.up.railway.app/api/license/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ license_key, device_id }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const cloudData = await cloudResponse.json();
                console.log('[License] Railway response:', cloudData);
                return res.status(cloudResponse.status).json(cloudData);
            } catch (cloudError) {
                console.error('[License] Railway cloud error:', cloudError.message);
                return res.status(404).json({
                    valid: false,
                    error: 'Лицензия не найдена (облачный сервер недоступен)'
                });
            }
        }

        const license = licenseResult.rows[0];

        // Проверить статус
        if (license.status !== 'active') {
            return res.status(403).json({
                valid: false,
                error: `Лицензия ${license.status}`,
                status: license.status
            });
        }

        // Проверить срок действия
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await pool.query(`
                UPDATE licenses SET status = 'expired' WHERE id = $1
            `, [license.id]);

            return res.status(403).json({
                valid: false,
                error: 'Лицензия истекла',
                expires_at: license.expires_at
            });
        }

        // Общие данные лицензии для ответа
        const licenseData = {
            id: license.id,
            type: license.license_type,
            expires_at: license.expires_at,
            max_devices: license.max_devices,
            max_users: license.max_users,
            features: license.features,
            server_type: license.server_type || 'cloud',
            server_url: license.server_url || null,
            customer_name: license.customer_name,
            company_name: license.company_name
        };

        // Если указан device_id, проверить активацию
        if (device_id) {
            const activationResult = await pool.query(`
                SELECT * FROM license_activations
                WHERE license_id = $1 AND device_id = $2 AND is_active = true
            `, [license.id, device_id]);

            res.json({
                valid: true,
                license: licenseData,
                is_activated: activationResult.rows.length > 0
            });
        } else {
            res.json({
                valid: true,
                license: licenseData
            });
        }

    } catch (error) {
        console.error('Error validating license:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/activate
 * Активация устройства по лицензии
 */
router.post('/activate', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { license_key, device_id, device_type, device_name, device_fingerprint } = req.body;

        if (!license_key || !device_id) {
            return res.status(400).json({ error: 'Требуются license_key и device_id' });
        }

        // Получить лицензию
        const licenseResult = await client.query(`
            SELECT * FROM licenses WHERE license_key = $1
        `, [license_key]);

        if (licenseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }

        const license = licenseResult.rows[0];

        // Проверить статус и срок
        if (license.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: `Лицензия ${license.status}` });
        }

        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Лицензия истекла' });
        }

        // Проверить лимит устройств
        const activeDevicesResult = await client.query(`
            SELECT COUNT(*) as count
            FROM license_activations
            WHERE license_id = $1 AND is_active = true
        `, [license.id]);

        const activeDevices = parseInt(activeDevicesResult.rows[0].count);

        // Проверить, не активировано ли уже это устройство
        const existingResult = await client.query(`
            SELECT * FROM license_activations
            WHERE license_id = $1 AND device_id = $2
        `, [license.id, device_id]);

        if (existingResult.rows.length > 0) {
            // Устройство уже активировано, обновить last_seen
            await client.query(`
                UPDATE license_activations
                SET last_seen = NOW(), is_active = true
                WHERE license_id = $1 AND device_id = $2
            `, [license.id, device_id]);
        } else {
            // Новое устройство
            if (activeDevices >= license.max_devices) {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'Достигнут лимит устройств',
                    max_devices: license.max_devices,
                    active_devices: activeDevices
                });
            }

            // Активировать
            await client.query(`
                INSERT INTO license_activations (
                    license_id, device_id, device_type, device_name, 
                    device_fingerprint, last_ip
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [license.id, device_id, device_type, device_name, device_fingerprint, req.ip]);

            // Логирование в историю
            await client.query(`
                INSERT INTO license_history (license_id, action, details)
                VALUES ($1, 'device_activated', $2)
            `, [license.id, JSON.stringify({ device_id, device_type, device_name })]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Устройство успешно активировано',
            license: {
                type: license.license_type,
                expires_at: license.expires_at,
                features: license.features
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error activating license:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /api/license/info/:key
 * Информация о лицензии
 */
router.get('/info/:key', async (req, res) => {
    try {
        const { key } = req.params;

        const result = await pool.query(`
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM license_activations WHERE license_id = l.id AND is_active = true) as active_devices
            FROM licenses l
            WHERE license_key = $1
        `, [key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }

        const license = result.rows[0];

        res.json({
            license_key: license.license_key,
            customer_name: license.customer_name,
            license_type: license.license_type,
            status: license.status,
            max_devices: license.max_devices,
            active_devices: parseInt(license.active_devices),
            max_users: license.max_users,
            expires_at: license.expires_at,
            features: license.features
        });

    } catch (error) {
        console.error('Error fetching license info:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/deactivate/:device_id
 * Деактивация устройства
 */
router.post('/deactivate/:device_id', authenticate, async (req, res) => {
    try {
        const { device_id } = req.params;
        const { reason } = req.body;

        const result = await pool.query(`
            UPDATE license_activations
            SET is_active = false,
                deactivated_at = NOW(),
                deactivation_reason = $1
            WHERE device_id = $2
            RETURNING license_id
        `, [reason, device_id]);

        if (result.rows.length > 0) {
            // Логирование
            await pool.query(`
                INSERT INTO license_history (license_id, action, performed_by, details)
                VALUES ($1, 'device_deactivated', $2, $3)
            `, [result.rows[0].license_id, req.user.id, JSON.stringify({ device_id, reason })]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deactivating device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/admin/licenses
 * Список всех лицензий (только admin)
 */
router.get('/admin/licenses', authenticate, async (req, res) => {
    try {
        const { status, type, limit = 100 } = req.query;

        let query = `
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM license_activations WHERE license_id = l.id AND is_active = true) as active_devices,
                u.username as created_by_username
            FROM licenses l
            LEFT JOIN users u ON l.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND l.status = $${params.length}`;
        }

        if (type) {
            params.push(type);
            query += ` AND l.license_type = $${params.length}`;
        }

        params.push(limit);
        query += ` ORDER BY l.created_at DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);

        res.json({ licenses: result.rows });
    } catch (error) {
        console.error('Error fetching licenses:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/admin/licenses
 * Создание новой лицензии (только admin)
 */
router.post('/admin/licenses', authenticate, auditLog('license'), async (req, res) => {
    try {
        const {
            customer_name,
            customer_email,
            customer_phone,
            customer_username,
            customer_password,
            company_name,
            license_type,
            max_devices = 1,
            max_users = 5,
            max_pos_terminals = 1,
            trial_days = 0,
            features = {},
            // Server configuration
            server_type = 'cloud',  // 'cloud' or 'self_hosted'
            server_url = null,      // URL for self-hosted servers
            server_api_key = null   // Optional API key for self-hosted
        } = req.body;

        // Validate customer credentials
        if (!customer_username || !customer_password) {
            return res.status(400).json({
                error: 'Требуются customer_username и customer_password'
            });
        }

        // Validate server configuration
        if (server_type === 'self_hosted' && !server_url) {
            return res.status(400).json({
                error: 'Для self_hosted требуется указать server_url'
            });
        }

        // Check username uniqueness
        const existingUser = await pool.query(
            'SELECT id FROM licenses WHERE customer_username = $1',
            [customer_username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                error: 'Логин уже используется другой лицензией'
            });
        }

        // Hash password
        const bcryptModule = await import('bcrypt');
        const bcrypt = bcryptModule.default || bcryptModule;
        const customer_password_hash = await bcrypt.hash(customer_password, 10);

        // Генерировать ключ
        const keyResult = await pool.query('SELECT generate_license_key()');
        const license_key = keyResult.rows[0].generate_license_key;

        // Вычислить срок действия
        let expires_at = null;
        if (license_type === 'trial' && trial_days > 0) {
            expires_at = new Date();
            expires_at.setDate(expires_at.getDate() + trial_days);
        } else if (license_type === 'monthly') {
            expires_at = new Date();
            expires_at.setMonth(expires_at.getMonth() + 1);
        } else if (license_type === 'yearly') {
            expires_at = new Date();
            expires_at.setFullYear(expires_at.getFullYear() + 1);
        }
        // lifetime = null

        const result = await pool.query(`
            INSERT INTO licenses (
                license_key, customer_name, customer_email, customer_phone,
                customer_username, customer_password_hash,
                company_name, license_type, max_devices, max_users,
                max_pos_terminals, expires_at, trial_days, features, created_by,
                server_type, server_url, server_api_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `, [
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices, max_users,
            max_pos_terminals, expires_at, trial_days, JSON.stringify(features), req.user.id,
            server_type, server_url, server_api_key
        ]);

        // Логирование
        await pool.query(`
            INSERT INTO license_history (license_id, action, performed_by)
            VALUES ($1, 'created', $2)
        `, [result.rows[0].id, req.user.id]);

        // ★ Авто-создание организации для новой лицензии
        const licenseId = result.rows[0].id;
        const orgCode = 'ORG-' + Date.now().toString(36).toUpperCase();
        const orgName = company_name || customer_name || customer_username;
        let organizationId = null;

        try {
            const orgResult = await pool.query(`
                INSERT INTO organizations (name, code, license_key, is_active)
                VALUES ($1, $2, $3, true) RETURNING id
            `, [orgName, orgCode, license_key]);
            organizationId = orgResult.rows[0].id;

            // Привязать лицензию к организации
            try {
                await pool.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [organizationId, licenseId]);
            } catch (e) { /* organization_id column may not exist */ }

            // Создать пользователя-владельца и привязать к организации
            await pool.query(`
                INSERT INTO users (username, email, password_hash, full_name, role,
                                   license_id, organization_id, user_type, is_active)
                VALUES ($1, $2, $3, $4, 'Администратор', $5, $6, 'owner', true)
                ON CONFLICT (username) DO UPDATE SET organization_id = $6, license_id = $5
            `, [
                customer_username,
                customer_email || customer_username + '@smartpos.local',
                customer_password_hash,
                customer_name || customer_username,
                licenseId, organizationId
            ]);

            // Создать склад по умолчанию
            await pool.query(`
                INSERT INTO warehouses (name, code, is_active, organization_id)
                VALUES ('Основной склад', $1, true, $2)
            `, ['WH-' + organizationId, organizationId]);

            console.log(`[LICENSE] Created org #${organizationId} "${orgName}" + warehouse + owner for license #${licenseId}`);
        } catch (orgErr) {
            console.error('[LICENSE] Org creation error (license still created):', orgErr.message);
        }

        // ★ Автоматическая синхронизация на Railway Cloud
        let syncResult = null;
        try {
            syncResult = await syncToCloud({
                license_key,
                customer_name,
                customer_email,
                customer_phone,
                customer_username,
                customer_password_hash,
                company_name: company_name || customer_name || customer_username,
                license_type,
                max_devices,
                max_users,
                max_pos_terminals,
                expires_at,
                trial_days,
                features,
                server_type,
                server_url,
                server_api_key
            });
            console.log('[LICENSE] Cloud sync result:', syncResult?.success ? '✅ OK' : '⚠️ ' + (syncResult?.error || 'unknown'));
        } catch (syncErr) {
            console.warn('[LICENSE] Cloud sync error (non-blocking):', syncErr.message);
        }

        res.json({
            success: true,
            license: result.rows[0],
            organization_id: organizationId,
            cloud_synced: syncResult?.success || false,
            message: `Лицензия создана. Организация "${orgName}" создана. Передайте клиенту логин: ${customer_username}`
        });

    } catch (error) {
        console.error('Error creating license:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/license/admin/licenses/:id
 * Обновление лицензии (только admin)
 */
router.put('/admin/licenses/:id', authenticate, auditLog('license'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, expires_at, max_devices, max_users, features, server_type, server_url } = req.body;

        const updates = [];
        const params = [];
        let paramCount = 1;

        if (status !== undefined) {
            params.push(status);
            updates.push(`status = $${paramCount++}`);
        }
        if (expires_at !== undefined) {
            params.push(expires_at);
            updates.push(`expires_at = $${paramCount++}`);
        }
        if (max_devices !== undefined) {
            params.push(max_devices);
            updates.push(`max_devices = $${paramCount++}`);
        }
        if (max_users !== undefined) {
            params.push(max_users);
            updates.push(`max_users = $${paramCount++}`);
        }
        if (features !== undefined) {
            params.push(JSON.stringify(features));
            updates.push(`features = $${paramCount++}`);
        }
        if (server_type !== undefined) {
            params.push(server_type);
            updates.push(`server_type = $${paramCount++}`);
        }
        if (server_url !== undefined) {
            params.push(server_url);
            updates.push(`server_url = $${paramCount++}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Нет данных для обновления' });
        }

        params.push(id);
        const query = `
            UPDATE licenses 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }

        // Логирование
        await pool.query(`
            INSERT INTO license_history (license_id, action, performed_by, details)
            VALUES ($1, 'updated', $2, $3)
        `, [id, req.user.id, JSON.stringify(req.body)]);

        res.json({
            success: true,
            license: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating license:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/admin/licenses/:id/reset-credentials
 * Сброс логина/пароля клиента (только admin)
 */
router.post('/admin/licenses/:id/reset-credentials', authenticate, auditLog('license'), async (req, res) => {
    try {
        const { id } = req.params;
        const { new_username, new_password } = req.body;

        if (!new_username && !new_password) {
            return res.status(400).json({ error: 'Укажите новый логин и/или пароль' });
        }

        // Check if license exists
        const licenseResult = await pool.query('SELECT * FROM licenses WHERE id = $1', [id]);
        if (licenseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }

        const updates = [];
        const params = [];
        let paramCount = 1;

        // Update username if provided
        if (new_username) {
            // Check uniqueness
            const existingUser = await pool.query(
                'SELECT id FROM licenses WHERE customer_username = $1 AND id != $2',
                [new_username, id]
            );
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Логин уже используется другой лицензией' });
            }
            params.push(new_username);
            updates.push(`customer_username = $${paramCount++}`);
        }

        // Update password if provided
        if (new_password) {
            if (new_password.length < 6) {
                return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
            }
            const bcryptModule = await import('bcrypt');
            const bcrypt = bcryptModule.default || bcryptModule;
            const password_hash = await bcrypt.hash(new_password, 10);
            params.push(password_hash);
            updates.push(`customer_password_hash = $${paramCount++}`);
        }

        params.push(id);
        const query = `
            UPDATE licenses 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING id, customer_username, customer_name, license_key
        `;

        const result = await pool.query(query, params);

        // Log the action
        await pool.query(`
            INSERT INTO license_history (license_id, action, performed_by, details)
            VALUES ($1, 'credentials_reset', $2, $3)
        `, [id, req.user.id, JSON.stringify({
            username_changed: !!new_username,
            password_changed: !!new_password
        })]);

        res.json({
            success: true,
            message: 'Учётные данные клиента обновлены',
            license: result.rows[0]
        });

    } catch (error) {
        console.error('Error resetting credentials:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/register-with-license
 * Регистрация пользователя с лицензией
 */
router.post('/register-with-license', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { license_key, username, email, password, full_name, company_name } = req.body;

        if (!license_key || !username || !email || !password) {
            return res.status(400).json({ error: 'Требуются: license_key, username, email, password' });
        }

        // Проверить лицензию
        const licenseResult = await client.query(
            'SELECT * FROM licenses WHERE license_key = $1 AND is_active = true',
            [license_key]
        );

        if (licenseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Лицензия не найдена или неактивна' });
        }

        const license = licenseResult.rows[0];

        // Проверить срок действия
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Срок действия лицензии истёк' });
        }

        // Проверить лимит пользователей
        const userCountResult = await client.query(
            'SELECT COUNT(*) as count FROM users WHERE license_id = $1',
            [license.id]
        );

        if (parseInt(userCountResult.rows[0].count) >= license.max_users) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: `Достигнут лимит пользователей (${license.max_users})`
            });
        }

        // Создать пользователя
        const bcryptModule = await import('bcrypt');
        const bcrypt = bcryptModule.default || bcryptModule;
        const password_hash = await bcrypt.hash(password, 10);

        const userResult = await client.query(`
            INSERT INTO users (
                username, email, password_hash, full_name, role,
                license_id, user_level, is_active
            )
            VALUES ($1, $2, $3, $4, 'admin', $5, 'license_owner', true)
            RETURNING id, username, email, full_name, role, user_level
        `, [username, email, password_hash, full_name, license.id]);

        const user = userResult.rows[0];

        // Создать организацию если указано
        if (company_name) {
            await client.query(`
                INSERT INTO organizations (name, license_id, owner_id)
                VALUES ($1, $2, $3)
            `, [company_name, license.id, user.id]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            user,
            license: {
                type: license.license_type,
                expires_at: license.expires_at,
                max_users: license.max_users
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error registering with license:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * POST /api/license/create-team-member
 * Создание подчинённого пользователя (админ магазина или продавец)
 */
router.post('/create-team-member', authenticate, async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { username, email, password, full_name, user_level, shop_id, license_key } = req.body;

        // Проверить права создателя
        const creatorResult = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [req.user.id]
        );

        const creator = creatorResult.rows[0];

        // Определить license_id: суперадмин может указать license_key
        let targetLicenseId = creator.license_id;
        const userType = req.user.user_type || creator.user_type || '';
        const isSuperAdmin = ['super_admin', 'admin', 'owner'].includes(userType) ||
                             creator.role === 'Администратор';

        if (license_key && isSuperAdmin) {
            const licResult = await client.query(
                'SELECT id FROM licenses WHERE license_key = $1',
                [license_key]
            );
            if (licResult.rows.length > 0) {
                targetLicenseId = licResult.rows[0].id;
            }
        }

        if (!targetLicenseId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'У вас нет привязанной лицензии' });
        }

        // Проверить иерархию прав (суперадмин может создавать любых)
        if (!isSuperAdmin) {
            const allowedLevels = {
                'license_owner': ['shop_admin', 'seller'],
                'shop_admin': ['seller']
            };

            if (!allowedLevels[creator.user_level]?.includes(user_level)) {
                await client.query('ROLLBACK');
                return res.status(403).json({
                    error: 'Недостаточно прав для создания пользователя этого уровня'
                });
            }
        }

        // Проверить лимит пользователей лицензии
        const userCountResult = await client.query(
            'SELECT COUNT(*) as count FROM users WHERE license_id = $1',
            [targetLicenseId]
        );

        const licenseResult = await client.query(
            'SELECT max_users FROM licenses WHERE id = $1',
            [targetLicenseId]
        );

        const maxUsers = licenseResult.rows[0].max_users;

        if (parseInt(userCountResult.rows[0].count) >= maxUsers) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: `Достигнут лимит пользователей (${maxUsers})`
            });
        }

        // Создать пользователя
        const bcryptModule = await import('bcrypt');
        const bcrypt = bcryptModule.default || bcryptModule;
        const password_hash = await bcrypt.hash(password, 10);

        const roleMapping = {
            'shop_admin': 'manager',
            'seller': 'cashier'
        };

        const userResult = await client.query(`
            INSERT INTO users (
                username, email, password_hash, full_name, role,
                license_id, user_level, created_by, shop_id, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
            RETURNING id, username, email, full_name, role, user_level, shop_id
        `, [
            username, email, password_hash, full_name,
            roleMapping[user_level] || 'cashier',
            targetLicenseId, user_level, creator.id, shop_id
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            user: userResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating team member:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /api/license/my-team
 * Список подчинённых пользователей
 */
router.get('/my-team', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, username, email, full_name, role, user_level,
                shop_id, is_active, created_at
            FROM users
            WHERE created_by = $1
            ORDER BY created_at DESC
        `, [req.user.id]);

    res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/admin/licenses/:id/team
 * Список сотрудников конкретной лицензии (для админ-панели)
 */
router.get('/admin/licenses/:id/team', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Найти всех пользователей, привязанных к этой лицензии
        const result = await pool.query(`
            SELECT 
                u.id, u.username, u.email, u.full_name, u.role, u.user_level,
                u.is_active, u.last_login, u.created_at
            FROM users u
            WHERE u.license_id = $1
               OR u.created_by IN (SELECT id FROM users WHERE license_id = $1)
            ORDER BY u.created_at DESC
        `, [id]);

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching license team:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/my-license
 * Информация о своей лицензии
 */
router.get('/my-license', authenticate, async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT license_id FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!userResult.rows[0].license_id) {
            return res.status(404).json({ error: 'Лицензия не привязана' });
        }

        const result = await pool.query(`
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM users WHERE license_id = l.id) as current_users
            FROM licenses l
            WHERE l.id = $1
        `, [userResult.rows[0].license_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }

        const license = result.rows[0];

        res.json({
            license_key: license.license_key,
            license_type: license.license_type,
            duration_days: license.duration_days,
            max_users: license.max_users,
            current_users: parseInt(license.current_users),
            expires_at: license.expires_at,
            is_active: license.is_active,
            features: license.features
        });
    } catch (error) {
        console.error('Error fetching license:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/check-expiry
 * Проверка истечения лицензии (вызывается клиентом периодически)
 */
router.get('/check-expiry', authenticate, async (req, res) => {
    try {
        // Получить license_id пользователя
        let licenseId = null;
        try {
            const userResult = await pool.query(
                'SELECT license_id FROM users WHERE id = $1',
                [req.user.id]
            );
            licenseId = userResult.rows[0]?.license_id || req.user.licenseId;
        } catch (e) {
            licenseId = req.user.licenseId;
        }

        if (!licenseId) {
            // Нет лицензии (super_admin) — всё ок
            return res.json({ expired: false, type: 'no_license' });
        }

        const result = await pool.query(
            'SELECT id, license_type, status, expires_at, max_devices, max_users, features, customer_name, company_name FROM licenses WHERE id = $1',
            [licenseId]
        );

        if (result.rows.length === 0) {
            return res.json({ expired: true, error: 'Лицензия не найдена' });
        }

        const license = result.rows[0];

        // Проверить статус
        if (license.status !== 'active') {
            return res.json({
                expired: true,
                expires_at: license.expires_at,
                reason: `Лицензия ${license.status}`
            });
        }

        // Проверить срок
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            // Обновить статус на expired
            await pool.query(
                "UPDATE licenses SET status = 'expired' WHERE id = $1",
                [license.id]
            );

            return res.json({
                expired: true,
                expires_at: license.expires_at,
                reason: 'Срок действия лицензии истёк'
            });
        }

        // Лицензия активна
        res.json({
            expired: false,
            license: {
                id: license.id,
                type: license.license_type,
                expires_at: license.expires_at,
                max_devices: license.max_devices,
                max_users: license.max_users,
                features: license.features,
                customer_name: license.customer_name,
                company_name: license.company_name
            }
        });

    } catch (error) {
        console.error('Error checking license expiry:', error);
        // При ошибке не блокируем — отдаём expired: false
        res.json({ expired: false, error: error.message });
    }
});

/**
 * Middleware для аутентификации клиента
 */
async function authenticateCustomer(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Требуется токен' });
        }

        const jwtModule = await import('jsonwebtoken');
        const jwt = jwtModule.default || jwtModule;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        if (decoded.type !== 'customer') {
            return res.status(403).json({ error: 'Доступ запрещён' });
        }

        // Load license
        const result = await pool.query(`
            SELECT * FROM licenses WHERE id = $1 AND status = 'active'
        `, [decoded.licenseId]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Лицензия не найдена' });
        }

        req.license = result.rows[0];
        req.customerUsername = decoded.customerUsername;
        next();

    } catch (error) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
}

/**
 * POST /api/license/customer/login
 * Вход для клиента с лицензией
 */
router.post('/customer/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find license by customer username
        const result = await pool.query(`
            SELECT * FROM licenses
            WHERE customer_username = $1 AND status = 'active'
        `, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверные учётные данные' });
        }

        const license = result.rows[0];

        // Verify password
        const bcrypt = await import('bcrypt');
        const valid = await bcrypt.compare(password, license.customer_password_hash);

        if (!valid) {
            return res.status(401).json({ error: 'Неверные учётные данные' });
        }

        // Update last login
        await pool.query(`
            UPDATE licenses SET customer_last_login = NOW() WHERE id = $1
        `, [license.id]);

        // Generate JWT token
        const jwtModule = await import('jsonwebtoken');
        const jwt = jwtModule.default || jwtModule;
        const token = jwt.sign(
            {
                licenseId: license.id,
                customerUsername: username,
                type: 'customer'
            },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '30d' }
        );

        res.json({
            token,
            license: {
                id: license.id,
                company_name: license.company_name,
                license_type: license.license_type,
                expires_at: license.expires_at,
                max_devices: license.max_devices,
                features: license.features
            },
            // Server configuration for client apps
            server_config: {
                type: license.server_type || 'cloud',
                url: license.server_type === 'self_hosted' ? license.server_url : (process.env.RAILWAY_API_URL || 'https://smartpos-pro-production.up.railway.app/api'),
                api_key: license.server_api_key
            }
        });

    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/customer/devices
 * Список устройств клиента
 */
router.get('/customer/devices', authenticateCustomer, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                device_id, device_name, device_type,
                activated_at, last_seen, is_active
            FROM license_activations
            WHERE license_id = $1
            ORDER BY activated_at DESC
        `, [req.license.id]);

        res.json({
            devices: result.rows,
            max_devices: req.license.max_devices
        });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/customer/register-device
 * Регистрация нового устройства клиентом
 */
router.post('/customer/register-device', authenticateCustomer, async (req, res) => {
    try {
        const { device_id, device_name, device_type, device_fingerprint } = req.body;

        if (!device_id) {
            return res.status(400).json({ error: 'Требуется device_id' });
        }

        // Check if device already exists
        const existing = await pool.query(`
            SELECT * FROM license_activations
            WHERE license_id = $1 AND device_id = $2
        `, [req.license.id, device_id]);

        if (existing.rows.length > 0) {
            // Reactivate if was deactivated
            await pool.query(`
                UPDATE license_activations
                SET is_active = true, last_seen = NOW()
                WHERE license_id = $1 AND device_id = $2
            `, [req.license.id, device_id]);

            return res.json({
                success: true,
                message: 'Устройство уже зарегистрировано и активировано'
            });
        }

        // Check device limit
        const activeCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM license_activations
            WHERE license_id = $1 AND is_active = true
        `, [req.license.id]);

        if (parseInt(activeCount.rows[0].count) >= req.license.max_devices) {
            return res.status(403).json({
                error: `Достигнут лимит устройств (${req.license.max_devices})`,
                suggestion: 'Удалите неиспользуемое устройство чтобы добавить новое'
            });
        }

        // Register device
        await pool.query(`
            INSERT INTO license_activations (
                license_id, device_id, device_name, device_type,
                device_fingerprint, last_ip
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.license.id, device_id, device_name, device_type, device_fingerprint, req.ip]);

        // Log history
        await pool.query(`
            INSERT INTO license_history (license_id, action, details)
            VALUES ($1, 'customer_device_registered', $2)
        `, [req.license.id, JSON.stringify({ device_id, device_name, device_type })]);

        res.json({ success: true, message: 'Устройство зарегистрировано' });
    } catch (error) {
        console.error('Error registering device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/license/customer/devices/:device_id
 * Удаление устройства клиентом
 */
router.delete('/customer/devices/:device_id', authenticateCustomer, async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE license_activations
            SET is_active = false, deactivated_at = NOW(), deactivation_reason = 'customer_removal'
            WHERE license_id = $1 AND device_id = $2
            RETURNING *
        `, [req.license.id, req.params.device_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Устройство не найдено' });
        }

        // Log history
        await pool.query(`
            INSERT INTO license_history (license_id, action, details)
            VALUES ($1, 'customer_device_removed', $2)
        `, [req.license.id, JSON.stringify({ device_id: req.params.device_id })]);

        res.json({ success: true, message: 'Устройство удалено' });
    } catch (error) {
        console.error('Error removing device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/admin/history
 * История выдач и действий с лицензиями
 */
router.get('/admin/history', authenticate, async (req, res) => {
    try {
        const { limit = 100, license_id } = req.query;
        
        let query = `
            SELECT 
                lh.id, lh.license_id, lh.action, lh.performed_by, lh.details,
                lh.created_at,
                l.license_key, l.customer_name, l.company_name, l.license_type, l.status,
                u.username as performed_by_username
            FROM license_history lh
            LEFT JOIN licenses l ON lh.license_id = l.id
            LEFT JOIN users u ON lh.performed_by = u.id
        `;
        const params = [];
        
        if (license_id) {
            params.push(license_id);
            query += ` WHERE lh.license_id = $${params.length}`;
        }
        
        params.push(parseInt(limit));
        query += ` ORDER BY lh.created_at DESC LIMIT $${params.length}`;
        
        const result = await pool.query(query, params);
        
        res.json({ history: result.rows });
    } catch (error) {
        console.error('Error fetching license history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/license/:id/export
 * Экспорт всех данных лицензии перед удалением (бэкап)
 * Возвращает JSON со всеми товарами, продажами, клиентами, сотрудниками и т.д.
 */
router.get('/:id/export', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка прав — только super_admin / owner
        const userType = req.user.user_type || '';
        const userRole = req.user.role || '';
        if (!['super_admin', 'admin', 'owner'].includes(userType) && !['Администратор', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Только администратор может экспортировать данные лицензии' });
        }

        // Получить саму лицензию
        const licenseRes = await pool.query('SELECT * FROM licenses WHERE id = $1', [id]);
        if (licenseRes.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }
        const license = licenseRes.rows[0];
        // Убрать хэш пароля из экспорта
        delete license.customer_password_hash;

        // Экспорт всех связанных данных
        const exportData = {
            export_version: '1.0',
            exported_at: new Date().toISOString(),
            exported_by: req.user.username,
            license,
            data: {}
        };

        // Сотрудники (users)
        try {
            const users = await pool.query(
                'SELECT id, username, email, full_name, phone, role, user_type, is_active, created_at, last_login FROM users WHERE license_id = $1 OR created_by_license_id = $1',
                [id]
            );
            exportData.data.employees = users.rows;
        } catch (e) { exportData.data.employees = []; }

        // Товары
        try {
            const products = await pool.query(
                `SELECT p.*, pc.name AS category_name,
                        COALESCE(SUM(im.quantity), 0) AS stock_quantity
                 FROM products p
                 LEFT JOIN product_categories pc ON p.category_id = pc.id
                 LEFT JOIN inventory_movements im ON p.id = im.product_id AND (im.license_id = $1 OR im.license_id IS NULL)
                 WHERE p.license_id = $1 OR p.license_id IS NULL
                 GROUP BY p.id, pc.name`,
                [id]
            );
            exportData.data.products = products.rows;
        } catch (e) { exportData.data.products = []; }

        // Продажи + позиции
        try {
            const sales = await pool.query(
                `SELECT s.*, u.username AS cashier_name
                 FROM sales s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.license_id = $1
                 ORDER BY s.created_at DESC`,
                [id]
            );
            for (const sale of sales.rows) {
                try {
                    const items = await pool.query(
                        'SELECT si.*, p.name AS product_name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1',
                        [sale.id]
                    );
                    sale.items = items.rows;
                } catch (e) { sale.items = []; }
            }
            exportData.data.sales = sales.rows;
        } catch (e) { exportData.data.sales = []; }

        // Закупки + позиции
        try {
            const purchases = await pool.query(
                'SELECT * FROM purchases WHERE license_id = $1 ORDER BY created_at DESC',
                [id]
            );
            for (const purchase of purchases.rows) {
                try {
                    const items = await pool.query(
                        'SELECT pi.*, p.name AS product_name FROM purchase_items pi LEFT JOIN products p ON pi.product_id = p.id WHERE pi.purchase_id = $1',
                        [purchase.id]
                    );
                    purchase.items = items.rows;
                } catch (e) { purchase.items = []; }
            }
            exportData.data.purchases = purchases.rows;
        } catch (e) { exportData.data.purchases = []; }

        // Клиенты
        try {
            const customers = await pool.query('SELECT * FROM customers WHERE license_id = $1', [id]);
            exportData.data.customers = customers.rows;
        } catch (e) { exportData.data.customers = []; }

        // Движения склада
        try {
            const movements = await pool.query(
                'SELECT im.*, p.name AS product_name FROM inventory_movements im LEFT JOIN products p ON im.product_id = p.id WHERE im.license_id = $1 ORDER BY im.created_at DESC LIMIT 10000',
                [id]
            );
            exportData.data.inventory_movements = movements.rows;
        } catch (e) { exportData.data.inventory_movements = []; }

        // Склады
        try {
            const warehouses = await pool.query('SELECT * FROM warehouses WHERE license_id = $1', [id]);
            exportData.data.warehouses = warehouses.rows;
        } catch (e) { exportData.data.warehouses = []; }

        // Активации устройств
        try {
            const activations = await pool.query('SELECT * FROM license_activations WHERE license_id = $1', [id]);
            exportData.data.device_activations = activations.rows;
        } catch (e) { exportData.data.device_activations = []; }

        // История лицензии
        try {
            const history = await pool.query('SELECT * FROM license_history WHERE license_id = $1 ORDER BY created_at DESC', [id]);
            exportData.data.license_history = history.rows;
        } catch (e) { exportData.data.license_history = []; }

        // Telegram боты и чаты
        try {
            const bots = await pool.query('SELECT * FROM telegram_bots WHERE license_id = $1', [id]);
            exportData.data.telegram_bots = bots.rows;
        } catch (e) { exportData.data.telegram_bots = []; }
        try {
            const chats = await pool.query('SELECT * FROM telegram_chats WHERE license_id = $1', [id]);
            exportData.data.telegram_chats = chats.rows;
        } catch (e) { exportData.data.telegram_chats = []; }

        // Статистика экспорта
        exportData.stats = {
            employees: exportData.data.employees.length,
            products: exportData.data.products.length,
            sales: exportData.data.sales.length,
            purchases: exportData.data.purchases.length,
            customers: exportData.data.customers.length,
            inventory_movements: exportData.data.inventory_movements.length,
            warehouses: exportData.data.warehouses.length,
            device_activations: exportData.data.device_activations.length,
        };

        console.log(`[License Export] License ${id} exported: ${JSON.stringify(exportData.stats)}`);

        res.json(exportData);
    } catch (error) {
        console.error('Error exporting license data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/license/:id
 * Каскадное удаление лицензии и ВСЕХ связанных данных
 * Только для super_admin / owner, только после экспорта (confirmed=true)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmed } = req.query;

        // Проверка прав — только super_admin / owner
        const userType = req.user.user_type || '';
        const userRole = req.user.role || '';
        if (!['super_admin', 'admin', 'owner'].includes(userType) && !['Администратор', 'admin'].includes(userRole)) {
            return res.status(403).json({ error: 'Только администратор может удалять лицензии' });
        }

        // Проверка подтверждения
        if (confirmed !== 'true') {
            return res.status(400).json({ 
                error: 'Требуется подтверждение удаления. Сначала экспортируйте данные.',
                hint: 'Добавьте ?confirmed=true после экспорта данных'
            });
        }

        // Проверка существования лицензии
        const licCheck = await pool.query('SELECT id, customer_name, license_key FROM licenses WHERE id = $1', [id]);
        if (licCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Лицензия не найдена' });
        }
        const licInfo = licCheck.rows[0];

        // Каскадное удаление в транзакции
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const deletedCounts = {};

            // 1. Удаляем позиции продаж (через sales)
            try {
                const salesIds = await client.query('SELECT id FROM sales WHERE license_id = $1', [id]);
                if (salesIds.rows.length > 0) {
                    const ids = salesIds.rows.map(r => r.id);
                    await client.query('DELETE FROM sale_items WHERE sale_id = ANY($1::int[])', [ids]);
                    try { await client.query('DELETE FROM sale_payment_details WHERE sale_id = ANY($1::int[])', [ids]); } catch (e) {}
                }
            } catch (e) {}

            // 2. Удаляем позиции закупок (через purchases)
            try {
                const purchaseIds = await client.query('SELECT id FROM purchases WHERE license_id = $1', [id]);
                if (purchaseIds.rows.length > 0) {
                    const ids = purchaseIds.rows.map(r => r.id);
                    await client.query('DELETE FROM purchase_items WHERE purchase_id = ANY($1::int[])', [ids]);
                }
            } catch (e) {}

            // 3. Удаляем основные таблицы с license_id
            const tables = [
                'telegram_chats', 'telegram_bots',
                'inventory_movements', 'sales', 'purchases',
                'customers', 'warehouses', 'products',
                'license_activations', 'license_history'
            ];

            for (const table of tables) {
                try {
                    const r = await client.query(`DELETE FROM ${table} WHERE license_id = $1`, [id]);
                    deletedCounts[table] = r.rowCount;
                } catch (e) {
                    deletedCounts[table] = 0;
                }
            }

            // 4. Удаляем сотрудников (users привязанных к лицензии)
            try {
                const r = await client.query('DELETE FROM users WHERE created_by_license_id = $1 AND id != $2', [id, req.user.id]);
                deletedCounts.employees = r.rowCount;
            } catch (e) { deletedCounts.employees = 0; }

            // 5. Обнуляем license_id у пользователей (не удаляем самого админа)
            try {
                await client.query('UPDATE users SET license_id = NULL, created_by_license_id = NULL WHERE license_id = $1', [id]);
            } catch (e) {}

            // 6. Удаляем саму лицензию
            const result = await client.query('DELETE FROM licenses WHERE id = $1 RETURNING *', [id]);
            deletedCounts.license = result.rowCount;

            await client.query('COMMIT');

            // Аудит
            try {
                await pool.query(
                    `INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, ip_address, created_at)
                     VALUES ($1, 'DELETE_LICENSE', 'licenses', $2, $3, $4, NOW())`,
                    [req.user.id, id, JSON.stringify({ customer_name: licInfo.customer_name, license_key: licInfo.license_key, deleted_counts: deletedCounts }), req.ip]
                );
            } catch (e) {}

            console.log(`[License Delete] License ${id} (${licInfo.customer_name}) fully deleted. Counts:`, deletedCounts);

            res.json({ 
                success: true, 
                message: `Лицензия "${licInfo.customer_name}" и все связанные данные удалены`,
                deleted: deletedCounts
            });
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting license:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/license/all/cleanup
 * Удаление всех лицензий (только для администраторов)
 */
router.delete('/all/cleanup', authenticate, async (req, res) => {
    try {
        try { await pool.query('DELETE FROM license_activations'); } catch (e) { }
        try { await pool.query('DELETE FROM license_history'); } catch (e) { }
        const result = await pool.query('DELETE FROM licenses RETURNING id');

        res.json({ success: true, message: `Удалено ${result.rowCount} лицензий` });
    } catch (error) {
        console.error('Error cleaning up licenses:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/sync
 * Sync license data from local server to Railway cloud.
 * Protected by X-Sync-Secret header.
 */
router.post('/sync', async (req, res) => {
    try {
        const secret = req.headers['x-sync-secret'];
        if (secret !== CLOUD_SYNC_SECRET) {
            return res.status(403).json({ error: 'Invalid sync secret' });
        }

        const {
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices = 3, max_users = 5,
            max_pos_terminals = 1, expires_at, trial_days = 0,
            features = {}, server_type = 'cloud', server_url, server_api_key
        } = req.body;

        if (!license_key || !customer_username) {
            return res.status(400).json({ error: 'license_key and customer_username required' });
        }

        console.log('[SYNC] Receiving license:', license_key, 'for', customer_username);

        // 0. Auto-create tables if they don't exist
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
                code VARCHAR(100) NOT NULL UNIQUE, license_key VARCHAR(255) UNIQUE,
                license_expires_at TIMESTAMP, settings JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
            await pool.query(`CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
                code VARCHAR(100), is_active BOOLEAN DEFAULT true,
                organization_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
            for (const tbl of ['licenses', 'users', 'products']) {
                try { await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS organization_id INTEGER`); } catch(e) {}
            }
        } catch (e) {
            console.log('[SYNC] Table setup:', e.message);
        }

        // 1. Upsert license
        const licResult = await pool.query(`
            INSERT INTO licenses (
                license_key, customer_name, customer_email, customer_phone,
                customer_username, customer_password_hash,
                company_name, license_type, max_devices, max_users,
                max_pos_terminals, expires_at, trial_days, features, status,
                server_type, server_url, server_api_key, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16,$17,true)
            ON CONFLICT (license_key) DO UPDATE SET
                customer_name = EXCLUDED.customer_name,
                customer_username = EXCLUDED.customer_username,
                customer_password_hash = EXCLUDED.customer_password_hash,
                company_name = EXCLUDED.company_name,
                license_type = EXCLUDED.license_type,
                max_devices = EXCLUDED.max_devices,
                max_users = EXCLUDED.max_users,
                expires_at = EXCLUDED.expires_at,
                features = EXCLUDED.features,
                updated_at = NOW()
            RETURNING id`, [
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices, max_users,
            max_pos_terminals, expires_at, trial_days, JSON.stringify(features),
            server_type, server_url, server_api_key
        ]);
        const licenseId = licResult.rows[0].id;

        // 2. Upsert organization
        const orgName = company_name || customer_name || customer_username;
        const orgCode = 'ORG-' + license_key.replace(/-/g, '').substring(0, 8);
        const orgResult = await pool.query(`
            INSERT INTO organizations (name, code, license_key, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (license_key) DO UPDATE SET name = EXCLUDED.name, is_active = true
            RETURNING id`, [orgName, orgCode, license_key]);
        const organizationId = orgResult.rows[0].id;

        // 3. Link license to organization
        try { await pool.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [organizationId, licenseId]); } catch(e) {}

        // 4. Upsert owner user
        await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role,
                               license_id, organization_id, user_type, is_active)
            VALUES ($1, $2, $3, $4, '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440', $5, $6, 'owner', true)
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                organization_id = EXCLUDED.organization_id,
                license_id = EXCLUDED.license_id,
                is_active = true`, [
            customer_username,
            customer_email || customer_username + '@smartpos.local',
            customer_password_hash,
            customer_name || customer_username,
            licenseId, organizationId
        ]);

        // 5. Default warehouse
        await pool.query(`
            INSERT INTO warehouses (name, code, is_active, organization_id)
            VALUES ('\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0441\u043a\u043b\u0430\u0434', $1, true, $2)
            ON CONFLICT DO NOTHING`, ['WH-' + organizationId, organizationId]);

        // 6. Fix orphaned products
        try {
            const fx = await pool.query('UPDATE products SET organization_id = $1 WHERE organization_id IS NULL', [organizationId]);
            if (fx.rowCount > 0) console.log('[SYNC] Fixed', fx.rowCount, 'orphaned products');
        } catch(e) {}

        console.log('[SYNC] Done:', license_key, 'org=' + organizationId, 'user=' + customer_username);
        res.json({ success: true, license_id: licenseId, organization_id: organizationId, message: 'Synced' });
    } catch (error) {
        console.error('[SYNC] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/license/admin-cleanup
 * Admin endpoint to delete products and reinitialize DB tables.
 * Protected by X-Sync-Secret.
 */
router.post('/admin-cleanup', async (req, res) => {
    try {
        const secret = req.headers['x-sync-secret'];
        if (secret !== CLOUD_SYNC_SECRET) {
            return res.status(403).json({ error: 'Invalid sync secret' });
        }

        const { action, license_key } = req.body;
        const results = {};

        if (action === 'delete_products') {
            // Delete all products for a license
            const orgRes = await pool.query('SELECT id FROM organizations WHERE license_key = $1', [license_key]);
            if (orgRes.rows.length > 0) {
                const orgId = orgRes.rows[0].id;
                // Delete related data first
                try { await pool.query('DELETE FROM inventory_movements WHERE organization_id = $1', [orgId]); } catch(e) {}
                try { await pool.query('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = $1)', [orgId]); } catch(e) {}
                try { await pool.query('DELETE FROM sales WHERE organization_id = $1', [orgId]); } catch(e) {}
                const delRes = await pool.query('DELETE FROM products WHERE organization_id = $1', [orgId]);
                results.deleted_products = delRes.rowCount;
                // Also delete orphaned products
                const orphanRes = await pool.query('DELETE FROM products WHERE organization_id IS NULL');
                results.deleted_orphaned = orphanRes.rowCount;
            }
        } else if (action === 'delete_all_products') {
            // Delete ALL products
            try { await pool.query('DELETE FROM inventory_movements'); } catch(e) {}
            try { await pool.query('DELETE FROM sale_items'); } catch(e) {}
            try { await pool.query('DELETE FROM stock_balances'); } catch(e) {}
            const delRes = await pool.query('DELETE FROM products');
            results.deleted_products = delRes.rowCount;
        } else if (action === 'init_tables') {
            // Re-run table initialization
            const { initDatabase } = await import('../config/initDatabase.js');
            await initDatabase(pool);
            results.tables_initialized = true;
        } else if (action === 'check_tables') {
            // Check which tables exist
            const tablesRes = await pool.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            );
            results.tables = tablesRes.rows.map(r => r.table_name);
        } else if (action === 'bulk_migrate') {
            // Bulk migrate data from local DB
            const { tables } = req.body;
            if (!tables || typeof tables !== 'object') {
                return res.status(400).json({ error: 'tables object required' });
            }

            // Ensure all tables exist first
            try {
                const { initDatabase } = await import('../config/initDatabase.js');
                await initDatabase(pool);
            } catch (e) {
                console.log('[MIGRATE] Init warning:', e.message);
            }

            // Disable triggers to avoid FK constraints during migration
            await pool.query('SET session_replication_role = "replica"');

            try {
                for (const [tableName, rows] of Object.entries(tables)) {
                    if (!rows || !Array.isArray(rows) || rows.length === 0) {
                        results[tableName] = { skipped: true, reason: 'empty' };
                        continue;
                    }

                    // Sanitize table name
                    const safeName = tableName.replace(/[^a-z0-9_]/g, '');
                    
                    try {
                        // Check table exists
                        const tableCheck = await pool.query(
                            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
                            [safeName]
                        );
                        if (!tableCheck.rows[0].exists) {
                            results[safeName] = { skipped: true, reason: 'table not found on server' };
                            continue;
                        }

                        // Get remote columns
                        const colsRes = await pool.query(
                            `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
                            [safeName]
                        );
                        const remoteCols = colsRes.rows.map(r => r.column_name);

                        // Delete existing data
                        await pool.query(`DELETE FROM "${safeName}"`);

                        let inserted = 0;
                        let errors = 0;

                        for (const row of rows) {
                            // Only use columns that exist in remote table
                            const rowCols = Object.keys(row).filter(c => remoteCols.includes(c));
                            if (rowCols.length === 0) continue;

                            const colList = rowCols.map(c => `"${c}"`).join(', ');
                            const placeholders = rowCols.map((_, i) => `$${i + 1}`).join(', ');
                            const values = rowCols.map(c => row[c]);

                            try {
                                await pool.query(
                                    `INSERT INTO "${safeName}" (${colList}) VALUES (${placeholders})`,
                                    values
                                );
                                inserted++;
                            } catch (e) {
                                errors++;
                                console.error(`[MIGRATE] Error in ${safeName}:`, e.message);
                            }
                        }

                        // Reset sequence
                        try {
                            const maxId = await pool.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM "${safeName}"`);
                            if (maxId.rows[0].max_id > 0) {
                                await pool.query(
                                    `SELECT setval(pg_get_serial_sequence('"${safeName}"', 'id'), $1, true)`,
                                    [maxId.rows[0].max_id]
                                );
                            }
                        } catch (e) { /* no sequence */ }

                        results[safeName] = { inserted, errors, total: rows.length };
                    } catch (e) {
                        results[safeName] = { error: e.message.substring(0, 100) };
                    }
                }
            } finally {
                // Re-enable triggers
                await pool.query('SET session_replication_role = "origin"');
            }
        } else if (action === 'get_stats') {
            const tables = [
                'organizations', 'licenses', 'users', 'products', 
                'inventory_movements', 'warehouses', 'sales', 'purchases'
            ];
            for (const table of tables) {
                try {
                    const countRes = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
                    results[table] = parseInt(countRes.rows[0].count);
                } catch (e) {
                    results[table] = -1;
                }
            }
        } else if (action === 'get_logs') {
            const logsRes = await pool.query('SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 50');
            results.logs = logsRes.rows;
        } else if (action === 'get_errors') {
            const errRes = await pool.query('SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 50');
            results.errors = errRes.rows;
        } else if (action === 'get_schema') {
            const { table } = req.body;
            if (!table) return res.status(400).json({ error: 'table required' });
            const schemaRes = await pool.query(
                `SELECT column_name, data_type, is_nullable, column_default 
                 FROM information_schema.columns 
                 WHERE table_name = $1`,
                [table]
            );
            results.schema = schemaRes.rows;
        } else if (action === 'list_files') {
            const { path: dirPath } = req.body;
            try {
                const fs = await import('fs');
                const path = await import('path');
                const target = dirPath || process.cwd();
                if (fs.existsSync(target)) {
                    results.files = fs.readdirSync(target);
                    results.cwd = process.cwd();
                    results.exists = true;
                } else {
                    results.exists = false;
                }
            } catch (e) {
                results.error = e.message;
            }
        } else if (action === 'run_sql') {
            const { sql } = req.body;
            if (!sql) return res.status(400).json({ error: 'sql required' });
            try {
                const sqlResult = await pool.query(sql);
                results.rowCount = sqlResult.rowCount;
                results.rows = sqlResult.rows?.slice(0, 50);
                results.success = true;
            } catch (e) {
                results.error = e.message;
                results.success = false;
            }
        }

        console.log('[ADMIN-CLEANUP]', action, results);
        res.json({ success: true, action, results });
    } catch (error) {
        console.error('[ADMIN-CLEANUP] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
