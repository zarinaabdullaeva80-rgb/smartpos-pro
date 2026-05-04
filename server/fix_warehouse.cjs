const pg = require('pg');
async function fix() {
    const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });
    const wh = await pool.query('SELECT id FROM warehouses WHERE organization_id = 13');
    if (wh.rows.length === 0) {
        const r = await pool.query("INSERT INTO warehouses (name, code, organization_id, is_active) VALUES ('Основной склад', 'WH-13', 13, true) RETURNING id");
        console.log('Created warehouse:', r.rows[0]);
    } else {
        console.log('Warehouse exists:', wh.rows[0]);
    }
    await pool.end();
}
fix().catch(e => console.error(e));
