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

async function runRepair() {
    const repairPath = path.join(__dirname, '../../../database/repair_schema.sql');

    try {
        console.log('📖 Reading repair script...');
        const sql = fs.readFileSync(repairPath, 'utf8');

        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('⚙️  Executing repair script...');
        const result = await client.query(sql);

        console.log('\n✅ Database schema repaired successfully!');

        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Repair failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

runRepair();
