import pool from '../config/database.js';
import { syncToCloud } from './licenseSync.js';
import { syncAllProductsToCloud, syncCategoriesToCloud } from './productSync.js';
import { syncEmployeeToCloud } from './employeeSync.js';

/**
 * Синхронизирует все активные лицензии, сотрудников, категории и товары с облаком Railway.
 * Запускается при старте сервера и периодически.
 */
export async function syncAllLicensesToCloud() {
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    console.log('[AUTO-SYNC] ═══ Starting full synchronization ═══');
    
    try {
        const result = await pool.query('SELECT * FROM licenses WHERE is_active = true');
        const licenses = result.rows;
        console.log(`[AUTO-SYNC] Found ${licenses.length} active licenses`);
        
        let stats = { licenses: 0, employees: 0, products: 0, categories: 0, errors: 0 };
        
        for (const license of licenses) {
            const licenseKey = license.license_key;
            const orgId = license.organization_id;

            // 1. Sync license itself
            try {
                const res = await syncToCloud(license);
                if (res.success || res.skipped) stats.licenses++;
                else stats.errors++;
            } catch (e) {
                stats.errors++;
                console.error(`[AUTO-SYNC] License ${licenseKey}: ${e.message}`);
            }

            if (!orgId) continue;

            // 2. Sync employees for this org
            try {
                const empRes = await pool.query(
                    'SELECT username, email, password_hash, full_name, phone, role, user_type FROM users WHERE organization_id = $1',
                    [orgId]
                );
                for (const emp of empRes.rows) {
                    try {
                        await syncEmployeeToCloud({
                            ...emp, license_key: licenseKey, organization_id: orgId, action: 'create'
                        });
                        stats.employees++;
                    } catch (e) { stats.errors++; }
                }
            } catch (e) { console.error('[AUTO-SYNC] Employees error:', e.message); }

            // 3. Sync categories
            try {
                const catRes = await pool.query(
                    'SELECT name FROM product_categories WHERE organization_id = $1 OR organization_id IS NULL',
                    [orgId]
                );
                if (catRes.rows.length > 0) {
                    await syncCategoriesToCloud(catRes.rows, licenseKey);
                    stats.categories += catRes.rows.length;
                }
            } catch (e) { console.error('[AUTO-SYNC] Categories error:', e.message); }

            // 4. Sync products (bulk)
            try {
                const prodRes = await pool.query(
                    `SELECT p.code, p.name, p.unit, p.price_purchase, p.price_sale, p.price_retail,
                            p.vat_rate, p.description, p.barcode, p.image_url, p.is_active, p.min_stock, p.supplier,
                            pc.name as category_name,
                            COALESCE((
                              SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                             WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                             ELSE im.quantity END)
                              FROM inventory_movements im WHERE im.product_id = p.id
                            ), 0) AS quantity
                     FROM products p
                     LEFT JOIN product_categories pc ON p.category_id = pc.id
                     WHERE p.organization_id = $1 AND (p.is_active = true OR p.is_active IS NULL)`,
                    [orgId]
                );
                if (prodRes.rows.length > 0) {
                    const syncResult = await syncAllProductsToCloud(prodRes.rows, licenseKey);
                    stats.products += syncResult.synced || 0;
                    if (syncResult.errors) stats.errors += syncResult.errors;
                }
            } catch (e) { console.error('[AUTO-SYNC] Products error:', e.message); }
        }
        
        console.log(`[AUTO-SYNC] ═══ Done: licenses=${stats.licenses} employees=${stats.employees} categories=${stats.categories} products=${stats.products} errors=${stats.errors} ═══`);
        return { success: true, ...stats };
    } catch (error) {
        console.error('[AUTO-SYNC] Failed:', error.message);
        return { success: false, error: error.message };
    }
}
