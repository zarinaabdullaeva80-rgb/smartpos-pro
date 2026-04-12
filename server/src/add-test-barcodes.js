import pool from './config/database.js';

async function addTestBarcodes() {
    try {
        console.log('Добавление тестовых штрихкодов...');

        // Обновить существующие товары
        const updates = [
            { id: 1, barcode: '1234567890123' },
            { id: 2, barcode: '2345678901234' },
            { id: 3, barcode: '3456789012345' }
        ];

        for (const { id, barcode } of updates) {
            await pool.query(
                'UPDATE products SET barcode = $1 WHERE id = $2',
                [barcode, id]
            );
            console.log(`✓ Товар ID ${id}: штрихкод ${barcode}`);
        }

        console.log('✅ Тестовые штрихкоды добавлены!');
        console.log('\nТеперь вы можете протестировать поиск:');
        console.log('- Откройте Products в мобильном');
        console.log('- Введите: 1234567890123');
        console.log('- Товар добавится в корзину!');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await pool.end();
        process.exit(1);
    }
}

addTestBarcodes();
