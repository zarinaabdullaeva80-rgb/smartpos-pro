import pool from '../server/src/config/database.js';

async function extendLicenses() {
    try {
        const res = await pool.query(`
            UPDATE licenses 
            SET expires_at = '2027-04-30 23:59:59', 
                status = 'active' 
            WHERE status = 'active' OR status = 'expired'
            RETURNING license_key, customer_name, expires_at
        `);
        
        console.log('--- LICENSES EXTENDED ---');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error extending licenses:', err);
        process.exit(1);
    }
}

extendLicenses();
