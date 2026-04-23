import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function check() {
    const res = await pool.query("SELECT COUNT(*) FROM products WHERE organization_id = 3");
    console.log('Local Products for Org 3:', res.rows[0].count);
    await pool.end();
}
check();
