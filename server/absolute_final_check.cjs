const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- FINAL TEST OF TOPCELL11 ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
        });
        
        if (loginRes.ok) {
            const data = await loginRes.json();
            console.log('✅ SUCCESS! Topcell11 can login.');
            console.log('Organization ID:', data.user.organization_id);
            
            const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                headers: { 'Authorization': 'Bearer ' + data.token }
            });
            const prods = await prodRes.json();
            console.log('Products visible:', prods.products?.length || 0);
        } else {
            console.log('❌ FAILED:', await loginRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
