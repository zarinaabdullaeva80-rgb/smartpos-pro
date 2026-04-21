const pool = require('./src/config/database');
(async () => {
    try {
        console.log('--- Inspecting Remaining Products ---');
        const res = await pool.query('SELECT id, code, name, organization_id, is_active FROM products LIMIT 50');
        console.log(`Found ${res.rows.length} products in table.`);
        res.rows.forEach(p => {
            console.log(`ID: ${p.id} | Code: ${p.code} | Name: ${p.name} | Org: ${p.organization_id} | Active: ${p.is_active}`);
        });

        if (res.rows.length > 0) {
            const firstId = res.rows[0].id;
            console.log(`\n--- Checking Dependencies for ID ${firstId} ---`);
            const tables = [
                'inventory_movements', 'sale_items', 'purchase_items', 'return_items',
                'inventory_items', 'inventory_adjustments', 'inventory_check_items',
                'stock_balances', 'stock_movements', 'warehouse_document_items'
            ];
            for (const table of tables) {
                try {
                    const countRes = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE product_id = $1`, [firstId]);
                    console.log(`  ${table}: ${countRes.rows[0].count} records`);
                } catch (e) {
                    console.log(`  ${table}: Table error or missing`);
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
})();
