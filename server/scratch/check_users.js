import pool from '../src/config/database.js';

async function main() {
    try {
        const users = await pool.query('SELECT id, username, email, user_type, license_id, organization_id FROM users');
        console.log('=== USERS ===');
        console.log(users.rows);

        const licenses = await pool.query('SELECT id, license_key, status, expires_at, company_name FROM licenses');
        console.log('=== LICENSES ===');
        console.log(licenses.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
