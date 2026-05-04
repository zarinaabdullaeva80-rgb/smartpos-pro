const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Railway Cloud Data ---');
        
        // Login to get token and organization_id
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        
        if (!loginRes.ok) {
            console.log('Login failed:', loginRes.status);
            return;
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        const orgId = loginData.user.organization_id;
        console.log(`Logged in. Org ID: ${orgId}`);

        // 1. Check Warehouses
        const whRes = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const whData = await whRes.json();
        console.log(`Warehouses found: ${whData.length || 0}`);
        if (whData.length > 0) {
            whData.forEach(w => console.log(`  - WH: ${w.name} (ID: ${w.id}, Code: ${w.code})`));
        }

        // 2. Check Products
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const prodData = await prodRes.json();
        const products = prodData.products || [];
        console.log(`Products found: ${products.length}`);
        if (products.length > 0) {
            products.slice(0, 5).forEach(p => console.log(`  - Prod: ${p.name} (ID: ${p.id}, Active: ${p.is_active})`));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
