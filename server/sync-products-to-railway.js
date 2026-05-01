/**
 * Скрипт синхронизации товаров с Railway
 * Экспортирует все товары и категории из локальной БД на облачный сервер
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const RAILWAY_URL = 'https://smartpos-pro-production-f885.up.railway.app/api';

// Локальная БД
const localPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function syncProducts() {
    console.log('🔄 Начинаю синхронизацию товаров с Railway...\n');
    
    try {
        // 1. Получить все категории
        const categories = await localPool.query('SELECT * FROM product_categories ORDER BY id');
        console.log(`📦 Категорий: ${categories.rows.length}`);
        
        // 2. Получить все товары
        const products = await localPool.query('SELECT * FROM products ORDER BY id');
        console.log(`📦 Товаров: ${products.rows.length}`);
        
        // 3. Получить остатки
        let stockBalances = { rows: [] };
        try {
            stockBalances = await localPool.query('SELECT * FROM stock_balances');
            console.log(`📦 Остатков: ${stockBalances.rows.length}`);
        } catch (e) {
            console.log('⚠ Таблица stock_balances не найдена, пропускаем');
        }

        // 4. Получить склады
        const warehouses = await localPool.query('SELECT * FROM warehouses ORDER BY id');
        console.log(`📦 Складов: ${warehouses.rows.length}`);

        // 5. Отправить на Railway через bulk-sync endpoint
        console.log('\n📤 Отправляю данные на Railway...');
        
        const response = await fetch(`${RAILWAY_URL}/sync/bulk-import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': process.env.SYNC_SECRET_KEY || 'smartpos-sync-key'
            },
            body: JSON.stringify({
                categories: categories.rows,
                products: products.rows,
                stockBalances: stockBalances.rows,
                warehouses: warehouses.rows
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('\n✅ Синхронизация завершена!', data);
        } else {
            const error = await response.text();
            console.log(`\n❌ Ошибка Railway (${response.status}):`, error);
            
            // Fallback: синхронизировать товары по одному через products API
            console.log('\n🔄 Пробую альтернативный метод (по одному)...');
            await syncProductsOneByOne(categories.rows, products.rows);
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await localPool.end();
    }
}

async function syncProductsOneByOne(categories, products) {
    // Сначала категории
    let catSuccess = 0;
    for (const cat of categories) {
        try {
            const resp = await fetch(`${RAILWAY_URL}/sync/import-item`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Key': process.env.SYNC_SECRET_KEY || 'smartpos-sync-key'
                },
                body: JSON.stringify({ type: 'category', data: cat })
            });
            if (resp.ok) catSuccess++;
        } catch (e) {
            // skip
        }
    }
    console.log(`  Категорий: ${catSuccess}/${categories.length}`);
    
    // Потом товары
    let prodSuccess = 0;
    for (const prod of products) {
        try {
            const resp = await fetch(`${RAILWAY_URL}/sync/import-item`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Key': process.env.SYNC_SECRET_KEY || 'smartpos-sync-key'
                },
                body: JSON.stringify({ type: 'product', data: prod })
            });
            if (resp.ok) prodSuccess++;
        } catch (e) {
            // skip
        }
    }
    console.log(`  Товаров: ${prodSuccess}/${products.length}`);
}

syncProducts();
