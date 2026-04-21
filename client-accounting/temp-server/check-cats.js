import pool from './src/config/database.js';

async function check() {
    try {
        // Check constraints
        const r = await pool.query(
            `SELECT conname, pg_get_constraintdef(c.oid) as def 
             FROM pg_constraint c 
             JOIN pg_class t ON c.conrelid = t.oid 
             WHERE t.relname = 'product_categories'`
        );
        console.log('Constraints on product_categories:');
        r.rows.forEach(x => console.log(' ', x.conname, ':', x.def));

        // Check indexes
        const r2 = await pool.query(
            `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'product_categories'`
        );
        console.log('\nIndexes:');
        r2.rows.forEach(x => console.log(' ', x.indexname, ':', x.indexdef));

        // Check existing categories
        const r3 = await pool.query('SELECT id, name, organization_id FROM product_categories LIMIT 10');
        console.log('\nExisting categories:');
        r3.rows.forEach(x => console.log(' ', x.id, x.name, 'org:', x.organization_id));

        // Try what the import does
        console.log('\nTesting ON CONFLICT (name):');
        try {
            await pool.query(
                `INSERT INTO product_categories (name, organization_id) VALUES ($1, $2) 
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
                ['TestCategory123', null]
            );
            console.log('  OK - ON CONFLICT works');
        } catch (e) {
            console.error('  FAIL:', e.message);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

check();
