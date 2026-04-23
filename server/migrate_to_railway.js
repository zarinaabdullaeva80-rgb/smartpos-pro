/**
 * Миграция данных: Локальная БД → Railway через API
 * Ожидает деплой, затем отправляет ВСЕ данные одним запросом
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const RAILWAY_API = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

const localPool = new Pool({
    connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db',
    max: 5,
    client_encoding: 'UTF8'
});

const TABLES = [
    'organizations',
    'licenses',
    'users',
    'roles',
    'product_categories',
    'warehouses',
    'counterparties',
    'customers',
    'products',
    'stock_balances',
    'shifts',
    'sales',
    'sale_items',
    'inventory_movements',
    'purchases',
    'purchase_items',
    'expenses',
    'user_roles',
];

async function getLocalData(tableName) {
    try {
        const check = await localPool.query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`, [tableName]
        );
        if (!check.rows[0].exists) return null;
        const data = await localPool.query(`SELECT * FROM "${tableName}" ORDER BY id`);
        return data.rows;
    } catch (e) { return null; }
}

async function waitForDeploy() {
    console.log('⏳ Ожидание нового деплоя Railway (body limit 50mb)...');
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        try {
            const res = await fetch(`${RAILWAY_API}/api/health`, { signal: AbortSignal.timeout(5000) });
            const data = await res.json();
            if (data.uptime < 180) {
                console.log(`  ✅ Новый деплой! uptime=${Math.round(data.uptime)}s\n`);
                return true;
            }
            console.log(`  ⏳ uptime: ${Math.round(data.uptime)}s — ещё старая версия...`);
        } catch (e) { console.log('  Перезапуск...'); }
    }
    console.log('⚠️ Timeout — пробуем всё равно\n');
    return false;
}

async function main() {
    console.log('🚀 Миграция данных\n');
    await localPool.query('SELECT 1');
    console.log('✅ Локальная БД подключена\n');

    // Collect data
    console.log('📊 Локальные данные:');
    const allData = {};
    let totalRows = 0;
    for (const table of TABLES) {
        const rows = await getLocalData(table);
        if (rows && rows.length > 0) {
            allData[table] = rows;
            totalRows += rows.length;
            console.log(`  ✓ ${table}: ${rows.length}`);
        }
    }
    console.log(`\n📦 Всего: ${totalRows} строк\n`);

    // Wait for new deploy with increased body limit
    await waitForDeploy();

    // Send ALL data
    const body = JSON.stringify({ action: 'bulk_migrate', tables: allData });
    console.log(`📡 Отправка: ${(body.length / 1024 / 1024).toFixed(2)} MB...`);

    const res = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body
    });

    const result = await res.json();

    if (result.success) {
        console.log('\n✅ Результаты миграции:');
        for (const [table, info] of Object.entries(result.results)) {
            if (info.skipped) continue;
            const status = info.error ? '❌' : '✅';
            console.log(`  ${status} ${table}: ${info.inserted || 0}/${info.total || 0} ${info.error || ''}`);
        }
    } else {
        console.log('❌ Ошибка:', JSON.stringify(result).substring(0, 300));
    }

    // Verify
    console.log('\n📊 Проверка...');
    try {
        const loginRes = await fetch(`${RAILWAY_API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin', license_key: 'L-DEFAULT-20260418' })
        });
        const loginData = await loginRes.json();
        if (loginData.token) {
            const prodRes = await fetch(`${RAILWAY_API}/api/products`, {
                headers: { 'Authorization': `Bearer ${loginData.token}` }
            });
            const prodData = await prodRes.json();
            console.log(`  ✅ Товаров на Railway: ${prodData.products?.length || 0}`);
        } else {
            console.log('  ⚠️ Не удалось залогиниться:', loginData.error);
        }
    } catch (e) { console.log('  ⚠️ Ошибка проверки'); }

    await localPool.end();
    console.log('\n🎉 Готово!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
