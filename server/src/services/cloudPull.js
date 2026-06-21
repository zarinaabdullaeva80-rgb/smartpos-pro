import fetch from 'node-fetch';
import pool from '../config/database.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const CLOUD_URL = process.env.CLOUD_API_URL || 'https://smartpos-pro-production.up.railway.app/api';
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';

/**
 * Pulls sales from cloud and applies them locally.
 * @param {string} licenseKey 
 * @param {number} localOrgId - LOCAL organization_id (cloud org IDs differ!)
 */
export async function pullSalesFromCloud(licenseKey, localOrgId = null) {
    console.log(`[CLOUD-PULL] Starting sales pull for license: ${licenseKey}, localOrgId: ${localOrgId}`);
    
    try {
        // 1. Fetch unsynced sales from cloud
        const res = await fetch(`${CLOUD_URL}/license/sync-pull-sales`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sync-secret': SYNC_SECRET
            },
            body: JSON.stringify({ license_key: licenseKey, limit: 100 })
        });
        
        const data = await res.json();
        if (!data.success) {
            console.error('[CLOUD-PULL] Cloud error:', data.error);
            return { success: false, error: data.error };
        }
        
        const cloudSales = data.sales || [];
        if (cloudSales.length === 0) {
            console.log('[CLOUD-PULL] No new sales to pull');
            return { success: true, count: 0 };
        }
        
        console.log(`[CLOUD-PULL] Received ${cloudSales.length} sales from cloud`);
        
        let pulled = 0;
        let errors = 0;
        const acknowledgedIds = [];

        for (const cs of cloudSales) {
            const client = await pool.connect();
            const orgId = localOrgId || cs.organization_id; // Use LOCAL org_id
            try {
                await client.query('BEGIN');

                // Find a valid local warehouse for this org
                let warehouseId = cs.warehouse_id;
                const whRes = await client.query(
                    'SELECT id FROM warehouses WHERE organization_id = $1 LIMIT 1', [orgId]
                );
                if (whRes.rows.length > 0) {
                    warehouseId = whRes.rows[0].id;
                } else {
                    // Create default warehouse if none exists
                    const newWh = await client.query(
                        `INSERT INTO warehouses (name, organization_id, is_default) 
                         VALUES ('Основной склад', $1, true) RETURNING id`, [orgId]
                    );
                    warehouseId = newWh.rows[0].id;
                }

                // Check if already exists locally
                const exists = await client.query(
                    'SELECT id FROM sales WHERE document_number = $1 AND organization_id = $2',
                    [cs.document_number, orgId]
                );

                if (exists.rows.length === 0) {
                    // 1. Map products (find local product_id by code)
                    const localItems = [];
                    for (const item of (cs.items || [])) {
                        // Find product by code (which is synced between cloud and local)
                        const pRes = await client.query('SELECT id FROM products WHERE code = $1 AND organization_id = $2', [item.code, orgId]);
                        if (pRes.rows.length > 0) {
                            localItems.push({
                                product_id: pRes.rows[0].id,
                                quantity: item.quantity,
                                price: item.price,
                                total_price: item.total_price
                            });
                        } else {
                            console.warn(`[CLOUD-PULL] Product code=${item.code} not found locally for org=${orgId}`);
                        }
                    }

                    if (localItems.length === 0 && cs.items?.length > 0) {
                        throw new Error(`None of the products in sale ${cs.document_number} exist locally`);
                    }

                    // 2. Insert sale
                    const saleRes = await client.query(
                        `INSERT INTO sales (
                            document_number, document_date, customer_id, warehouse_id,
                            total_amount, final_amount, status, user_id, organization_id, source_device, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        RETURNING id`,
                        [
                            cs.document_number, cs.document_date, cs.customer_id, warehouseId,
                            cs.total_amount, cs.final_amount, 'confirmed', cs.user_id, orgId, 
                            'cloud-mobile', cs.notes || 'Pulled from cloud'
                        ]
                    );
                    const saleId = saleRes.rows[0].id;

                    // 3. Insert items and update stock
                    for (const li of localItems) {
                        await client.query(
                            `INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, organization_id)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [saleId, li.product_id, li.quantity, li.price, li.total_price, orgId]
                        );

                        // Inventory movement
                        await client.query(
                            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, organization_id, notes)
                             VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
                            [li.product_id, warehouseId, 'sale', saleId, li.quantity, orgId, `Cloud sale ${cs.document_number}`]
                        );

                        // Update balance
                        await updateStockBalance(client, li.product_id, warehouseId, -li.quantity);
                    }

                    pulled++;
                } else {
                    console.log(`[CLOUD-PULL] Sale ${cs.document_number} already exists locally`);
                }

                await client.query('COMMIT');
                acknowledgedIds.push(cs.id);
            } catch (e) {
                await client.query('ROLLBACK');
                errors++;
                console.error(`[CLOUD-PULL] Error pulling sale ${cs.document_number}:`, e.message);
            } finally {
                client.release();
            }
        }

        // 2. Acknowledge successful pulls to cloud
        if (acknowledgedIds.length > 0) {
            await fetch(`${CLOUD_URL}/license/sync-ack-sales`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-sync-secret': SYNC_SECRET
                },
                body: JSON.stringify({ license_key: licenseKey, sale_ids: acknowledgedIds })
            });
        }

        console.log(`[CLOUD-PULL] Pull complete: ${pulled} saved, ${errors} errors, ${acknowledgedIds.length} acknowledged`);
        return { success: true, pulled, errors, acknowledged: acknowledgedIds.length };
    } catch (error) {
        console.error('[CLOUD-PULL] Critical failure:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Pulls all licenses from cloud for bidirectional sync.
 */
export async function pullLicensesFromCloud() {
    console.log('[CLOUD-PULL] Starting licenses pull from cloud...');
    
    try {
        const res = await fetch(`${CLOUD_URL}/license/sync-pull-licenses`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sync-secret': SYNC_SECRET
            }
        });
        
        const data = await res.json();
        if (!data.success) {
            console.error('[CLOUD-PULL] Cloud licenses pull error:', data.error);
            return { success: false, error: data.error };
        }
        
        const cloudLicenses = data.licenses || [];
        console.log(`[CLOUD-PULL] Received ${cloudLicenses.length} licenses from cloud`);
        
        let pulled = 0;
        let skipped = 0;
        let errors = 0;

        for (const cl of cloudLicenses) {
            try {
                if (!cl.license_key || !cl.customer_username) {
                    console.warn('[CLOUD-PULL] Skipping invalid license data from cloud:', cl.license_key);
                    skipped++;
                    continue;
                }

                // Check if local license is newer
                const localLic = await pool.query('SELECT updated_at FROM licenses WHERE license_key = $1', [cl.license_key]);
                if (localLic.rows.length > 0) {
                    const localUpdatedAt = localLic.rows[0].updated_at ? new Date(localLic.rows[0].updated_at) : new Date(0);
                    const cloudUpdatedAt = cl.updated_at ? new Date(cl.updated_at) : new Date(0);
                    if (localUpdatedAt >= cloudUpdatedAt) {
                        // Local version is newer or same, skip pulling this license
                        skipped++;
                        continue;
                    }
                }

                // Upsert license, organization, owner user, default warehouse
                const licResult = await pool.query(`
                    INSERT INTO licenses (
                        license_key, customer_name, customer_email, customer_phone,
                        customer_username, customer_password_hash,
                        company_name, license_type, max_devices, max_users,
                        max_pos_terminals, expires_at, trial_days, features, status,
                        server_type, server_url, server_api_key, is_active, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                    ON CONFLICT (license_key) DO UPDATE SET
                        customer_name = EXCLUDED.customer_name,
                        customer_email = EXCLUDED.customer_email,
                        customer_phone = EXCLUDED.customer_phone,
                        customer_username = EXCLUDED.customer_username,
                        customer_password_hash = EXCLUDED.customer_password_hash,
                        company_name = EXCLUDED.company_name,
                        license_type = EXCLUDED.license_type,
                        max_devices = EXCLUDED.max_devices,
                        max_users = EXCLUDED.max_users,
                        max_pos_terminals = EXCLUDED.max_pos_terminals,
                        expires_at = EXCLUDED.expires_at,
                        trial_days = EXCLUDED.trial_days,
                        features = EXCLUDED.features,
                        server_type = EXCLUDED.server_type,
                        server_url = EXCLUDED.server_url,
                        server_api_key = EXCLUDED.server_api_key,
                        status = EXCLUDED.status,
                        is_active = EXCLUDED.is_active,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id`, [
                    cl.license_key, cl.customer_name, cl.customer_email, cl.customer_phone,
                    cl.customer_username, cl.customer_password_hash,
                    cl.company_name, cl.license_type, cl.max_devices || 3, cl.max_users || 5,
                    cl.max_pos_terminals || 1, cl.expires_at, cl.trial_days || 0,
                    typeof cl.features === 'string' ? cl.features : JSON.stringify(cl.features || {}),
                    cl.status || 'active', cl.server_type || 'cloud', cl.server_url, cl.server_api_key,
                    cl.is_active !== undefined ? cl.is_active : true,
                    cl.updated_at || new Date()
                ]);
                const licenseId = licResult.rows[0].id;

                // Upsert organization
                const orgName = cl.company_name || cl.customer_name || cl.customer_username;
                const orgCode = 'ORG-' + cl.license_key.replace(/-/g, '').substring(0, 8);
                const orgResult = await pool.query(`
                    INSERT INTO organizations (name, code, license_key, is_active)
                    VALUES ($1, $2, $3, true)
                    ON CONFLICT (license_key) DO UPDATE SET name = EXCLUDED.name, is_active = true
                    RETURNING id`, [orgName, orgCode, cl.license_key]);
                const organizationId = orgResult.rows[0].id;

                // Link license to organization
                await pool.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [organizationId, licenseId]);

                // Upsert owner user
                await pool.query(`
                    INSERT INTO users (username, email, password_hash, full_name, role,
                                       license_id, organization_id, user_type, is_active)
                    VALUES ($1, $2, $3, $4, '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440', $5, $6, 'owner', true)
                    ON CONFLICT (username) DO UPDATE SET
                        password_hash = EXCLUDED.password_hash,
                        organization_id = EXCLUDED.organization_id,
                        license_id = EXCLUDED.license_id,
                        is_active = true`, [
                    cl.customer_username,
                    cl.customer_email || cl.customer_username + '@smartpos.local',
                    cl.customer_password_hash,
                    cl.customer_name || cl.customer_username,
                    licenseId, organizationId
                ]);

                // Default warehouse
                await pool.query(`
                    INSERT INTO warehouses (name, code, is_active, organization_id)
                    VALUES ('\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u0441\u043a\u043b\u0430\u0434', $1, true, $2)
                    ON CONFLICT DO NOTHING`, ['WH-' + organizationId, organizationId]);

                pulled++;
            } catch (err) {
                errors++;
                console.error(`[CLOUD-PULL] Error saving license ${cl.license_key}:`, err.message);
            }
        }

        console.log(`[CLOUD-PULL] Licenses pull complete: ${pulled} updated/created, ${skipped} skipped, ${errors} errors`);
        return { success: true, pulled, skipped, errors };
    } catch (error) {
        console.error('[CLOUD-PULL] Critical failure in pullLicensesFromCloud:', error.message);
        return { success: false, error: error.message };
    }
}

