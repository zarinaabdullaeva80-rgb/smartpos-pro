const fetch = require('node-fetch') || globalThis.fetch;

const RAILWAY_API = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function waitAndInspect() {
    console.log('⏳ Ожидаем завершения деплоя на Railway...');
    let initialUptime = null;
    
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`${RAILWAY_API}/api/health`);
            if (res.ok) {
                const data = await res.json();
                console.log(`  - Статус: OK, uptime: ${Math.round(data.uptime)}с`);
                if (initialUptime === null) {
                    initialUptime = data.uptime;
                } else if (data.uptime < initialUptime) {
                    console.log('  🎉 Обнаружен новый деплой!');
                    break;
                }
            }
        } catch (e) {
            console.log('  - Сервер перезапускается...');
        }
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n📡 Отправка диагностических запросов к БД...');
    
    // 1. Получаем пользователей
    try {
        const usersRes = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
            body: JSON.stringify({ action: 'query_users' })
        });
        const usersData = await usersRes.json();
        console.log('\n👤 ПОЛЬЗОВАТЕЛИ В ОБЛАКЕ:');
        console.log(JSON.stringify(usersData.users || usersData, null, 2));
    } catch (e) { console.error('Error users:', e.message); }

    // 2. Получаем клиентов
    try {
        const custRes = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
            body: JSON.stringify({ action: 'query_customers' })
        });
        const custData = await custRes.json();
        console.log('\n🎴 КЛИЕНТЫ И КАРТЫ В ОБЛАКЕ:');
        const list = custData.customers || [];
        console.log(`Найдено клиентов: ${list.length}`);
        list.forEach(c => {
            console.log(`ID: ${c.id} | Org: ${c.organization_id} | Name: ${c.name} | Phone: ${c.phone} | Card: ${c.card_number} | Points: ${c.loyalty_points}`);
        });
        console.log('\n🏢 ОРГАНИЗАЦИИ:');
        console.log(JSON.stringify(custData.organizations || [], null, 2));
    } catch (e) { console.error('Error customers:', e.message); }
}

waitAndInspect();
