const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Final Check for Employee Topcell11 ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
        });
        
        console.log('Login Status:', loginRes.status);
        if (loginRes.ok) {
            const data = await loginRes.json();
            console.log('✅ Topcell11 is IN! OrgID:', data.user.organization_id);
            
            // Check products for him
            const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                headers: { 'Authorization': 'Bearer ' + data.token }
            });
            const prods = await prodRes.json();
            console.log('Products visible to Topcell11:', prods.products?.length || 0);
        } else {
            console.log('Login failed:', await loginRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
