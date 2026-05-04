const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('=== ПОЛНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ ===\n');

        // 1. Логин как Topcell111 (как это делает мобильное приложение)
        console.log('--- 1. ЛОГИН (без license_key, как curl) ---');
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11' })
        });
        const loginData = await loginRes.json();
        console.log('  Login Status:', loginRes.status);
        console.log('  OrgID:', loginData.user?.organization_id);
        console.log('  Role:', loginData.user?.role);
        console.log('  License ID:', loginData.user?.license_id);
        const token = loginData.token;

        // 2. Запрос товаров
        console.log('\n--- 2. ЗАПРОС ТОВАРОВ (GET /products) ---');
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('  Products Status:', prodRes.status);
        if (prodRes.status === 403) {
            const err = await prodRes.json();
            console.log('  ❌ 403 FORBIDDEN:', JSON.stringify(err));
            console.log('  ★ ВОТ ЭТО И ЕСТЬ ПРИЧИНА! Лицензия заблокирована!');
        } else if (prodRes.ok) {
            const prods = await prodRes.json();
            console.log('  ✅ Products Count:', prods.products?.length || 0);
        } else {
            console.log('  ❓ Unexpected:', await prodRes.text());
        }

        // 3. Проверим лицензию для org 142 напрямую
        console.log('\n--- 3. ЛОГИН КАК ADMIN (проверка лицензий) ---');
        const adminRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const adminData = await adminRes.json();
        const adminToken = adminData.token;

        // Попробуем получить лицензии
        const licRes = await fetch('https://smartpos-pro-production.up.railway.app/api/licensing/licenses', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (licRes.ok) {
            const licData = await licRes.json();
            const licenses = licData.licenses || licData || [];
            console.log('  Total Licenses:', licenses.length);
            // Найти лицензию для org 142
            const org142Lic = licenses.find(l => l.organization_id === 142 || l.organization_id === '142');
            if (org142Lic) {
                console.log('  ★ License for Org 142:', JSON.stringify({
                    id: org142Lic.id,
                    status: org142Lic.status,
                    expires_at: org142Lic.expires_at,
                    license_key: org142Lic.license_key
                }));
            } else {
                console.log('  ⚠️ NO LICENSE FOUND for org 142!');
                console.log('  Available orgs:', licenses.map(l => `${l.id}:org=${l.organization_id}:${l.status}`).join(', '));
            }
        } else {
            console.log('  Licenses endpoint not available:', licRes.status);
        }

        // 4. Теперь проверим С license_key (как это делает мобильное приложение)
        console.log('\n--- 4. ЛОГИН С LICENSE_KEY (как мобильное приложение) ---');
        const licKey = 'B5F3-87E6-20F4-7B7A'; // ключ из локальной базы
        const loginWithKey = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11', license_key: licKey })
        });
        console.log('  Login+Key Status:', loginWithKey.status);
        const loginKeyData = await loginWithKey.json();
        if (loginWithKey.ok) {
            console.log('  OrgID:', loginKeyData.user?.organization_id);
            console.log('  License:', JSON.stringify(loginKeyData.license));
            
            // Проверим товары с этим токеном
            const prodRes2 = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                headers: { 'Authorization': `Bearer ${loginKeyData.token}` }
            });
            console.log('  Products (with key):', prodRes2.status);
            if (prodRes2.ok) {
                const prods2 = await prodRes2.json();
                console.log('  Products Count:', prods2.products?.length || 0);
            } else {
                const err2 = await prodRes2.json();
                console.log('  ❌ ERROR:', JSON.stringify(err2));
            }
        } else {
            console.log('  ❌ Login failed:', JSON.stringify(loginKeyData));
        }

        // 5. Проверка: какой Topcell1 видит
        console.log('\n--- 5. КОНТРОЛЬНАЯ ГРУППА: Topcell1 ---');
        const t1Res = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const t1Data = await t1Res.json();
        const t1Prods = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': `Bearer ${t1Data.token}` }
        });
        console.log('  Topcell1 Products Status:', t1Prods.status);
        if (t1Prods.ok) {
            const p = await t1Prods.json();
            console.log('  Topcell1 Products Count:', p.products?.length || 0);
        } else {
            const err = await t1Prods.json();
            console.log('  ❌ Topcell1 ERROR:', JSON.stringify(err));
        }

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
})();
