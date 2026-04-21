/**
 * Quick migration runner for 054-fix-users-missing-columns.sql
 * Run with: DATABASE_URL=<url> node run-054-migration.mjs
 * Or: node run-054-migration.mjs (uses .env)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from server dir
try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(__dirname, '.env') });
} catch (e) {
    console.log('No dotenv, using process.env directly');
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    console.log('Usage: $env:DATABASE_URL="postgresql://..."; node run-054-migration.mjs');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const migrationPath = path.join(__dirname, '../../database/migrations/054-fix-users-missing-columns.sql');

try {
    console.log('📖 Reading migration file...');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔌 Connecting to database...');
    const client = await pool.connect();

    console.log('🚀 Running migration 054...');
    await client.query(sql);

    console.log('✅ Migration 054 completed successfully!');

    // Verify
    const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('license_id', 'user_level', 'user_type', 'created_by_license_id')
        ORDER BY column_name
    `);
    console.log('✅ Verified columns added:', result.rows.map(r => r.column_name).join(', '));

    client.release();
    await pool.end();
    process.exit(0);
} catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
}
