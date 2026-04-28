import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Smash2206',
});

async function check() {
    try {
        console.log('--- PRODUCTS ---');
        const products = await pool.query('SELECT id, name, barcode, code, organization_id, is_active FROM products');
        console.log(`Total products: ${products.rows.length}`);
        products.rows.slice(0, 5).forEach(r => console.log(JSON.stringify(r)));

        console.log('\n--- IMPORT LOGS ---');
        const logs = await pool.query('SELECT * FROM import_logs ORDER BY created_at DESC LIMIT 5');
        logs.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log('\n--- ORGANIZATIONS / LICENSES ---');
        const orgs = await pool.query('SELECT id, name, license_key FROM organizations LIMIT 5');
        orgs.rows.forEach(r => console.log(JSON.stringify(r)));
        
        console.log('\n--- USERS ---');
        const users = await pool.query('SELECT id, username, organization_id FROM users');
        users.rows.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
