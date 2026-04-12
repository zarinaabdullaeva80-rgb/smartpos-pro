import pool from './config/database.js';

async function checkColumns() {
    const tables = ['users', 'products', 'sales', 'purchases', 'counterparties', 'warehouses', 'audit_log', 'licenses', 'organizations'];
    const results = {};

    for (const table of tables) {
        try {
            const res = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);

            results[table] = res.rows.map(r => r.column_name);
        } catch (error) {
            results[table] = { error: error.message };
        }
    }
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}

checkColumns();
