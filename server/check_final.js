import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function check() {
    const res = await pool.query("SELECT organization_id, COUNT(*) FROM products GROUP BY organization_id");
    console.log('Local Products per Org:', res.rows);
    await pool.end();
}
check();
