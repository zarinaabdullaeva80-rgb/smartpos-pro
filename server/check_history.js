import pool from './src/config/database.js';

async function checkHistory() {
    try {
        const res = await pool.query("SELECT * FROM license_history WHERE details::text LIKE '%B5F3-87E6-20F4-7B7A%' OR license_id = 12 ORDER BY created_at DESC");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
checkHistory();
