// Script to create product_categories table
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
    const migrationPath = path.join(__dirname, '../../../database/migrations/004-add-product-categories.sql');

    try {
        console.log('📖 Reading product categories migration...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('⚙️  Creating product_categories table...');
        await client.query(sql);

        console.log('\n✅ Product categories table created successfully!\n');

        // Verify
        const result = await client.query(`
            SELECT COUNT(*) as count FROM product_categories
        `);
        console.log(`📦 Total categories: ${result.rows[0].count}\n`);

        client.release();
        await pool.end();

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
