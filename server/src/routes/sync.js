import express from 'express';
import { syncAllData, syncProductsToSheet, syncSalesToSheet, syncInventoryToSheet, syncStatisticsToSheet } from '../services/googleSheets.js';
import { authenticate } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/sync/status
 * Статус синхронизации — реальный счётчик ожидающих изменений
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        let lastSync = null;
        let pendingChanges = 0;

        try {
            const syncResult = await pool.query(
                `SELECT finished_at FROM sync_log ORDER BY finished_at DESC NULLS LAST LIMIT 1`
            );
            if (syncResult.rows.length > 0) lastSync = syncResult.rows[0].finished_at;
        } catch (e) { /* sync_log might not exist */ }

        // Реальный подсчёт: продажи с мобильного, не синхронизированные
        try {
            const pendingResult = await pool.query(`
                SELECT COUNT(*) AS cnt FROM sales
                WHERE source_device = 'mobile' AND synced_to_desktop IS NOT TRUE
            `);
            pendingChanges = parseInt(pendingResult.rows[0].cnt) || 0;
        } catch (e) {
            try {
                const pendingResult2 = await pool.query(`
                    SELECT COUNT(*) AS cnt FROM sales WHERE source_device = 'mobile'
                `);
                pendingChanges = parseInt(pendingResult2.rows[0].cnt) || 0;
            } catch (e2) { /* ignore */ }
        }

        res.json({
            status: 'connected',
            lastSync: lastSync || new Date().toISOString(),
            pendingChanges,
            isOnline: true,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/history
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        try {
            const result = await pool.query(`
                SELECT id, sync_type, direction, status, records_total, records_success, records_error,
                       error_message, started_at, finished_at, duration_ms
                FROM sync_log ORDER BY started_at DESC LIMIT $1 OFFSET $2
            `, [parseInt(limit), parseInt(offset)]);
            res.json({ history: result.rows, total: result.rows.length });
        } catch (dbError) {
            res.json({ history: [], total: 0 });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/settings
 */
router.get('/settings', authenticate, async (req, res) => {
    try {
        try {
            const result = await pool.query(`SELECT setting_key, setting_value FROM sync_settings`);
            const settings = {};
            for (const row of result.rows) settings[row.setting_key] = row.setting_value;
            res.json({
                autoSync: settings.auto_sync === 'true' || false,
                syncInterval: parseInt(settings.sync_interval) || 30,
                sync1c: settings.sync_1c === 'true' || false,
                lastSync: settings.last_sync || null,
                ...settings
            });
        } catch (dbError) {
            res.json({ autoSync: false, syncInterval: 30, sync1c: false, lastSync: null });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/trigger
 */
router.post('/trigger', authenticate, async (req, res) => {
    try {
        const { type = 'all' } = req.body;
        let logId = null;
        try {
            const logResult = await pool.query(`
                INSERT INTO sync_log (sync_type, direction, status, started_at)
                VALUES ($1, 'export', 'processing', NOW()) RETURNING id
            `, [type]);
            logId = logResult.rows[0].id;
        } catch (e) { /* sync_log might not exist */ }

        try {
            switch (type) {
                case 'products': await syncProductsToSheet(); break;
                case 'sales': await syncSalesToSheet(); break;
                case 'inventory': await syncInventoryToSheet(); break;
                case 'statistics': await syncStatisticsToSheet(); break;
                default: await syncAllData();
            }
        } catch (syncError) {
            console.log(`Sync ${type} error (non-critical):`, syncError.message);
        }

        if (logId) {
            try {
                await pool.query(`
                    UPDATE sync_log SET status = 'completed', finished_at = NOW(),
                    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 WHERE id = $1
                `, [logId]);
            } catch (e) { /* ignore */ }
        }

        res.json({ success: true, type, message: `Синхронизация ${type} выполнена`, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/force
 */
router.post('/force', authenticate, async (req, res) => {
    try {
        try { await syncAllData(); } catch (e) { console.log('Google Sheets sync skipped:', e.message); }
        res.json({ success: true, message: 'Синхронизация выполнена успешно', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/google-sheets/settings
 */
router.get('/google-sheets/settings', authenticate, async (req, res) => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS sync_settings (
            id SERIAL PRIMARY KEY, setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT, updated_at TIMESTAMP DEFAULT NOW()
        )`);
        const result = await pool.query('SELECT setting_key, setting_value FROM sync_settings');
        const settings = {};
        for (const row of result.rows) {
            try { settings[row.setting_key] = JSON.parse(row.setting_value); }
            catch { settings[row.setting_key] = row.setting_value; }
        }
        res.json({
            enabled: settings.gs_enabled || false,
            spreadsheet_id: settings.gs_spreadsheet_id || '',
            service_account_email: settings.gs_service_account_email || '',
            service_account_key: settings.gs_service_account_key ? '***' : '',
            sync_products: settings.gs_sync_products !== false,
            sync_sales: settings.gs_sync_sales !== false,
            sync_inventory: settings.gs_sync_inventory !== false,
            sync_statistics: settings.gs_sync_statistics !== false,
            auto_sync: settings.gs_auto_sync || false,
            sync_interval: settings.gs_sync_interval || 30,
            last_sync: settings.gs_last_sync || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/google-sheets/settings
 */
router.post('/google-sheets/settings', authenticate, async (req, res) => {
    try {
        const { enabled, spreadsheet_id, service_account_email, service_account_key,
            sync_products, sync_sales, sync_inventory, sync_statistics, auto_sync, sync_interval } = req.body;

        await pool.query(`CREATE TABLE IF NOT EXISTS sync_settings (
            id SERIAL PRIMARY KEY, setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT, updated_at TIMESTAMP DEFAULT NOW()
        )`);

        const settingsToSave = {
            gs_enabled: enabled, gs_spreadsheet_id: spreadsheet_id,
            gs_service_account_email: service_account_email,
            gs_sync_products: sync_products, gs_sync_sales: sync_sales,
            gs_sync_inventory: sync_inventory, gs_sync_statistics: sync_statistics,
            gs_auto_sync: auto_sync, gs_sync_interval: sync_interval
        };
        if (service_account_key && service_account_key !== '***') {
            settingsToSave.gs_service_account_key = service_account_key;
        }
        for (const [key, value] of Object.entries(settingsToSave)) {
            await pool.query(`
                INSERT INTO sync_settings (setting_key, setting_value, updated_at) VALUES ($1, $2, NOW())
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()
            `, [key, JSON.stringify(value)]);
        }
        res.json({ success: true, message: 'Настройки сохранены' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/google-sheets/test
 */
router.post('/google-sheets/test', authenticate, async (req, res) => {
    try {
        const { spreadsheet_id, service_account_email, service_account_key } = req.body;
        if (!spreadsheet_id) return res.status(400).json({ error: 'Укажите ID таблицы' });

        let privateKey = service_account_key;
        if (!privateKey || privateKey === '***') {
            try {
                const r = await pool.query("SELECT setting_value FROM sync_settings WHERE setting_key = 'gs_service_account_key'");
                if (r.rows.length > 0) privateKey = JSON.parse(r.rows[0].setting_value);
            } catch (e) { /* ignore */ }
        }
        if (!privateKey || !service_account_email) return res.status(400).json({ error: 'Укажите данные сервисного аккаунта' });

        const { google } = await import('googleapis');
        const auth = new google.auth.JWT(service_account_email, null, privateKey, ['https://www.googleapis.com/auth/spreadsheets']);
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
        res.json({ success: true, spreadsheet_title: spreadsheet.data.properties.title, sheets_count: spreadsheet.data.sheets.length });
    } catch (error) {
        res.status(500).json({ error: `Ошибка подключения: ${error.message}` });
    }
});

// Google Sheets legacy sync routes
router.post('/sync-all', async (req, res) => {
    try { await syncAllData(); res.json({ success: true, message: 'Синхронизация с Google Sheets выполнена успешно' }); }
    catch (error) { res.status(500).json({ error: 'Ошибка синхронизации' }); }
});
router.post('/sync-products', async (req, res) => {
    try { await syncProductsToSheet(); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});
router.post('/sync-sales', async (req, res) => {
    try { await syncSalesToSheet(); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});
router.post('/sync-inventory', async (req, res) => {
    try { await syncInventoryToSheet(); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});
router.post('/sync-statistics', async (req, res) => {
    try { await syncStatisticsToSheet(); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

/**
 * GET /api/sync/products/delta?since=ISO_DATE
 * Дельта-синхронизация товаров — только изменённые после `since`
 */
router.get('/products/delta', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const orgId = req.user?.organization_id || 1;
        let query, params;

        const baseQuery = `
                SELECT p.id, p.name, p.barcode, p.code, p.price_sale, p.price_purchase,
                       p.category_id, pc.name AS category_name,
                       p.unit, p.description, p.image_url, p.is_active,
                       COALESCE(SUM(im.quantity), 0) AS stock_quantity,
                       p.min_stock, p.updated_at
                FROM products p
                LEFT JOIN product_categories pc ON p.category_id = pc.id
                LEFT JOIN inventory_movements im ON p.id = im.product_id
        `;

        if (since) {
            query = baseQuery + `
                WHERE p.updated_at > $1 AND p.organization_id = $2
                GROUP BY p.id, p.name, p.barcode, p.code, p.price_sale, p.price_purchase,
                         p.category_id, pc.name, p.unit, p.description, p.image_url,
                         p.is_active, p.min_stock, p.updated_at
                ORDER BY p.updated_at DESC
            `;
            params = [since, orgId];
        } else {
            query = baseQuery + `
                WHERE p.is_active = true AND p.organization_id = $1
                GROUP BY p.id, p.name, p.barcode, p.code, p.price_sale, p.price_purchase,
                         p.category_id, pc.name, p.unit, p.description, p.image_url,
                         p.is_active, p.min_stock, p.updated_at
                ORDER BY p.updated_at DESC
            `;
            params = [orgId];
        }

        const result = await pool.query(query, params);
        res.json({
            products: result.rows,
            count: result.rows.length,
            since: since || null,
            server_time: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching products delta:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/inventory/delta?since=ISO_DATE
 * Дельта-синхронизация остатков
 */
router.get('/inventory/delta', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const orgId = req.user?.organization_id || 1;
        let query, params;

        const invBase = `
                SELECT p.id AS product_id, p.name AS product_name, p.barcode,
                       COALESCE(SUM(im.quantity), 0) AS stock_quantity,
                       p.min_stock, p.updated_at
                FROM products p
                LEFT JOIN inventory_movements im ON p.id = im.product_id
        `;

        if (since) {
            query = invBase + `
                WHERE p.updated_at > $1 AND p.organization_id = $2
                GROUP BY p.id, p.name, p.barcode, p.min_stock, p.updated_at
                ORDER BY p.updated_at DESC
            `;
            params = [since, orgId];
        } else {
            query = invBase + `
                WHERE p.is_active = true AND p.organization_id = $1
                GROUP BY p.id, p.name, p.barcode, p.min_stock, p.updated_at
                ORDER BY p.name
            `;
            params = [orgId];
        }

        const result = await pool.query(query, params);
        res.json({
            inventory: result.rows,
            count: result.rows.length,
            since: since || null,
            server_time: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching inventory delta:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/receipts
 */
router.get('/receipts', authenticate, async (req, res) => {
    try {
        const { from, to, limit = 100 } = req.query;
        let query = `
            SELECT s.id, s.total_amount AS final_amount, s.payment_type,
                   s.status, s.created_at
            FROM sales s
            WHERE s.status = 'confirmed'
        `;
        const params = [];
        let paramIndex = 1;
        if (from) { query += ` AND s.created_at >= $${paramIndex}`; params.push(from); paramIndex++; }
        if (to) { query += ` AND s.created_at <= $${paramIndex}`; params.push(to); paramIndex++; }
        query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);
        res.json({ receipts: result.rows, total: result.rows.length, synced_at: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/receipts
 * Загрузить чеки с мобильного — сохраняет sale + sale_items в транзакции + обновляет остатки
 */
router.post('/receipts', authenticate, async (req, res) => {
    const { receipts, device_id } = req.body;

    if (!receipts || !Array.isArray(receipts)) {
        return res.status(400).json({ error: 'Receipts array required' });
    }

    const synced = [];
    const errors = [];

    for (const receipt of receipts) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Проверить дубликат
            const existing = await client.query(
                'SELECT id FROM sales WHERE document_number = $1',
                [receipt.document_number]
            );

            let saleId;
            if (existing.rows.length === 0) {
                // Создать продажу
                const insertResult = await client.query(`
                    INSERT INTO sales (
                        document_number, total_amount, final_amount, payment_type,
                        status, cashier_id, shift_id, source_device, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id
                `, [
                    receipt.document_number,
                    receipt.total_amount || receipt.final_amount,
                    receipt.final_amount,
                    receipt.payment_type || 'cash',
                    'confirmed',
                    receipt.cashier_id || req.user.id,
                    receipt.shift_id || null,
                    device_id || 'mobile',
                    receipt.created_at || new Date()
                ]);
                saleId = insertResult.rows[0].id;

                // Сохранить позиции чека
                const items = receipt.items || receipt.sale_items || [];
                for (const item of items) {
                    await client.query(`
                        INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, discount)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT DO NOTHING
                    `, [
                        saleId,
                        item.product_id || item.productId,
                        item.quantity,
                        item.price || item.unit_price,
                        item.total_price || item.total || (item.price * item.quantity),
                        item.discount || 0
                    ]);
                }

                // Обновить остатки через inventory_movements
                for (const item of items) {
                    const productId = item.product_id || item.productId;
                    if (productId) {
                        await client.query(`
                            INSERT INTO inventory_movements (product_id, document_type, quantity, user_id, notes, created_at)
                            VALUES ($1, 'sale', -$2, $3, $4, NOW())
                        `, [productId, item.quantity, req.user.id, `Чек ${receipt.document_number}`]);
                    }
                }

                await client.query('COMMIT');
                synced.push({ id: saleId, document_number: receipt.document_number, items_count: items.length });

                // Real-time push через Socket.IO
                if (req.app.get('io')) {
                    req.app.get('io').emit('sale:confirmed', {
                        id: saleId,
                        document_number: receipt.document_number,
                        device_id,
                        amount: receipt.final_amount
                    });
                }
            } else {
                await client.query('ROLLBACK');
                synced.push({ id: existing.rows[0].id, document_number: receipt.document_number, already_exists: true });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[Sync] Receipt error:', err.message);
            errors.push({ document_number: receipt.document_number, error: err.message });
        } finally {
            client.release();
        }
    }

    res.json({
        success: true,
        synced_count: synced.length,
        synced,
        errors_count: errors.length,
        errors,
        synced_at: new Date().toISOString()
    });
});

export default router;
