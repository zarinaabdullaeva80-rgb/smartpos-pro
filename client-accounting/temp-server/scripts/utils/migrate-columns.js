import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function migrate() {
    try {
        console.log('Checking and adding missing columns to products table...');

        // Add missing columns if they don't exist
        const columns = [
            { name: 'price_purchase', type: 'DECIMAL(15, 2) DEFAULT 0' },
            { name: 'price_sale', type: 'DECIMAL(15, 2) DEFAULT 0' },
            { name: 'price_retail', type: 'DECIMAL(15, 2) DEFAULT 0' },
            { name: 'vat_rate', type: 'INTEGER DEFAULT 20' },
            { name: 'barcode', type: 'VARCHAR(100)' },
            { name: 'image_url', type: 'TEXT' },
            { name: 'license_id', type: 'INTEGER' }
        ];

        for (const col of columns) {
            try {
                await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`✅ Column ${col.name} added/exists`);
            } catch (e) {
                if (e.code === '42701') {
                    console.log(`⚠️ Column ${col.name} already exists`);
                } else {
                    console.error(`❌ Error adding ${col.name}:`, e.message);
                }
            }
        }

        // Also add missing columns to users table
        const userColumns = [
            { name: 'license_id', type: 'INTEGER' },
            { name: 'role', type: 'VARCHAR(50)' }
        ];

        for (const col of userColumns) {
            try {
                await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`✅ Users column ${col.name} added/exists`);
            } catch (e) {
                if (e.code === '42701') {
                    console.log(`⚠️ Users column ${col.name} already exists`);
                } else {
                    console.error(`❌ Error adding ${col.name} to users:`, e.message);
                }
            }
        }

        // Add missing columns to error_logs table
        const errorLogColumns = [
            { name: 'license_id', type: 'INTEGER' }
        ];

        for (const col of errorLogColumns) {
            try {
                await pool.query(`ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                console.log(`✅ Error_logs column ${col.name} added/exists`);
            } catch (e) {
                console.error(`❌ Error adding ${col.name} to error_logs:`, e.message);
            }
        }

        console.log('\n✅ Migration completed!');
    } catch (e) {
        console.error('Migration error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();
