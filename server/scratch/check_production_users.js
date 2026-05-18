import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://postgres:CdPQsVYKiSijavcdyPWXAPKGlOkDtbQo@mainline.proxy.rlwy.net:44688/railway';
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query("SELECT * FROM users WHERE LOWER(role) IN ('admin', 'администратор')");
        console.log('Production Admin Users:', res.rows);
    } catch (e) {
        console.error('Error querying production DB:', e);
    } finally {
        await pool.end();
    }
}
main();
