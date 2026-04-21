import pool from './config/database.js';

async function createShiftsTable() {
    try {
        console.log('Создание таблицы shifts...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP,
                opening_cash DECIMAL(10,2) DEFAULT 0,
                closing_cash DECIMAL(10,2),
                total_sales DECIMAL(10,2) DEFAULT 0,
                sales_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'open',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Таблица shifts создана');

        console.log('Добавление поля image_url...');
        await pool.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT
        `);

        console.log('✅ Поле image_url добавлено');
        console.log('✅ Миграция завершена успешно!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка миграции:', error.message);
        process.exit(1);
    }
}

createShiftsTable();
