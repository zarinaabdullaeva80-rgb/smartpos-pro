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
        // Create sale_payment_details table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sale_payment_details (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                payment_method_code VARCHAR(50) NOT NULL,
                amount NUMERIC(15, 2) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ Table sale_payment_details created');

        // Create index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_sale_payment_details_sale_id ON sale_payment_details(sale_id);
        `);
        console.log('✓ Index created');

        console.log('\n=== Database fix complete! ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createTables();
