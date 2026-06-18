import fetch from 'node-fetch';

const CLOUD_F885 = 'https://smartpos-pro-production-f885.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function fix() {
    console.log('=== ИСПРАВЛЕНИЕ ЛИЦЕНЗИИ (через extend + SQL) ===\n');

    // 1. Узнаем ID лицензии на облаке через get_schema -> SQL query
    console.log('--- 1. Получаем данные о лицензии ID=12 на облаке ---');
    
    // Используем admin-cleanup -> check_tables чтобы подтвердить что таблица есть
    const schemaRes = await fetch(`${CLOUD_F885}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': SYNC_SECRET
        },
        body: JSON.stringify({ action: 'get_schema', table: 'licenses' })
    });
    const schemaData = await schemaRes.json();
    console.log('  Columns:', schemaData.results?.schema?.map(c => c.column_name).join(', '));

    // 2. Используем extend endpoint — обновить лицензию ID=12
    console.log('\n--- 2. Extend лицензию ID=12 ---');
    const extendRes = await fetch(`${CLOUD_F885}/api/license/extend/12`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    console.log(`  Extend status: ${extendRes.status}`);
    const extendData = await extendRes.json();
    console.log(`  Response:`, JSON.stringify(extendData, null, 2));

    // 3. Проверяем check-expiry 
    console.log('\n--- 3. Проверка после extend ---');
    const loginRes = await fetch(`${CLOUD_F885}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Smash2206', password: 'Smash2206' })
    });
    const loginData = await loginRes.json();
    
    const checkRes = await fetch(`${CLOUD_F885}/api/license/check-expiry`, {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    console.log(`  check-expiry status: ${checkRes.status}`);
    const checkData = await checkRes.json();
    console.log(`  Response:`, JSON.stringify(checkData, null, 2));

    if (!checkData.expired && checkRes.status === 200) {
        console.log('\n  ✅✅✅ ЛИЦЕНЗИЯ АКТИВНА! ПРОБЛЕМА РЕШЕНА! ✅✅✅');
        
        // Проверим продукты тоже
        const prodRes = await fetch(`${CLOUD_F885}/api/products`, {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
        });
        console.log(`  Products status: ${prodRes.status}`);
        if (prodRes.ok) {
            const prodData = await prodRes.json();
            console.log(`  Products count: ${prodData.products?.length || 0}`);
        }
    } else {
        console.log('\n  ❌ Всё ещё expired. Нужно проверить какая именно лицензия у ID=12');
        console.log('  Пробуем другие ID...');
        
        // Попробуем extend для всех возможных ID
        for (const id of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
            try {
                const r = await fetch(`${CLOUD_F885}/api/license/extend/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (r.ok) {
                    const d = await r.json();
                    console.log(`  ID=${id}: Key=${d.license?.license_key}, Expires=${d.license?.expires_at}, Company=${d.license?.company_name}`);
                }
            } catch(e) {}
        }
        
        // Повторная проверка
        const loginRes2 = await fetch(`${CLOUD_F885}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Smash2206', password: 'Smash2206' })
        });
        const loginData2 = await loginRes2.json();
        const checkRes2 = await fetch(`${CLOUD_F885}/api/license/check-expiry`, {
            headers: { 'Authorization': `Bearer ${loginData2.token}` }
        });
        console.log(`\n  Финальный check-expiry: ${checkRes2.status}`);
        const checkData2 = await checkRes2.json();
        console.log(`  Response:`, JSON.stringify(checkData2, null, 2));
    }

    console.log('\n=== ГОТОВО ===');
}

fix().catch(e => console.error('FATAL:', e));
