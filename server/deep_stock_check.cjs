const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Deep Stock Check on Cloud ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11' })
        });
        const { token, user } = await loginRes.json();

        // 1. Get Warehouses
        const whRes = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const whs = await whRes.json();
        console.log('Warehouses:', JSON.stringify(whs.warehouses));

        // 2. Get Products
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const prods = await prodRes.json();
        console.log('Products found:', prods.products?.length || 0);

        // 3. Check if products have stock in any warehouse
        // We'll check inventory movements
        const invRes = await fetch('https://smartpos-pro-production.up.railway.app/api/inventory/movements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (invRes.ok) {
            const inv = await invRes.json();
            console.log('Movements count:', inv.movements?.length || 0);
        } else {
            console.log('Inventory API not accessible or empty.');
        }

    } catch (e) { console.error(e); }
})();
