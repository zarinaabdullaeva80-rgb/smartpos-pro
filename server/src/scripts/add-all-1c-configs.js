// Script to add all 1C configurations to the database
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
    const migrationPath = path.join(__dirname, '../../../database/migrations/003-all-1c-configurations.sql');

    try {
        console.log('📖 Reading 1C configurations migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('⚙️  Adding all 1C configurations...');
        await client.query(sql);

        console.log('\n✅ All 1C configurations added successfully!\n');

        // Verify migration
        const result = await client.query(`
            SELECT 
                c.category,
                COUNT(c.id) as config_count,
                SUM((SELECT COUNT(*) FROM configuration_modules WHERE configuration_id = c.id)) as total_modules
            FROM configurations c
            GROUP BY c.category
            ORDER BY c.category
        `);

        console.log('📊 Configuration Summary:');
        console.log('━'.repeat(60));
        result.rows.forEach(row => {
            console.log(`${row.category.padEnd(35)} ${row.config_count} конфигураций, ${row.total_modules} модулей`);
        });
        console.log('━'.repeat(60));

        // Get total count
        const totalResult = await client.query(`
            SELECT COUNT(*) as total FROM configurations
        `);
        console.log(`\n📦 Всего конфигураций: ${totalResult.rows[0].total}\n`);

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
