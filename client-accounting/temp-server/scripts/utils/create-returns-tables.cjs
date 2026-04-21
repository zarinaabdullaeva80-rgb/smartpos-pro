const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206',
    port: 5432
});

async function createTables() {
    try {
        // Create returns table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS returns (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id),
                document_number VARCHAR(100) NOT NULL,
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
                reason TEXT,
                status VARCHAR(50) DEFAULT 'confirmed',
                user_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ Table returns created');

        // Create return_items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_items (
                id SERIAL PRIMARY KEY,
                return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
                sale_item_id INTEGER,
                product_id INTEGER NOT NULL,
                quantity NUMERIC(15, 3) NOT NULL,
                price NUMERIC(15, 2) NOT NULL,
                total NUMERIC(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ Table return_items created');

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id);
            CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
        `);
        console.log('✓ Indexes created');

        console.log('\n=== Database fix complete! ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createTables();
