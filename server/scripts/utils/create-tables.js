import pool from './src/config/database.js';

async function createTables() {
    try {
        console.log('Creating missing tables...');

        // Создать таблицу sale_payment_details
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sale_payment_details (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                payment_method_code VARCHAR(50) NOT NULL DEFAULT 'cash',
                amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ sale_payment_details table created');

        // Создать таблицу inventory_movements если нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                warehouse_id INTEGER DEFAULT 1,
                document_type VARCHAR(50),
                document_id INTEGER,
                quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
                cost_price DECIMAL(15,2) DEFAULT 0,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ inventory_movements table created');

        // Создать таблицу warehouses если нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL DEFAULT 'Основной склад',
                address TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Проверить есть ли хоть один склад
        const wh = await pool.query('SELECT id FROM warehouses LIMIT 1');
        if (wh.rows.length === 0) {
            await pool.query("INSERT INTO warehouses (name) VALUES ('Основной склад')");
            console.log('✓ Default warehouse created');
        }

        console.log('All tables ready!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createTables();
