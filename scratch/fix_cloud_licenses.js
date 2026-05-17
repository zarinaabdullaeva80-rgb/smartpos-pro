const pg = require('pg');

// Railway Connection String
const DATABASE_URL = 'postgresql://postgres:Smash2206@proxy.railway.app:5432/railway';

async function fixLicenses() {
    const pool = new pg.Pool({ 
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to Railway DB...');
        const res = await pool.query(`
            UPDATE licenses 
            SET expires_at = '2027-12-31 23:59:59', 
                status = 'active' 
            WHERE status = 'expired' OR expires_at < NOW();
        `);
        
        console.log(`✅ Success! Updated ${res.rowCount} licenses.`);
        
        const current = await pool.query('SELECT license_key, customer_name, expires_at, status FROM licenses');
        console.table(current.rows);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

fixLicenses();
