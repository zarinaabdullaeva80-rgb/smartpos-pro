import fetch from 'node-fetch';
import pool from '../config/database.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const CLOUD_URL = process.env.CLOUD_API_URL || 'https://smartpos-pro-production.up.railway.app/api';
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';

/**
 * Pulls sales from cloud and applies them locally.
 * @param {string} licenseKey 
 */
export async function pullSalesFromCloud(licenseKey) {
    console.log(`[CLOUD-PULL] Starting sales pull for license: ${licenseKey}`);
    
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
            try {
                await client.query('BEGIN');

                // Check if already exists locally
                const exists = await client.query(
                    'SELECT id FROM sales WHERE document_number = $1 AND organization_id = $2',
                    [cs.document_number, cs.organization_id]
                );

                if (exists.rows.length === 0) {
                    // 1. Map products (find local product_id by code)
                    const localItems = [];
                    for (const item of (cs.items || [])) {
                        // Find product by code (which is synced between cloud and local)
                        const pRes = await client.query('SELECT id FROM products WHERE code = $1 AND organization_id = $2', [item.code, cs.organization_id]);
                        if (pRes.rows.length > 0) {
                            localItems.push({
                                product_id: pRes.rows[0].id,
                                quantity: item.quantity,
                                price: item.price,
                                total_price: item.total_price
                            });
                        } else {
                            console.warn(`[CLOUD-PULL] Product code=${item.code} not found locally for org=${cs.organization_id}`);
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
                            cs.document_number, cs.document_date, cs.customer_id, cs.warehouse_id || 1,
                            cs.total_amount, cs.final_amount, 'confirmed', cs.user_id, cs.organization_id, 
                            'cloud-mobile', cs.notes || 'Pulled from cloud'
                        ]
                    );
                    const saleId = saleRes.rows[0].id;

                    // 3. Insert items and update stock
                    for (const li of localItems) {
                        await client.query(
                            `INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, organization_id)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [saleId, li.product_id, li.quantity, li.price, li.total_price, cs.organization_id]
                        );

                        // Inventory movement
                        await client.query(
                            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, document_id, quantity, organization_id, notes)
                             VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
                            [li.product_id, cs.warehouse_id || 1, 'sale', saleId, li.quantity, cs.organization_id, `Cloud sale ${cs.document_number}`]
                        );

                        // Update balance
                        await updateStockBalance(client, li.product_id, cs.warehouse_id || 1, -li.quantity);
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
