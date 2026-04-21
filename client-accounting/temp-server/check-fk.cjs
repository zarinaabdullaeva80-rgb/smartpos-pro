const pool = require('./src/config/database');
(async () => {
    try {
        const r = await pool.query(`
            SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'products'
        `);
        console.log('FK constraints referencing products:');
        r.rows.forEach(row => console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table}`));
        
        // Also check stock_balances
        const sb = await pool.query(`SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_name = 'stock_balances'`);
        console.log('\nstock_balances table exists:', sb.rows[0].cnt > 0);
        
        // Check all tables with product_id column
        const pc = await pool.query(`
            SELECT table_name, column_name FROM information_schema.columns 
            WHERE column_name = 'product_id' ORDER BY table_name
        `);
        console.log('\nTables with product_id column:');
        pc.rows.forEach(row => console.log(`  ${row.table_name}`));

        // Try deleting a test product to see the error
        const testProduct = await pool.query(`SELECT id, name FROM products LIMIT 1`);
        if (testProduct.rows.length > 0) {
            console.log(`\nTest product: id=${testProduct.rows[0].id} name="${testProduct.rows[0].name}"`);
            try {
                await pool.query('BEGIN');
                await pool.query(`DELETE FROM products WHERE id = $1`, [testProduct.rows[0].id]);
                await pool.query('ROLLBACK'); // Don't actually delete
                console.log('Direct DELETE would SUCCEED');
            } catch(e) {
                await pool.query('ROLLBACK');
                console.log('Direct DELETE would FAIL:', e.message);
                // Extract the constraint/table name from error
                console.log('Detail:', e.detail);
                console.log('Table:', e.table);
                console.log('Constraint:', e.constraint);
            }
        }
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
})();
