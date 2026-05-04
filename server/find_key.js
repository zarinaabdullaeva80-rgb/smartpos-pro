import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
});

(async () => {
    try {
        const res = await pool.query('SELECT license_key FROM organizations WHERE organization_id = 14 OR id = 14 LIMIT 1');
        console.log('Local Org License Key:', res.rows[0]?.license_key);
        
        const lic = await pool.query('SELECT license_key FROM licenses LIMIT 1');
        console.log('Any Local License Key:', lic.rows[0]?.license_key);
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
})();
