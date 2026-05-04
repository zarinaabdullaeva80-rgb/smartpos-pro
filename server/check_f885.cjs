const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    const targetUrl = 'https://smartpos-pro-production-f885.up.railway.app/api';
    try {
        console.log(`--- Checking Fallback URL: ${targetUrl} ---`);
        
        const loginRes = await fetch(`${targetUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' }),
            timeout: 15000
        });
        
        console.log('Login Status:', loginRes.status);
        if (loginRes.ok) {
            const data = await loginRes.json();
            console.log('Login Success! Org ID:', data.user.organization_id);
            
            const prodRes = await fetch(`${targetUrl}/products`, {
                headers: { 'Authorization': 'Bearer ' + data.token }
            });
            const prods = await prodRes.json();
            console.log('Products Count:', prods.products?.length || 0);
        } else {
            console.log('Login Failed:', await loginRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
