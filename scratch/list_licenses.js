import pool from '../server/src/config/database.js';

async function listLicenses() {
    try {
        console.log('--- ACTIVE LICENSES ---');
        const res = await pool.query(`
            SELECT license_key, customer_name, status, expires_at 
            FROM licenses 
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (res.rows.length === 0) {
            console.log('No active licenses found.');
        } else {
            console.table(res.rows);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error fetching licenses:', err);
        process.exit(1);
    }
}

listLicenses();
