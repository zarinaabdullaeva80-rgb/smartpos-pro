import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

(async () => {
    try {
        const res = await pool.query('SELECT * FROM organizations LIMIT 1');
        console.log('Org:', JSON.stringify(res.rows[0]));
        
        const lic = await pool.query('SELECT * FROM licenses LIMIT 1');
        console.log('Lic:', JSON.stringify(lic.rows[0]));
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
})();
