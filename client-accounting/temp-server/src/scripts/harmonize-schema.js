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

async function harmonizeSchema() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();

        console.log('⚙️  Harmonizing "products" table schema...');

        // Rename purchase_price to price_purchase if it exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='purchase_price') THEN
                    ALTER TABLE products RENAME COLUMN purchase_price TO price_purchase;
                END IF;
            END $$;
        `);

        // Rename sale_price to price_sale if it exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price') THEN
                    ALTER TABLE products RENAME COLUMN sale_price TO price_sale;
                END IF;
            END $$;
        `);

        // Add missing columns
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS price_retail DECIMAL(15, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS vat_rate INTEGER DEFAULT 20,
            ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
            ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);

        // Ensure category_id exists (already added, but just in case)
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES product_categories(id);
        `);

        console.log('\n✅ Database schema harmonized successfully!\n');

        client.release();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Harmonization failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

harmonizeSchema();
