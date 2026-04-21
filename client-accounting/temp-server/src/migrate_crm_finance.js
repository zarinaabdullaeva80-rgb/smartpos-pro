import pool from './config/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the project root (one level up from src)
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    const tables = [
        'bank_accounts',
        'transactions',
        'deals',
        'deal_stages',
        'deal_activities',
        'customer_loyalty',
        'loyalty_tiers',
        'loyalty_transactions',
        'email_campaigns',
        'email_recipients',
        'email_templates',
        'customers',
        'invoices',
        'invoice_items',
        'returns',
        'return_items',
        'system_settings',
        'notifications',
        'inventories',
        'inventory_items',
        'inventory_adjustments',
        'product_batches',
        'warehouse_locations',
        'venue_map',
        'warehouse_map',
        'generated_documents',
        'organization_details',
        'roles',
        'user_roles',
        'role_permissions'
    ];

    console.log('Starting CRM & Finance multi-tenant migration...');

    for (const table of tables) {
        try {
            // Check if table exists
            const tableCheck = await pool.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                [table]
            );

            if (!tableCheck.rows[0].exists) {
                console.log(`Table ${table} does not exist, skipping...`);
                continue;
            }

            // Check if column exists
            const columnCheck = await pool.query(
                "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = $1 AND column_name = 'license_id')",
                [table]
            );

            if (!columnCheck.rows[0].exists) {
                console.log(`Adding license_id to ${table}...`);
                await pool.query(`ALTER TABLE ${table} ADD COLUMN license_id INTEGER REFERENCES licenses(id)`);
                await pool.query(`CREATE INDEX idx_${table}_license ON ${table}(license_id)`);
                console.log(`Successfully added license_id to ${table}`);
            } else {
                console.log(`Table ${table} already has license_id`);
            }
        } catch (err) {
            console.error(`Error migrating table ${table}:`, err.message);
        }
    }

    console.log('Migration finished.');
    process.exit(0);
}

migrate();
