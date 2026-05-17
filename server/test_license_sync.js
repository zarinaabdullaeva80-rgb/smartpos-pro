/**
 * E2E тест: создаём лицензию → проверяем синхронизацию на оба Railway deployment'а
 */
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const LOCAL_API = 'http://127.0.0.1:5000/api';
const CLOUD_ORIG = 'https://smartpos-pro-production.up.railway.app/api';
const CLOUD_F885 = 'https://smartpos-pro-production-f885.up.railway.app/api';

async function getAdminToken() {
    const res = await fetch(`${LOCAL_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const data = await res.json();
    if (!data.token) throw new Error('Admin login failed: ' + JSON.stringify(data));
    return data.token;
}

async function main() {
    console.log('═══ E2E License Sync Test ═══\n');

    // 1. Получить токен админа
    console.log('1️⃣  Авторизация на локальном сервере...');
    let token;
    try {
        token = await getAdminToken();
        console.log('   ✅ Токен получен');
    } catch (e) {
        console.error('   ❌ Не удалось авторизоваться:', e.message);
        console.log('   Убедитесь, что локальный сервер запущен на порту 5000');
        process.exit(1);
    }

    // 2. Создать тестовую лицензию
    console.log('\n2️⃣  Создание тестовой лицензии...');
    const testUsername = 'synctest_' + Date.now();
    let licenseKey = null;
    let licenseId = null;

    try {
        const createRes = await fetch(`${LOCAL_API}/license/admin/licenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                customer_name: 'Sync Test User',
                customer_username: testUsername,
                customer_password: 'test123456',
                company_name: 'Test Company Sync',
                license_type: 'trial',
                trial_days: 5,
                max_devices: 1,
                max_users: 1,
                server_type: 'cloud'
            })
        });
        const createData = await createRes.json();
        
        if (!createData.success) {
            console.error('   ❌ Ошибка создания:', createData.error || JSON.stringify(createData));
            process.exit(1);
        }

        licenseKey = createData.license.license_key;
        licenseId = createData.license.id;
        console.log('   ✅ Лицензия создана:', licenseKey);
        console.log('   cloud_synced:', createData.cloud_synced);
    } catch (e) {
        console.error('   ❌ Ошибка:', e.message);
        process.exit(1);
    }

    // 3. Подождать 2 секунды для завершения синхронизации
    console.log('\n3️⃣  Ожидание синхронизации (2 сек)...');
    await new Promise(r => setTimeout(r, 2000));

    // 4. Проверить на оригинальном Railway
    console.log('\n4️⃣  Проверка на smartpos-pro-production (оригинальный)...');
    try {
        const res = await fetch(`${CLOUD_ORIG}/license/resolve?key=${licenseKey}`);
        const data = await res.json();
        if (res.ok && data.valid) {
            console.log('   ✅ НАЙДЕНА! company:', data.company_name, '| expires:', data.expires_at);
        } else {
            console.log('   ❌ НЕ НАЙДЕНА:', data.error || JSON.stringify(data));
        }
    } catch (e) {
        console.log('   ⚠️  Сервер недоступен:', e.message);
    }

    // 5. Проверить на f885 Railway
    console.log('\n5️⃣  Проверка на smartpos-pro-production-f885 (клиентский)...');
    try {
        const res = await fetch(`${CLOUD_F885}/license/resolve?key=${licenseKey}`);
        const data = await res.json();
        if (res.ok && data.valid) {
            console.log('   ✅ НАЙДЕНА! company:', data.company_name, '| expires:', data.expires_at);
        } else {
            console.log('   ❌ НЕ НАЙДЕНА:', data.error || JSON.stringify(data));
        }
    } catch (e) {
        console.log('   ⚠️  Сервер недоступен:', e.message);
    }

    // 6. Удалить тестовую лицензию
    console.log('\n6️⃣  Удаление тестовой лицензии...');
    try {
        const delRes = await fetch(`${LOCAL_API}/license/${licenseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const delData = await delRes.json();
        console.log('   Локальное удаление:', delData.success ? '✅' : '❌ ' + JSON.stringify(delData));
    } catch (e) {
        console.log('   ⚠️  Ошибка удаления:', e.message);
    }

    // 7. Подождать и проверить удаление на облаках
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n7️⃣  Проверка удаления на облаках...');
    for (const [name, url] of [['original', CLOUD_ORIG], ['f885', CLOUD_F885]]) {
        try {
            const res = await fetch(`${url}/license/resolve?key=${licenseKey}`);
            const data = await res.json();
            if (res.status === 404) {
                console.log(`   ✅ ${name}: удалена (404)`);
            } else if (data.valid) {
                console.log(`   ❌ ${name}: всё ещё существует!`);
            } else {
                console.log(`   ℹ️  ${name}: ${res.status} - ${data.error}`);
            }
        } catch (e) {
            console.log(`   ⚠️  ${name}: недоступен (${e.message})`);
        }
    }

    console.log('\n═══ Тест завершён ═══');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
