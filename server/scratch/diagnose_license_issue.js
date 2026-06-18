import fetch from 'node-fetch';

const CLOUD_F885 = 'https://smartpos-pro-production-f885.up.railway.app';
const CLOUD_ORIG = 'https://smartpos-pro-production.up.railway.app';

async function diagnose() {
    console.log('=== ПОЛНАЯ ДИАГНОСТИКА ЛИЦЕНЗИИ ===\n');
    console.log(`Время: ${new Date().toISOString()}\n`);

    // 1. Проверка доступности серверов
    for (const url of [CLOUD_F885, CLOUD_ORIG]) {
        console.log(`--- Проверка ${url} ---`);
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${url}/api/health`, { signal: controller.signal });
            const data = await res.json();
            console.log(`  Status: ${res.status}, Data:`, data);
        } catch (e) {
            console.log(`  ❌ НЕДОСТУПЕН: ${e.message}`);
        }
    }

    // 2. Логин как Smash2206 (владелец лицензии B5F3-87E6-20F4-7B7A)
    console.log('\n--- Логин как Smash2206 на f885 ---');
    let token = null;
    try {
        const loginRes = await fetch(`${CLOUD_F885}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Smash2206', password: 'Smash2206' })
        });
        console.log(`  Login status: ${loginRes.status}`);
        const loginData = await loginRes.json();
        if (loginRes.ok) {
            token = loginData.token;
            console.log(`  ✅ User ID: ${loginData.user?.id}`);
            console.log(`  Organization ID: ${loginData.user?.organization_id}`);
            console.log(`  License ID: ${loginData.user?.license_id}`);
            console.log(`  User type: ${loginData.user?.user_type}`);
        } else {
            console.log(`  ❌ Login error:`, loginData);
        }
    } catch (e) {
        console.log(`  ❌ Login network error: ${e.message}`);
    }

    // 3. Проверка check-expiry (это то, что вызывает App.jsx)
    if (token) {
        console.log('\n--- check-expiry (App.jsx вызывает этот endpoint) ---');
        try {
            const res = await fetch(`${CLOUD_F885}/api/license/check-expiry`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`  Status: ${res.status}`);
            const data = await res.json();
            console.log(`  Response:`, JSON.stringify(data, null, 2));
            if (data.expired) {
                console.log(`  ★★★ СЕРВЕР ВОЗВРАЩАЕТ expired=true! ВОТ ПРИЧИНА! ★★★`);
            }
        } catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }

        // 4. Попробуем запросить продукты (проверка 403)
        console.log('\n--- Запрос продуктов (проверка 403) ---');
        try {
            const res = await fetch(`${CLOUD_F885}/api/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`  Products status: ${res.status}`);
            if (res.status === 403) {
                const data = await res.json();
                console.log(`  ★★★ 403 ОТВЕТ:`, JSON.stringify(data));
                console.log(`  ★ api.js перехватчик диспатчит license-expired на ЛЮБОЙ 403!`);
            } else if (res.ok) {
                const data = await res.json();
                console.log(`  ✅ Products count: ${data.products?.length || 0}`);
            }
        } catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }

        // 5. Проверка /auth/me
        console.log('\n--- /auth/me ---');
        try {
            const res = await fetch(`${CLOUD_F885}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`  Status: ${res.status}`);
            if (res.status === 403) {
                const data = await res.json();
                console.log(`  ★ 403:`, JSON.stringify(data));
            } else if (res.ok) {
                const data = await res.json();
                console.log(`  ✅ User:`, data.username, '| license_id:', data.license_id);
            }
        } catch (e) {
            console.log(`  ❌ Error: ${e.message}`);
        }
    }

    // 6. Прямая проверка лицензии по ключу
    console.log('\n--- Прямая валидация ключа B5F3-87E6-20F4-7B7A ---');
    try {
        const res = await fetch(`${CLOUD_F885}/api/license/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: 'B5F3-87E6-20F4-7B7A' })
        });
        console.log(`  Status: ${res.status}`);
        const data = await res.json();
        console.log(`  Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
    }

    // 7. Resolve ключа
    console.log('\n--- Resolve ключа ---');
    try {
        const res = await fetch(`${CLOUD_F885}/api/license/resolve?key=B5F3-87E6-20F4-7B7A`);
        console.log(`  Status: ${res.status}`);
        const data = await res.json();
        console.log(`  Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(`  ❌ Error: ${e.message}`);
    }

    console.log('\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===');
}

diagnose().catch(e => console.error('FATAL:', e));
