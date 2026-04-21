// Migration script for adding universal configuration
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
    const migrationPath = path.join(__dirname, '../../../database/migrations/002-universal-configuration.sql');

    try {
        console.log('Reading universal configuration migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Adding universal configuration...');
        await client.query(sql);

        console.log('✓ Universal configuration added successfully!');

        // Verify migration
        const result = await client.query(`
            SELECT c.name, COUNT(cm.id) as module_count 
            FROM configurations c
            LEFT JOIN configuration_modules cm ON c.id = cm.configuration_id
            WHERE c.code = 'universal-full'
            GROUP BY c.id, c.name
        `);

        if (result.rows.length > 0) {
            console.log(`✓ Configuration: ${result.rows[0].name}`);
            console.log(`✓ Total modules: ${result.rows[0].module_count}`);
        }

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
