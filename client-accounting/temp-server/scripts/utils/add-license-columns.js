import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function addLicenseId() {
    const tables = [
        'sales',
        'purchases',
        'bank_accounts',
        'counterparties',
        'warehouses',
        'products'
    ];

    console.log('Adding license_id columns to tables...\n');

    for (const table of tables) {
        try {
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS license_id INTEGER`);
            console.log(`✅ ${table}: license_id column added/exists`);
        } catch (e) {
            console.error(`❌ ${table}: ${e.message}`);
        }
    }

    // Also add customer_id to sales table if missing
    try {
        await pool.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
        console.log(`✅ sales: customer_id column added/exists`);
    } catch (e) {
        console.error(`❌ sales.customer_id: ${e.message}`);
    }

    console.log('\n✅ Migration completed!');
    await pool.end();
    process.exit(0);
}

addLicenseId();
