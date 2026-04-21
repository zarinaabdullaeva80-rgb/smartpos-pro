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
        // Create inventory_movements table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                warehouse_id INTEGER,
                document_type VARCHAR(50) NOT NULL,
                document_id INTEGER,
                quantity NUMERIC(15, 3) NOT NULL,
                cost_price NUMERIC(15, 2),
                user_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ Table inventory_movements created');

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_document ON inventory_movements(document_type, document_id);
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
