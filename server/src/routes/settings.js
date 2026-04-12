import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Получение всех системных настроек
router.get('/', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        let query = 'SELECT * FROM system_settings';
        const params = [];
        if (userLicenseId) {
            query += ' WHERE license_id = $1';
            params.push(userLicenseId);
        }
        query += ' ORDER BY setting_key';
        const result = await pool.query(query, params);

        // Преобразовать в объект для удобства
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = {
                value: row.setting_value,
                description: row.description,
                updated_at: row.updated_at
            };
        });

        res.json({ settings });
    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получение конкретной настройки
router.get('/:key', authenticate, async (req, res) => {
    try {
        const { key } = req.params;

        const userLicenseId = req.user.license_id;
        let query = 'SELECT * FROM system_settings WHERE setting_key = $1';
        const params = [key];
        if (userLicenseId) {
            query += ' AND license_id = $2';
            params.push(userLicenseId);
        }
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Обновление настройки
router.put('/:key', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        const userLicenseId = req.user.license_id;
        let query = `UPDATE system_settings 
             SET setting_value = $1, description = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = $4`;
        const params = [value, description, req.user.id, key];
        if (userLicenseId) {
            query += ' AND license_id = $5';
            params.push(userLicenseId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Настройка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Создание новой настройки
router.post('/', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { key, value, description } = req.body;

        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `INSERT INTO system_settings (setting_key, setting_value, description, updated_by, license_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [key, value, description, req.user.id, userLicenseId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Duplicate key
            return res.status(400).json({ error: 'Настройка с таким ключом уже существует' });
        }
        console.error('Ошибка создания настройки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Convenient endpoints for specific settings groups

// Налоги и НДС
router.get('/taxes/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['taxes', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Настройки налогов не найдены' });
        }

        res.json(result.rows[0].setting_value);
    } catch (error) {
        console.error('Ошибка получения настроек налогов:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

router.put('/taxes/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { vat_rates, default_vat, tax_period } = req.body;

        const newValue = { vat_rates, default_vat, tax_period };

        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `UPDATE system_settings 
             SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = 'taxes' AND license_id = $3 RETURNING *`,
            [newValue, req.user.id, userLicenseId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления настроек налогов:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Синхронизация
router.get('/sync/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['sync', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Настройки синхронизации не найдены' });
        }

        res.json(result.rows[0].setting_value);
    } catch (error) {
        console.error('Ошибка получения настроек синхронизации:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

router.put('/sync/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { auto_sync, sync_interval, conflict_resolution } = req.body;

        const newValue = { auto_sync, sync_interval, conflict_resolution };

        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `UPDATE system_settings 
             SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = 'sync' AND license_id = $3 RETURNING *`,
            [newValue, req.user.id, userLicenseId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления настроек синхронизации:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Email уведомления
router.get('/notifications/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['notifications', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Настройки уведомлений не найдены' });
        }

        // Скрыть пароль SMTP
        const config = result.rows[0].setting_value;
        if (config.smtp_password) {
            config.smtp_password = '******';
        }

        res.json(config);
    } catch (error) {
        console.error('Ошибка получения настроек уведомлений:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

router.put('/notifications/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { email_enabled, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, smtp_secure } = req.body;

        const newValue = {
            email_enabled,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_password,
            smtp_from,
            smtp_secure: smtp_secure !== undefined ? smtp_secure : true
        };

        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `UPDATE system_settings 
             SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = 'notifications' AND license_id = $3 RETURNING *`,
            [newValue, req.user.id, userLicenseId]
        );

        // Скрыть пароль в ответе
        const response = result.rows[0];
        if (response.setting_value.smtp_password) {
            response.setting_value.smtp_password = '******';
        }

        res.json(response);
    } catch (error) {
        console.error('Ошибка обновления настроек уведомлений:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Системные настройки (компания, валюта, часовой пояс)
router.get('/system/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['system', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Системные настройки не найдены' });
        }

        res.json(result.rows[0].setting_value);
    } catch (error) {
        console.error('Ошибка получения системных настроек:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

router.put('/system/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { company_name, currency, timezone, logo_url } = req.body;

        const newValue = { company_name, currency, timezone, logo_url };

        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            `UPDATE system_settings 
             SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE setting_key = 'system' AND license_id = $3 RETURNING *`,
            [newValue, req.user.id, userLicenseId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления системных настроек:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// ==========================================
// TELEGRAM BOT - Per-Organization Configuration
// ==========================================

// Get Telegram settings for organization
router.get('/telegram/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['telegram', userLicenseId]
        );

        if (result.rows.length === 0) {
            // Return default/empty config
            return res.json({
                enabled: false,
                bot_token: '',
                chat_id: '',
                notifications: {
                    sales: true,
                    low_stock: true,
                    errors: true,
                    daily_report: false
                }
            });
        }

        // Hide bot token for security
        const config = { ...result.rows[0].setting_value };
        if (config.bot_token) {
            config.bot_token = config.bot_token.slice(0, 10) + '***';
        }

        res.json(config);
    } catch (error) {
        console.error('Ошибка получения настроек Telegram:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Update Telegram settings for organization
router.put('/telegram/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { enabled, bot_token, chat_id, notifications } = req.body;
        const userLicenseId = req.user.license_id;

        const newValue = {
            enabled: enabled || false,
            bot_token: bot_token || '',
            chat_id: chat_id || '',
            notifications: notifications || {
                sales: true,
                low_stock: true,
                errors: true,
                daily_report: false
            },
            updated_at: new Date().toISOString()
        };

        // Upsert - insert or update
        const result = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, license_id, updated_by)
            VALUES ('telegram', $1, $2, $3)
            ON CONFLICT (setting_key, license_id) 
            DO UPDATE SET setting_value = $1, updated_by = $3, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [newValue, userLicenseId, req.user.id]);

        res.json({
            success: true,
            message: 'Настройки Telegram обновлены',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления настроек Telegram:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Test Telegram connection
router.post('/telegram/test', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['telegram', userLicenseId]
        );

        if (result.rows.length === 0 || !result.rows[0].setting_value.bot_token) {
            return res.status(400).json({ error: 'Telegram бот не настроен' });
        }

        const config = result.rows[0].setting_value;

        // Send test message via Telegram API
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.chat_id,
                text: `✅ Тест подключения из 1С Бухгалтерия\n\n🏢 Организация: ${req.user.license_id}\n📅 ${new Date().toLocaleString('ru-RU')}`,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();

        if (data.ok) {
            res.json({ success: true, message: 'Тестовое сообщение отправлено!' });
        } else {
            res.status(400).json({ error: 'Ошибка отправки', details: data.description });
        }
    } catch (error) {
        console.error('Ошибка тестирования Telegram:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// ==========================================
// 1C SYNCHRONIZATION - Per-Organization Configuration
// ==========================================

// Get 1C sync settings
router.get('/1c/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['1c_sync', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.json({
                enabled: false,
                api_url: '',
                username: '',
                sync_interval: 15,
                sync_products: true,
                sync_sales: true,
                sync_purchases: true,
                sync_counterparties: true,
                last_sync: null
            });
        }

        // Hide password
        const config = { ...result.rows[0].setting_value };
        if (config.password) {
            config.password = '******';
        }

        res.json(config);
    } catch (error) {
        console.error('Ошибка получения настроек 1C:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Update 1C sync settings
router.put('/1c/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const {
            enabled, api_url, username, password, sync_interval,
            sync_products, sync_sales, sync_purchases, sync_counterparties
        } = req.body;
        const userLicenseId = req.user.license_id;

        const newValue = {
            enabled: enabled || false,
            api_url: api_url || '',
            username: username || '',
            password: password || '',
            sync_interval: sync_interval || 15,
            sync_products: sync_products !== false,
            sync_sales: sync_sales !== false,
            sync_purchases: sync_purchases !== false,
            sync_counterparties: sync_counterparties !== false,
            updated_at: new Date().toISOString()
        };

        const result = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, license_id, updated_by)
            VALUES ('1c_sync', $1, $2, $3)
            ON CONFLICT (setting_key, license_id) 
            DO UPDATE SET setting_value = $1, updated_by = $3, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [newValue, userLicenseId, req.user.id]);

        res.json({
            success: true,
            message: 'Настройки синхронизации с 1C обновлены',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления настроек 1C:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Test 1C connection
router.post('/1c/test', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['1c_sync', userLicenseId]
        );

        if (result.rows.length === 0 || !result.rows[0].setting_value.api_url) {
            return res.status(400).json({ error: '1C интеграция не настроена' });
        }

        const config = result.rows[0].setting_value;

        const fetch = (await import('node-fetch')).default;
        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

        const response = await fetch(`${config.api_url}/ping`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.ok) {
            res.json({ success: true, message: 'Подключение к 1C успешно!' });
        } else {
            res.status(400).json({ error: 'Ошибка подключения', status: response.status });
        }
    } catch (error) {
        console.error('Ошибка тестирования 1C:', error);
        res.status(500).json({ error: 'Не удалось подключиться к 1C', details: error.message });
    }
});
// ==========================================
// RECEIPT SETTINGS - Настройки чеков
// ==========================================

// Get receipt settings
router.get('/receipt/config', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['receipt', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.json({
                paper_width: 80,
                header_enabled: true,
                header_logo: true,
                header_company_name: '',
                header_address: '',
                header_phone: '',
                header_inn: '',
                header_website: '',
                header_org_type: 'ООО',
                body_show_sku: true,
                body_show_barcode: false,
                body_show_discount: true,
                body_show_tax: true,
                body_font_size: 'medium',
                footer_enabled: true,
                footer_text: 'Спасибо за покупку!',
                footer_show_datetime: true,
                footer_show_cashier: true,
                footer_show_receipt_number: true,
                footer_qr_enabled: true,
                footer_qr_type: 'fiscal',
                kkm_serial: '',
                copies: 1,
                auto_print: true,
                auto_open_drawer: true,
                cut_paper: true,
                beep_on_print: true
            });
        }

        res.json(result.rows[0].setting_value);
    } catch (error) {
        console.error('Ошибка получения настроек чека:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Update receipt settings
router.put('/receipt/config', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const settings = req.body;
        settings.updated_at = new Date().toISOString();

        const result = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, license_id, updated_by)
            VALUES ('receipt', $1, $2, $3)
            ON CONFLICT (setting_key, license_id) 
            DO UPDATE SET setting_value = $1, updated_by = $3, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [settings, userLicenseId, req.user.id]);

        res.json({
            success: true,
            message: 'Настройки чека сохранены',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления настроек чека:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// ==========================================
// STORE LOCATIONS - Торговые точки
// ==========================================

// Get all store locations
router.get('/stores', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['stores', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.json({ stores: [] });
        }

        res.json(result.rows[0].setting_value);
    } catch (error) {
        console.error('Ошибка получения торговых точек:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Save store locations
router.put('/stores', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
        const { stores } = req.body;

        // Validate stores array
        if (!Array.isArray(stores)) {
            return res.status(400).json({ error: 'stores должен быть массивом' });
        }

        const data = {
            stores: stores.map((store, idx) => ({
                id: store.id || `store_${Date.now()}_${idx}`,
                name: store.name || `Точка ${idx + 1}`,
                address: store.address || '',
                phone: store.phone || '',
                is_default: store.is_default || false,
                kkm_serial: store.kkm_serial || '',
                inn: store.inn || '',
                org_type: store.org_type || 'ООО',
                website: store.website || '',
                created_at: store.created_at || new Date().toISOString()
            })),
            updated_at: new Date().toISOString()
        };

        const result = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, license_id, updated_by)
            VALUES ('stores', $1, $2, $3)
            ON CONFLICT (setting_key, license_id) 
            DO UPDATE SET setting_value = $1, updated_by = $3, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [data, userLicenseId, req.user.id]);

        res.json({
            success: true,
            message: 'Торговые точки сохранены',
            data: result.rows[0].setting_value
        });
    } catch (error) {
        console.error('Ошибка сохранения торговых точек:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Get single store by ID
router.get('/stores/:storeId', authenticate, async (req, res) => {
    try {
        const { storeId } = req.params;
        const userLicenseId = req.user.license_id;

        const result = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['stores', userLicenseId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Торговая точка не найдена' });
        }

        const stores = result.rows[0].setting_value.stores || [];
        const store = stores.find(s => s.id === storeId);

        if (!store) {
            return res.status(404).json({ error: 'Торговая точка не найдена' });
        }

        res.json(store);
    } catch (error) {
        console.error('Ошибка получения торговой точки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Get receipt settings for specific store (merged with defaults)
router.get('/stores/:storeId/receipt', authenticate, async (req, res) => {
    try {
        const { storeId } = req.params;
        const userLicenseId = req.user.license_id;

        // Get base receipt settings
        const receiptResult = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['receipt', userLicenseId]
        );

        // Get store info
        const storesResult = await pool.query(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 AND license_id = $2',
            ['stores', userLicenseId]
        );

        const baseSettings = receiptResult.rows[0]?.setting_value || {};
        const stores = storesResult.rows[0]?.setting_value?.stores || [];
        const store = stores.find(s => s.id === storeId);

        if (!store) {
            return res.status(404).json({ error: 'Торговая точка не найдена' });
        }

        // Merge store info into receipt settings
        const mergedSettings = {
            ...baseSettings,
            header_company_name: store.name || baseSettings.header_company_name,
            header_address: store.address || baseSettings.header_address,
            header_phone: store.phone || baseSettings.header_phone,
            header_inn: store.inn || baseSettings.header_inn,
            header_website: store.website || baseSettings.header_website,
            header_org_type: store.org_type || baseSettings.header_org_type,
            kkm_serial: store.kkm_serial || baseSettings.kkm_serial,
            store_id: storeId,
            store_name: store.name
        };

        res.json(mergedSettings);
    } catch (error) {
        console.error('Ошибка получения настроек чека для точки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

export default router;
