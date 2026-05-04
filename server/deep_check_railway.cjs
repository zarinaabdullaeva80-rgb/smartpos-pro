const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Deep Check Railway Data ---');
        
        // 1. Login
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        const orgId = loginData.user.organization_id;
        console.log(`Logged in. Org ID: ${orgId}`);

        // 2. Check if the user is linked to a license correctly
        // There is no direct "get license" for user, but we can check via check-license endpoint if it exists
        const licRes = await fetch(`https://smartpos-pro-production.up.railway.app/api/license/status`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        console.log('License Status Response:', licRes.status);
        if (licRes.ok) {
            console.log('License Data:', await licRes.json());
        }

        // 3. Final verification of products
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products?active=true', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const prodData = await prodRes.json();
        console.log(`Products in API for this user: ${prodData.products?.length || 0}`);
        if (prodData.products) {
            prodData.products.forEach(p => console.log(`  - ${p.name} (Code: ${p.code}, Qty: ${p.quantity})`));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
