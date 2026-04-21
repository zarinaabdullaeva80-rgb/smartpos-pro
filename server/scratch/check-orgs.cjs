const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

(async () => {
    try {
        // Check if organizations table exists
        const tables = await p.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema='public' AND table_name LIKE '%org%'
        `);
        console.log('Tables with "org":', tables.rows.map(r => r.table_name));

        // Try organizations table
        try {
            const r = await p.query('SELECT * FROM organizations ORDER BY id');
            console.log('=== Organizations ===');
            r.rows.forEach(r => console.log(JSON.stringify(r)));
        } catch (e) {
            console.log('No organizations table:', e.message);
        }

        // Check what organization_id values exist across tables
        const checkTables = ['products', 'sales', 'inventory_movements', 'warehouses', 'product_categories'];
        for (const t of checkTables) {
            try {
                const r = await p.query(`SELECT organization_id, COUNT(*) as cnt FROM ${t} GROUP BY organization_id ORDER BY cnt DESC`);
                console.log(`\n=== ${t} per org ===`);
                r.rows.forEach(r => console.log(`  org_id=${r.organization_id} count=${r.cnt}`));
            } catch (e) {
                console.log(`${t}: ${e.message}`);
            }
        }

        // Check products columns
        const cols = await p.query(`SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='organization_id'`);
        console.log('\nproducts.organization_id exists:', cols.rows.length > 0);

    } catch (e) {
        console.error(e.message);
    } finally {
        await p.end();
    }
})();
