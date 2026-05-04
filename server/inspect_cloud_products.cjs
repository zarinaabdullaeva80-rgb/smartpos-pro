const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Inspecting User and Products on Cloud ---');
        
        // 1. Login
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('User from login:', loginData.user.username, 'OrgID:', loginData.user.organization_id);

        // 2. Auth ME check
        const meRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const meData = await meRes.json();
        console.log('User from /me:', meData.user?.username, 'OrgID:', meData.user?.organization_id);

        // 3. Products Raw Check (via API)
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const prodData = await prodRes.json();
        
        console.log('API returned products count:', prodData.products?.length);
        if (prodData.products) {
            prodData.products.forEach(p => {
                console.log(`Product: ${p.name}, OrgID: ${p.organization_id}, is_active: ${p.is_active}`);
            });
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
