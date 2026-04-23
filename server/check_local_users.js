import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function check() {
    const res = await pool.query("SELECT id, username, organization_id FROM users");
    console.log('Local Users:', res.rows);
    await pool.end();
}
check();
