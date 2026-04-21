import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_1c',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function inspectTable() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('🔍 Inspecting products table columns...');
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products'
            ORDER BY ordinal_position;
        `);

        console.log('\nActual columns in "products" table:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        console.log('\n🔍 Checking if product_categories table exists...');
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'product_categories'
            );
        `);
        console.log(`product_categories exists: ${tableCheck.rows[0].exists}`);

        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Inspection failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

inspectTable();
