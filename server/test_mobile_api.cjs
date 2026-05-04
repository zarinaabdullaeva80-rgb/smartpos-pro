const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Testing API exactly like mobile ---');
        
        // 1. Login
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // 2. Fetch products with active=true (like mobile app)
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products?active=true', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const prodData = await prodRes.json();
        
        console.log('Response Status:', prodRes.status);
        console.log('Products Count:', prodData.products?.length || 0);
        
        if (prodData.products && prodData.products.length > 0) {
            console.log('Sample Product:', prodData.products[0].name, 'Active:', prodData.products[0].is_active);
        } else {
            console.log('Full Response:', JSON.stringify(prodData));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
