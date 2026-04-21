import pool from './config/database.js';

async function migrate() {
    const tables = ['inventory_movements', 'sale_items', 'purchase_items', 'sale_payment_details', 'payments'];

    for (const table of tables) {
        try {
            console.log(`Checking table: ${table}...`);
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS license_id INTEGER REFERENCES licenses(id)`);
            console.log(`✓ Column license_id added to ${table}`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_${table}_license_id ON ${table}(license_id)`);
            console.log(`✓ Index created for ${table}`);
        } catch (error) {
            console.error(`❌ Error migrating table ${table}:`, error.message);
        }
    }
    process.exit(0);
}

migrate();
