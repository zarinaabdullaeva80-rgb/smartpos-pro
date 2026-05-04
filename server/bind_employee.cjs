const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Binding Topcell11 to License B5F3-87E6-20F4-7B7A ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: 'Topcell11', 
                password: 'Topcell11',
                license_key: 'B5F3-87E6-20F4-7B7A' // This should trigger auto-bind in cloud
            })
        });
        
        if (loginRes.ok) {
            const data = await loginRes.json();
            console.log('✅ Topcell11 Login with Key Success! OrgID:', data.user.organization_id);
            
            // Final check: do they see products now?
            const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
                headers: { 'Authorization': 'Bearer ' + data.token }
            });
            const prods = await prodRes.json();
            console.log('Products visible now:', prods.products?.length || 0);
        } else {
            console.log('Login failed:', await loginRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
