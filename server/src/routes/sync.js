import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const router = express.Router();

/**
 * GET /api/sync/status
 * Get synchronization status for mobile device
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        let lastSync = null;
        let pendingChanges = 0;
        const orgId = req.user.organization_id;

        // Поиск последней синхронизации в логах
        try {
            const lastSyncResult = await pool.query(`
                SELECT created_at FROM sync_log 
                WHERE organization_id = $1 AND status = 'success' 
                ORDER BY created_at DESC LIMIT 1
            `, [orgId]);
            lastSync = lastSyncResult.rows[0]?.created_at;
        } catch (e) { /* sync_log might not exist */ }

        // Реальный подсчёт: продажи с мобильного, не синхронизированные
        try {
            const pendingResult = await pool.query(`
                SELECT COUNT(*) AS cnt FROM sales
                WHERE source_device = 'mobile' AND synced_to_desktop IS NOT TRUE
                AND organization_id = $1
            `, [orgId]);
            pendingChanges = parseInt(pendingResult.rows[0].cnt) || 0;
        } catch (e) {
            try {
                const pendingResult2 = await pool.query(`
                    SELECT COUNT(*) AS cnt FROM sales WHERE source_device = 'mobile' AND organization_id = $1
                `, [orgId]);
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
        const orgId = req.user.organization_id;

        const result = await pool.query(`
            SELECT * FROM sync_log 
            WHERE organization_id = $1
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
        `, [orgId, parseInt(limit), parseInt(offset)]);

        res.json({ history: result.rows, total: result.rows.length });
    } catch (error) {
        console.error('Error getting sync history:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * GET /api/sync/settings
 */
router.get('/settings', authenticate, async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const result = await pool.query('SELECT * FROM sync_settings WHERE organization_id = $1 LIMIT 1', [orgId]);
        
        if (result.rows.length === 0) {
            // Create default settings if not exists
            const defaultSettings = await pool.query(
                'INSERT INTO sync_settings (organization_id, auto_sync, sync_interval) VALUES ($1, true, 30) RETURNING *',
                [orgId]
            );
            return res.json({ settings: defaultSettings.rows[0] });
        }
        
        res.json({ settings: result.rows[0] });
    } catch (error) {
        console.error('Error getting sync settings:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * GET /api/sync/products/delta
 */
router.get('/products/delta', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const orgId = req.user.organization_id;

        let query = 'SELECT * FROM products WHERE organization_id = $1 AND is_active = true';
        const params = [orgId];

        if (since) {
            query += ' AND updated_at > $2';
            params.push(since);
        }

        const result = await pool.query(query, params);
        res.json({ products: result.rows });
    } catch (error) {
        console.error('Error getting product delta:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/inventory/delta
 */
router.get('/inventory/delta', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const orgId = req.user.organization_id;

        let query = 'SELECT * FROM inventory_movements WHERE organization_id = $1';
        const params = [orgId];

        if (since) {
            query += ' AND created_at > $2';
            params.push(since);
        }

        const result = await pool.query(query, params);
        res.json({ movements: result.rows });
    } catch (error) {
        console.error('Error getting inventory delta:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/receipts
 */
router.post('/receipts', authenticate, async (req, res) => {
    const { receipts, device_id } = req.body;
    const orgId = req.user.organization_id;

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
                'SELECT id FROM sales WHERE document_number = $1 AND organization_id = $2',
                [receipt.document_number, orgId]
            );

            let saleId;
            if (existing.rows.length === 0) {
                // Создать продажу
                const insertResult = await client.query(`
                    INSERT INTO sales (
                        document_number, total_amount, final_amount, payment_type,
                        status, user_id, shift_id, source_device, organization_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    receipt.document_number,
                    receipt.total_amount || receipt.final_amount,
                    receipt.final_amount,
                    receipt.payment_type || 'cash',
                    'confirmed',
                    receipt.user_id || receipt.cashier_id || req.user.id,
                    receipt.shift_id || null,
                    device_id || 'mobile',
                    orgId,
                    receipt.created_at || new Date()
                ]);
                saleId = insertResult.rows[0].id;

                // Сохранить позиции чека
                const items = receipt.items || receipt.sale_items || [];
                for (const item of items) {
                    await client.query(`
                        INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, discount, organization_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `, [
                        saleId,
                        item.product_id || item.productId,
                        item.quantity,
                        item.price || item.unit_price,
                        item.total_price || item.total || (item.price * item.quantity),
                        item.discount || 0,
                        orgId
                    ]);

                    // Обновить остатки через inventory_movements
                    await client.query(`
                        INSERT INTO inventory_movements (product_id, document_type, quantity, user_id, organization_id, notes, created_at)
                        VALUES ($1, 'sale', -$2, $3, $4, $5, NOW())
                    `, [
                        item.product_id || item.productId,
                        item.quantity,
                        req.user.id,
                        orgId,
                        `Чек ${receipt.document_number}`
                    ]);

                    // Обновить агрегированную таблицу остатков (stock_balance)
                    // Используем склад по умолчанию (id=1) для мобильных продаж, если не указано иное
                    await updateStockBalance(client, item.product_id || item.productId, 1, -item.quantity);
                }

                await client.query('COMMIT');
                synced.push({ id: saleId, document_number: receipt.document_number, items_count: items.length });

                // Socket.IO notification
                if (req.app.get('io')) {
                    req.app.get('io').emit('sale:confirmed', {
                        id: saleId,
                        document_number: receipt.document_number,
                        device_id,
                        amount: receipt.final_amount,
                        organization_id: orgId
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

/**
 * POST /api/sync/bulk-import
 * Массовый импорт товаров, категорий, складов из локальной БД
 * Используется для синхронизации данных на облачный сервер
 */
router.post('/bulk-import', async (req, res) => {
    const syncKey = req.headers['x-sync-key'];
    if (syncKey !== (process.env.SYNC_SECRET_KEY || 'smartpos-sync-key')) {
        return res.status(403).json({ error: 'Invalid sync key' });
    }

    const { categories = [], products = [], stockBalances = [], warehouses = [] } = req.body;
    const stats = { categories: 0, products: 0, warehouses: 0, stockBalances: 0, errors: [] };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Склады
        let whColumns = [];
        try {
            const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouses'`);
            whColumns = res.rows.map(r => r.column_name);
        } catch (e) {}

        for (const wh of warehouses) {
            try {
                await client.query('SAVEPOINT wh_start');
                const cols = ['id', 'name', 'address', 'organization_id', 'created_at'].filter(c => whColumns.includes(c));
                if (whColumns.includes('is_default')) cols.push('is_default');
                
                const vals = cols.map(c => c === 'is_default' ? (wh.is_default || false) : (wh[c] || (c === 'created_at' ? new Date() : null)));
                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const updates = cols.filter(c => c !== 'id').map((c, i) => `${c} = $${i + 1}`).join(', ');

                await client.query(`INSERT INTO warehouses (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`, vals);
                await client.query('RELEASE SAVEPOINT wh_start');
                stats.warehouses++;
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT wh_start');
                stats.errors.push(`warehouse ${wh.id}: ${e.message}`);
            }
        }

        // 2. Категории
        let catColumns = [];
        try {
            const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_categories'`);
            catColumns = res.rows.map(r => r.column_name);
        } catch (e) {}

        for (const cat of categories) {
            try {
                await client.query('SAVEPOINT cat_start');
                const cols = ['id', 'name', 'description', 'parent_id', 'organization_id', 'created_at'].filter(c => catColumns.includes(c));
                const vals = cols.map(c => cat[c] || (c === 'created_at' ? new Date() : null));
                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const updates = cols.filter(c => c !== 'id').map((c, i) => `${c} = $${i + 1}`).join(', ');

                await client.query(`INSERT INTO product_categories (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`, vals);
                await client.query('RELEASE SAVEPOINT cat_start');
                stats.categories++;
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT cat_start');
                stats.errors.push(`category ${cat.id}: ${e.message}`);
            }
        }

        // 3. Товары
        let prodColumns = [];
        try {
            const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`);
            prodColumns = res.rows.map(r => r.column_name);
        } catch (e) {}

        for (const prod of products) {
            try {
                await client.query('SAVEPOINT prod_start');
                
                const possibleCols = ['id', 'name', 'sku', 'barcode', 'price', 'cost_price', 'quantity', 'min_stock', 'category_id', 'unit', 'description', 'is_active', 'organization_id', 'created_at', 'updated_at'];
                const cols = possibleCols.filter(c => prodColumns.includes(c));
                
                const vals = cols.map(c => {
                    if (c === 'is_active') return prod.is_active !== false;
                    if (c === 'created_at' || c === 'updated_at') return prod[c] || new Date();
                    return prod[c] || null;
                });

                const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
                const updates = cols.filter(c => c !== 'id' && c !== 'organization_id' && c !== 'created_at')
                                     .map((c, i) => `${c} = $${cols.indexOf(c) + 1}`).join(', ');

                await client.query(`
                    INSERT INTO products (${cols.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT (id) DO UPDATE SET ${updates}
                `, vals);

                await client.query('RELEASE SAVEPOINT prod_start');
                stats.products++;
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT prod_start');
                stats.errors.push(`product ${prod.id} (${prod.name}): ${e.message}`);
            }
        }

        // 4. Обновить sequence чтобы новые записи не конфликтовали
        try {
            await client.query(`SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1))`);
            await client.query(`SELECT setval('product_categories_id_seq', COALESCE((SELECT MAX(id) FROM product_categories), 1))`);
            await client.query(`SELECT setval('warehouses_id_seq', COALESCE((SELECT MAX(id) FROM warehouses), 1))`);
        } catch (e) { /* sequences may not exist */ }

        await client.query('COMMIT');

        console.log(`[BulkImport] ✅ Synced: ${stats.warehouses} warehouses, ${stats.categories} categories, ${stats.products} products`);

        res.json({
            success: true,
            stats,
            synced_at: new Date().toISOString()
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[BulkImport] ❌ Error:', error.message);
        res.status(500).json({ error: error.message, stats });
    } finally {
        client.release();
    }
});

export default router;
