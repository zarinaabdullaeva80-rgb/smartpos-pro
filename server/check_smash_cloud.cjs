const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Railway -f885 for Smash22 ---');
        
        // 1. Попробуем залогиниться как Smash22
        const loginRes = await fetch('https://smartpos-pro-production-f885.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Smash22', password: 'Smash2206' })
        });
        
        if (!loginRes.ok) {
            console.log('Login failed:', loginRes.status, await loginRes.text());
            return;
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log(`Logged in. User ID: ${loginData.user.id}, Org ID: ${loginData.user.organization_id}`);

        // 2. Получим клиентов
        const custRes = await fetch('https://smartpos-pro-production-f885.up.railway.app/api/customers', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const custData = await custRes.json();
        const list = custData.customers || [];
        console.log(`Найдено клиентов: ${list.length}`);
        list.forEach(c => {
            console.log(`ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | Card: ${c.card_number} | Points: ${c.loyalty_points}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
