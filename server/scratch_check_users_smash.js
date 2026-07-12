import pool from './src/config/database.js';

async function main() {
    try {
        console.log('--- Checking users related to Smash22 ---');
        const res = await pool.query(
            "SELECT id, username, email, role, user_type, license_id, organization_id, is_active FROM users WHERE username ILIKE '%smash%' OR license_id = 12 OR organization_id = 13"
        );
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
