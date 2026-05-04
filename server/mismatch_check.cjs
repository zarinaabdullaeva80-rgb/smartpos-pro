const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Organization Mismatch Check ---');
        
        // Login as Topcell1
        const res1 = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const data1 = await res1.json();
        console.log(`Topcell1: OrgID = ${data1.user.organization_id}`);

        // Login as Topcell111
        const res2 = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: 'Topcell11' })
        });
        const data2 = await res2.json();
        console.log(`Topcell111: OrgID = ${data2.user.organization_id}`);

        if (data1.user.organization_id !== data2.user.organization_id) {
            console.log('❌ MISMATCH DETECTED!');
        } else {
            console.log('✅ Organizations MATCH.');
        }

        // Final check of products for Topcell111 again
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': `Bearer ${data2.token}` }
        });
        const prods = await prodRes.json();
        console.log('Products Count for Topcell111:', prods.products?.length || 0);

    } catch (e) { console.error(e); }
})();
