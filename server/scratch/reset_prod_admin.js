import pg from 'pg';
import bcrypt from 'bcrypt';
const { Pool } = pg;

const connectionString = 'postgresql://postgres:CdPQsVYKiSijavcdyPWXAPKGlOkDtbQo@mainline.proxy.rlwy.net:44688/railway';
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const password = 'admin123';
        const hash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password_hash = $1 WHERE username = 'admin'", [hash]);
        console.log('✅ Production admin password successfully updated to admin123!');
    } catch (e) {
        console.error('Error updating production DB admin:', e);
    } finally {
        await pool.end();
    }
}
main();
