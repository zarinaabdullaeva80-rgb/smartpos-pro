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

async function addCategoryColumn() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('⚙️  Adding category_id column...');
        await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES product_categories(id)');

        console.log('📊 Creating index...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');

        console.log('\n✅ category_id column added successfully!\n');

        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

addCategoryColumn();
