// Проверяем, какие товары есть на Railway для org_id=14
const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        // Сначала логинимся на Railway чтобы получить токен
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        
        if (!loginRes.ok) {
            const err = await loginRes.text();
            console.log('Login failed:', loginRes.status, err);
            
            // Попробуем другого пользователя
            const login2 = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
            });
            if (!login2.ok) {
                console.log('Login2 failed:', login2.status, await login2.text());
                return;
            }
            const data2 = await login2.json();
            console.log('Logged in as Topcell11, org_id:', data2.user?.organization_id);
            
            const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                headers: { 'Authorization': 'Bearer ' + data2.token }
            });
            const prodData = await prodRes.json();
            console.log('Products count:', prodData.products?.length || 0);
            if (prodData.products) {
                prodData.products.slice(0, 5).forEach(p => console.log(`  #${p.id} ${p.name} org=${p.organization_id}`));
            }
            return;
        }
        
        const data = await loginRes.json();
        console.log('Logged in as Topcell1, org_id:', data.user?.organization_id);
        
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': 'Bearer ' + data.token }
        });
        const prodData = await prodRes.json();
        console.log('Products count:', prodData.products?.length || 0);
        if (prodData.products) {
            prodData.products.slice(0, 5).forEach(p => console.log(`  #${p.id} ${p.name} org=${p.organization_id}`));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
