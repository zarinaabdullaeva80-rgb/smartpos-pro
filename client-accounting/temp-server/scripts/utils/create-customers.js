import pool from './src/config/database.js';

async function createCustomersTable() {
    console.log('Creating customers table...');

    const client = await pool.connect();
    try {
        // Создать таблицу customers если не существует
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                email VARCHAR(255),
                discount DECIMAL(5,2) DEFAULT 0,
                loyalty_points INTEGER DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table customers created/verified');

        // Добавить тестовых клиентов если таблица пустая
        const countResult = await client.query('SELECT COUNT(*) FROM customers');
        if (parseInt(countResult.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO customers (name, phone, email, discount, loyalty_points, notes)
                VALUES 
                    ('Иван Иванов', '+998901234567', 'ivan@example.com', 5, 150, 'VIP клиент'),
                    ('Мария Петрова', '+998909876543', 'maria@example.com', 10, 500, 'Постоянный покупатель'),
                    ('Алексей Сидоров', '+998901112233', NULL, 0, 50, NULL)
            `);
            console.log('✅ Added 3 test customers');
        } else {
            console.log(`ℹ️ Table customers already has ${countResult.rows[0].count} records`);
        }

        console.log('Done!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

createCustomersTable();
