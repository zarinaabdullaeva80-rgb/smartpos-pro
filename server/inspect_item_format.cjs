const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11' })
        });
        const data = await loginRes.json();
        
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': `Bearer ${data.token}` }
        });
        const prods = await prodRes.json();
        
        if (prods.products && prods.products.length > 0) {
            console.log('--- Sample Product Data ---');
            console.log(JSON.stringify(prods.products[0], null, 2));
        } else {
            console.log('No products found in the response.');
        }

    } catch (e) { console.error(e); }
})();
