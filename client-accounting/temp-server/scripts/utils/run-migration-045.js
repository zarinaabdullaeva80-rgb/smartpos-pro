// Run migration to add missing license columns
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206'
});

async function runMigration() {
    try {
        console.log('🔄 Running migration 045: Add missing license columns...\n');

        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '045-add-missing-license-columns.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Migration completed successfully!\n');

        // Verify columns
        console.log('Verifying columns after migration...');
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'licenses'
            AND column_name IN ('customer_name', 'customer_email', 'customer_phone', 'max_devices', 'status')
        `);

        console.log('Verified columns:', result.rows.map(r => r.column_name).join(', '));

    } catch (error) {
        console.error('❌ Migration error:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
