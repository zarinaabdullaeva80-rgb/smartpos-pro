/**
 * Service for 1C Synchronization
 * Handles real HTTP communication with 1C API
 */

import pool from '../config/database.js';

class Sync1CService {
    async getSettings(organizationId) {
        if (!organizationId) throw new Error('Organization ID is required for sync settings');
        const result = await pool.query('SELECT * FROM sync_settings WHERE organization_id = $1', [organizationId]);
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        return settings;
    }

    async getAuthHeaders(settings) {
        const username = settings['1c_username'] || '';
        const password = settings['1c_password'] || '';
        return {
            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async syncEntity(type, direction, organizationId) {
        if (!organizationId) throw new Error('Organization ID is required for sync');
        const settings = await this.getSettings(organizationId);
        const url = settings['1c_api_url'];

        if (!url) {
            return { success: 0, error: 1, message: '1C API URL not configured' };
        }

        console.log(`[SYNC] [Org ${organizationId}] Starting sync for ${type} in direction ${direction}`);

        try {
            if (direction === 'import' || direction === 'bidirectional') {
                return await this.importEntity(type, settings, organizationId);
            }
            if (direction === 'export') {
                return await this.exportEntity(type, settings, organizationId);
            }
        } catch (error) {
            console.error(`[SYNC] [Org ${organizationId}] Error syncing ${type}:`, error);
            throw error;
        }
    }

    async importEntity(type, settings, organizationId) {
        const baseUrl = settings['1c_api_url'];
        const endpoint = `${baseUrl}/import/${type}`;
        const headers = await this.getAuthHeaders(settings);

        try {
            const response = await fetch(endpoint, { headers });
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const data = await response.json();
            const items = data[type] || data.data || [];

            if (type === 'products') return await this.processProducts(items, organizationId);
            if (type === 'categories') return await this.processCategories(items, organizationId);

            return {
                success: items.length,
                error: 0,
                message: `Downloaded ${items.length} items for ${type} (processing not implemented)`
            };
        } catch (error) {
            console.error(`[SYNC] [Org ${organizationId}] Import error for ${type}:`, error);
            return { success: 0, error: 1, message: error.message };
        }
    }

    async processProducts(products, organizationId) {
        const client = await pool.connect();
        let success = 0, errors = 0;
        try {
            await client.query('BEGIN');
            for (const product of products) {
                try {
                    const { external_id, name, barcode, article, unit, price, cost_price } = product;

                    const existing = await client.query(
                        `SELECT p.id FROM products p
                         JOIN external_id_mapping eim ON eim.internal_id = p.id
                         WHERE eim.entity_type = 'products' AND eim.external_id = $1 AND eim.external_system = '1C'
                         AND eim.organization_id = $2`,
                        [external_id, organizationId]
                    );

                    if (existing.rows.length > 0) {
                        await client.query(
                            `UPDATE products SET name = $1, barcode = $2, code = $3, unit = $4, price_sale = $5, price_purchase = $6, updated_at = NOW() 
                             WHERE id = $7 AND organization_id = $8`,
                            [name, barcode, article, unit, price, cost_price, existing.rows[0].id, organizationId]
                        );
                    } else {
                        const res = await client.query(
                            `INSERT INTO products (name, barcode, code, unit, price_sale, price_purchase, is_active, organization_id) 
                             VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
                            [name, barcode, article, unit, price, cost_price, organizationId]
                        );
                        await client.query(
                            `INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id) 
                             VALUES ('products', $1, $2, '1C', $3)`,
                            [res.rows[0].id, external_id, organizationId]
                        );
                    }
                    success++;
                } catch (e) {
                    errors++;
                }
            }
            await client.query('COMMIT');
            return { success, error: errors, message: `Processed ${success} products` };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async processCategories(categories, organizationId) {
        const client = await pool.connect();
        let success = 0, errors = 0;
        try {
            await client.query('BEGIN');
            for (const cat of categories) {
                try {
                    const { external_id, name, description } = cat;
                    const existing = await client.query(
                        `SELECT internal_id FROM external_id_mapping 
                         WHERE entity_type = 'categories' AND external_id = $1 AND external_system = '1C'
                         AND organization_id = $2`,
                        [external_id, organizationId]
                    );

                    if (existing.rows.length > 0) {
                        await client.query(
                            `UPDATE product_categories SET name = $1, description = $2, updated_at = NOW() 
                             WHERE id = $3 AND organization_id = $4`,
                            [name, description || '', existing.rows[0].internal_id, organizationId]
                        );
                    } else {
                        const res = await client.query(
                            `INSERT INTO product_categories (name, description, organization_id) 
                             VALUES ($1, $2, $3) RETURNING id`,
                            [name, description || '', organizationId]
                        );
                        await client.query(
                            `INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id) 
                             VALUES ('categories', $1, $2, '1C', $3)`,
                            [res.rows[0].id, external_id, organizationId]
                        );
                    }
                    success++;
                } catch (e) {
                    errors++;
                }
            }
            await client.query('COMMIT');
            return { success, error: errors, message: `Processed ${success} categories` };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async exportEntity(type, settings, organizationId) {
        // Implementation for exporting data to 1C
        return { success: 0, error: 0, message: 'Export logic not yet implemented' };
    }
}

const sync1cService = new Sync1CService();
export default sync1cService;
