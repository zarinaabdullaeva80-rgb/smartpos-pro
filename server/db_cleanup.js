import pool from './src/config/database.js';

/**
 * Скрипт полной очистки базы данных SmartPOS Pro
 * Приводит систему в «заводское» состояние для нового клиента.
 */
async function cleanup() {
    console.log('Starting DATABASE CLEANUP...');
    
    try {
        // Список таблиц для очистки (в порядке обратном зависимостям)
        const tables = [
            'audit_log',
            'inventory_movements',
            'inventory_items',
            'inventory_adjustments',
            'stock_balances',
            'stock_movements',
            'sale_items',
            'sales',
            'purchase_items',
            'purchases',
            'return_items',
            'returns',
            'loyalty_transactions',
            'customer_loyalty',
            'loyalty_tiers',
            'loyalty_programs',
            'loyalty_settings',
            'customer_segments',
            'customers',
            'products',
            'product_categories',
            'warehouses',
            'shifts',
            'payment_methods',
            'licenses',
            'organizations'
        ];

        console.log('Truncating tables...');
        for (const table of tables) {
            try {
                await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
                console.log(`- ${table} truncated`);
            } catch (e) {
                console.warn(`! Could not truncate ${table}: ${e.message}`);
            }
        }

        console.log('Resetting sequences...');
        const sequences = [
            'organizations_id_seq',
            'warehouses_id_seq',
            'product_categories_id_seq',
            'products_id_seq',
            'sales_id_seq',
            'inventory_movements_id_seq'
        ];
        for (const seq of sequences) {
            try {
                await pool.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
            } catch (e) {}
        }

        // 3. Реинициализация базовых данных
        console.log('Re-initializing default data...');

        // Создаем дефолтную организацию
        const orgResult = await pool.query(`
            INSERT INTO organizations (name, code, license_key, is_active)
            VALUES ('Мой магазин', 'MYSHOP', 'L-DEFAULT-' || TO_CHAR(NOW(), 'YYYYMMDD'), true)
            RETURNING id
        `);
        const orgId = orgResult.rows[0].id;
        console.log(`Default organization created (ID: ${orgId})`);

        // Создаем дефолтный склад
        const whResult = await pool.query(`
            INSERT INTO warehouses (name, code, organization_id, is_active)
            VALUES ('Основной склад', 'MAIN', $1, true)
            RETURNING id
        `, [orgId]);
        console.log(`Default warehouse created (ID: ${whResult.rows[0].id})`);

        // Создаем дефолтную категорию
        await pool.query(`
            INSERT INTO product_categories (name, code, organization_id)
            VALUES ('Общее', 'GENERAL', $1)
        `, [orgId]);
        console.log('Default category created');

        // Привязываем всех существующих пользователей к новой организации
        await pool.query('UPDATE users SET organization_id = $1', [orgId]);
        console.log('Users linked to default organization');

        console.log('Cleanup and re-initialization SUCCESSFUL!');
    } catch (err) {
        console.error('CRITICAL ERROR during cleanup:', err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

cleanup();
