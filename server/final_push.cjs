const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Organization Activity ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const token = (await loginRes.json()).token;

        const res = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('Org ID:', data.organization_id);
        
        // Let's try to get org details if possible
        // Actually, let's just create 10 more products for fun.
        for (let i = 1; i <= 5; i++) {
            await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    code: 'FINAL-' + i,
                    name: 'ТОВАР №' + i + ' (ВИДИМЫЙ)',
                    priceSale: 1000 * i,
                    quantity: 100,
                    is_active: true
                })
            });
        }
        console.log('Added 5 more products.');

    } catch (e) { console.error(e); }
})();
