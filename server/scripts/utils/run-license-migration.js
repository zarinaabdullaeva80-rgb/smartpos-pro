// Run migration 008: License Customer Accounts
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206'
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Running migration 008: License Customer Accounts...\n');

        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '008-license-customer-accounts.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await client.query(sql);

        console.log('✅ Migration completed successfully!\n');
        console.log('Added columns to licenses table:');
        console.log('  - customer_username (VARCHAR(100), UNIQUE)');
        console.log('  - customer_password_hash (VARCHAR(255))');
        console.log('  - customer_last_login (TIMESTAMP)');
        console.log('\n📊 Verifying schema...');

        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'licenses'
            AND column_name IN ('customer_username', 'customer_password_hash', 'customer_last_login')
            ORDER BY column_name
        `);

        console.log('\nNew columns:');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name} (${row.data_type})`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
