const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Creating NEW Employee properly ---');
        
        // 1. Login as Owner
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const token = (await loginRes.json()).token;

        // 2. Create employee via /api/users
        const res = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                username: 'Topcell_POS',
                fullName: 'Рабочее место POS',
                email: 'pos@topcell.com'
            })
        });
        
        const data = await res.json();
        const genPass = data.password;
        console.log(`✅ Created Topcell_POS! Temp pass: ${genPass}`);

        // 3. Login as him to verify Org
        const empLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell_POS', password: genPass })
        });
        const empData = await empLogin.json();
        console.log('New User OrgID:', empData.user.organization_id);

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
