import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function check() {
    const res = await pool.query("SELECT username, organization_id FROM users WHERE username = 'Nematullo1'");
    console.log('Local User:', res.rows);
    
    const res2 = await pool.query("SELECT id, name, license_key FROM organizations");
    console.log('Local Organizations:', res2.rows);
    
    const res3 = await pool.query("SELECT COUNT(*) FROM products");
    console.log('Local Products Total:', res3.rows[0].count);
    
    await pool.end();
}
check();
