// Delete demo products without license_id
import pool from './src/config/database.js';

async function cleanupDemoProducts() {
    try {
        console.log('🔍 Checking for demo products (without license_id)...\n');

        // Count demo products
        const countResult = await pool.query(
            'SELECT COUNT(*) as count FROM products WHERE license_id IS NULL'
        );
        const demoCount = parseInt(countResult.rows[0].count);

        if (demoCount === 0) {
            console.log('✅ No demo products found! Database is clean.');
            process.exit(0);
        }

        console.log(`Found ${demoCount} demo products without license_id.`);

        // List demo products before deletion
        const demoProducts = await pool.query(
            'SELECT id, code, name FROM products WHERE license_id IS NULL ORDER BY id'
        );
        console.log('\n📦 Demo products to be deleted:');
        demoProducts.rows.forEach(p => {
            console.log(`  - [${p.code || 'no-code'}] ${p.name}`);
        });

        // First, delete related return_items (linked to sale_items)
        console.log('\n🔗 Deleting related return_items...');
        const deleteReturnItems = await pool.query(`
            DELETE FROM return_items 
            WHERE sale_item_id IN (
                SELECT si.id FROM sale_items si 
                JOIN products p ON si.product_id = p.id 
                WHERE p.license_id IS NULL
            )
            RETURNING id
        `);
        console.log(`   Deleted ${deleteReturnItems.rowCount} return_items records.`);

        // Then, delete related sale_items
        console.log('\n🔗 Deleting related sale_items...');
        const deleteSaleItems = await pool.query(`
            DELETE FROM sale_items 
            WHERE product_id IN (SELECT id FROM products WHERE license_id IS NULL)
            RETURNING id
        `);
        console.log(`   Deleted ${deleteSaleItems.rowCount} sale_items records.`);

        // Delete demo products
        console.log('\n🗑️ Deleting demo products...');
        const deleteResult = await pool.query(
            'DELETE FROM products WHERE license_id IS NULL RETURNING id'
        );

        console.log(`\n✅ Successfully deleted ${deleteResult.rowCount} demo products!`);
        console.log('📊 Now each license holder will see only their own products.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

cleanupDemoProducts();
