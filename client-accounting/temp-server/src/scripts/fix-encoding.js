import pool from '../config/database.js';

/**
 * Simple encoding fix - just checks and displays problematic records
 * Run this first to see what needs fixing
 */

async function checkEncoding() {
    const client = await pool.connect();

    try {
        console.log('🔍 Checking for encoding issues...\n');

        // Check products
        const products = await client.query(`
            SELECT id, name, description 
            FROM products 
            WHERE name LIKE '%?%' OR description LIKE '%?%'
            LIMIT 10
        `);

        console.log(`📦 Products with encoding issues: ${products.rowCount}`);
        if (products.rows.length > 0) {
            console.log('Examples:');
            products.rows.forEach(p => {
                console.log(`  ID ${p.id}: ${p.name}`);
            });
        }

        // Since data has encoding issues, let's just ensure proper display
        // The fix is to re-import data or manually correct

        console.log('\n✅ Check complete!');
        console.log('\n💡 Рекомендация: Данные с ???? нужно исправить вручную или переимпортировать');
        console.log('   Система уже настроена на UTF-8, новые данные будут корректными.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkEncoding()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
