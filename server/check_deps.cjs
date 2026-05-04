const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Categories and Warehouses for Topcell111 ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11' })
        });
        const token = (await loginRes.json()).token;

        // Check Categories
        const catRes = await fetch('https://smartpos-pro-production.up.railway.app/api/categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cats = await catRes.json();
        console.log('Categories Count:', cats.categories?.length || 0);

        // Check Warehouses
        const whRes = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const whs = await whRes.json();
        console.log('Warehouses Count:', whs.warehouses?.length || 0);

    } catch (e) { console.error(e); }
})();
