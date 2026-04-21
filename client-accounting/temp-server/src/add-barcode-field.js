import pool from './config/database.js';

async function addBarcodeField() {
    try {
        console.log('Подключение к базе данных...');

        // Проверить есть ли поле barcode
        const checkResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'barcode'
        `);

        if (checkResult.rows.length > 0) {
            console.log('✓ Поле barcode уже существует');
        } else {
            console.log('Добавление поля barcode...');
            await pool.query(`
                ALTER TABLE products 
                ADD COLUMN barcode VARCHAR(100)
            `);
            console.log('✅ Поле barcode добавлено');

            // Создать индекс для быстрого поиска
            await pool.query(`
                CREATE INDEX idx_products_barcode ON products(barcode)
            `);
            console.log('✅ Индекс создан');
        }

        console.log('✅ Миграция завершена успешно!');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await pool.end();
        process.exit(1);
    }
}

addBarcodeField();
