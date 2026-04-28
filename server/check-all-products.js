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
        console.log('--- ALL PRODUCTS ---');
        const res = await pool.query('SELECT id, name, barcode, code, organization_id, is_active, created_at FROM products ORDER BY id DESC');
        console.log(`Total count: ${res.rows.length}`);
        res.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log('\n--- DUPLICATE CHECK ---');
        const dups = await pool.query('SELECT name, COUNT(*) FROM products GROUP BY name HAVING COUNT(*) > 1');
        console.log('Duplicates by name:', dups.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
