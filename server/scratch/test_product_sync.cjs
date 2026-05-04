const fetch = require('node-fetch');

const CLOUD = 'https://smartpos-pro-production.up.railway.app/api';
const SECRET = 'smartpos-sync-key-2026';

async function testProductSync() {
    console.log('=== Тест синхронизации товаров ===\n');

    // 1. Get a license_key from cloud
    console.log('1. Ищу активную лицензию...');
    const lkRes = await fetch(`${CLOUD}/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify({ action: 'run_sql', sql: "SELECT license_key, organization_id FROM licenses WHERE is_active = true AND organization_id IS NOT NULL LIMIT 1" })
    });
    const lkData = await lkRes.json();
    const license_key = lkData.results?.rows?.[0]?.license_key;
    const org_id = lkData.results?.rows?.[0]?.organization_id;
    console.log(`   License: ${license_key}, Org: ${org_id}\n`);

    if (!license_key) { console.log('❌ Нет активных лицензий'); return; }

    // 2. Count products BEFORE
    const beforeRes = await fetch(`${CLOUD}/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify({ action: 'run_sql', sql: `SELECT COUNT(*) as cnt FROM products WHERE organization_id = ${org_id}` })
    });
    const beforeData = await beforeRes.json();
    console.log(`2. Товаров ДО синхронизации: ${beforeData.results?.rows?.[0]?.cnt}\n`);

    // 3. Sync a test product
    console.log('3. Синхронизирую тестовый товар...');
    const testProduct = {
        license_key,
        code: 'TEST-SYNC-' + Date.now(),
        name: 'Тестовый товар для синхронизации',
        unit: 'шт',
        price_purchase: 5000,
        price_sale: 10000,
        price_retail: 12000,
        barcode: '1234567890123',
        is_active: true,
        min_stock: 5
    };

    const syncRes = await fetch(`${CLOUD}/license/sync-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify(testProduct)
    });
    const syncData = await syncRes.json();
    console.log(`   Результат: ${JSON.stringify(syncData)}\n`);

    // 4. Bulk sync test
    console.log('4. Bulk sync 3 товара...');
    const bulkProducts = [
        { code: 'BULK-1-' + Date.now(), name: 'Bulk товар 1', price_sale: 1000, unit: 'шт' },
        { code: 'BULK-2-' + Date.now(), name: 'Bulk товар 2', price_sale: 2000, unit: 'шт' },
        { code: 'BULK-3-' + Date.now(), name: 'Bulk товар 3', price_sale: 3000, unit: 'шт' },
    ];

    const bulkRes = await fetch(`${CLOUD}/license/sync-products-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify({ license_key, products: bulkProducts })
    });
    const bulkData = await bulkRes.json();
    console.log(`   Результат: ${JSON.stringify(bulkData)}\n`);

    // 5. Count products AFTER
    const afterRes = await fetch(`${CLOUD}/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify({ action: 'run_sql', sql: `SELECT COUNT(*) as cnt FROM products WHERE organization_id = ${org_id}` })
    });
    const afterData = await afterRes.json();
    console.log(`5. Товаров ПОСЛЕ синхронизации: ${afterData.results?.rows?.[0]?.cnt}`);
    console.log(`   Добавлено: +${afterData.results?.rows?.[0]?.cnt - beforeData.results?.rows?.[0]?.cnt}\n`);

    // 6. Test login and product visibility
    console.log('6. Проверяю видимость товаров через API...');
    const usersRes = await fetch(`${CLOUD}/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SECRET },
        body: JSON.stringify({ action: 'run_sql', sql: `SELECT username FROM users WHERE organization_id = ${org_id} LIMIT 1` })
    });
    const usersData = await usersRes.json();
    const username = usersData.results?.rows?.[0]?.username;
    if (username) {
        console.log(`   Пользователь: ${username}`);
    }

    console.log('\n✅ Тест завершён!');
}

testProductSync().catch(e => console.error('Error:', e));
