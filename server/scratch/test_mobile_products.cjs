const fetch = require('node-fetch');

async function testMobileLogin() {
    const BASE = 'https://smartpos-pro-production.up.railway.app/api';
    
    // Try known users
    const users = [
        { username: 'Topcell1', password: 'topcell1' },
        { username: 'Topcell111', password: 'topcell111' },
        { username: 'Topcell_POS', password: 'topcell_pos' },
        { username: 'Smash2206', password: 'smash2206' },
        { username: 'Nematullo1', password: 'nematullo1' },
    ];

    for (const user of users) {
        try {
            const res = await fetch(`${BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            const data = await res.json();
            if (data.token) {
                console.log(`✅ ${user.username} → org=${data.user?.organization_id}, license=${data.user?.license_id}`);
                
                // Try fetching products
                const prodRes = await fetch(`${BASE}/products`, {
                    headers: { 'Authorization': `Bearer ${data.token}` }
                });
                const prodData = await prodRes.json();
                console.log(`   Products: ${prodData.products?.length || 0}`);
            } else {
                console.log(`❌ ${user.username}: ${data.error}`);
            }
        } catch (err) {
            console.log(`❌ ${user.username}: ${err.message}`);
        }
    }
}

testMobileLogin();
