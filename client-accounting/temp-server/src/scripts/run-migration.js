// Migration script to run SQL migrations from Node.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_1c',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function runMigration() {
    const migrationPath = path.join(__dirname, '../../../database/migrations/001-configurations.sql');

    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Running migration...');
        await client.query(sql);

        console.log('✓ Migration completed successfully!');

        // Verify migration
        const result = await client.query('SELECT COUNT(*) FROM configurations');
        console.log(`✓ Found ${result.rows[0].count} configurations in database`);

        client.release();
        await pool.end();

        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
