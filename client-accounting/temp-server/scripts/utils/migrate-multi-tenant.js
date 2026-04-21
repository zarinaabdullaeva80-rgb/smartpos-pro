// Migration: Add license_id to products for multi-tenant data isolation
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Starting migration: Multi-tenant product isolation...');

        // 1. Add license_id column to products table
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS license_id INTEGER REFERENCES licenses(id)
        `);
        console.log('✓ Added license_id column to products');

        // 2. Add license_id to sales table
        await client.query(`
            ALTER TABLE sales 
            ADD COLUMN IF NOT EXISTS license_id INTEGER REFERENCES licenses(id)
        `);
        console.log('✓ Added license_id column to sales');

        // 3. Add license_id to product_categories table
        await client.query(`
            ALTER TABLE product_categories 
            ADD COLUMN IF NOT EXISTS license_id INTEGER REFERENCES licenses(id)
        `);
        console.log('✓ Added license_id column to product_categories');

        // 4. Create index for faster queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_products_license_id ON products(license_id);
        `);
        console.log('✓ Created index on products.license_id');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_license_id ON sales(license_id);
        `);
        console.log('✓ Created index on sales.license_id');

        console.log('Migration completed successfully!');
        console.log('Note: Existing products belong to super_admin (license_id = NULL).');
        console.log('New products created by license holders will have their license_id set.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
