const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Creating Employee Topcell22 in Cloud ---');
        
        // 1. Login as Owner (Topcell1)
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const token = (await loginRes.json()).token;

        // 2. Create employee via /api/users (as admin of the org)
        const res = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                username: 'Topcell22',
                fullName: 'Сотрудник Mobile City',
                email: 'topcell22@example.com'
                // Password will be generated
            })
        });
        
        const data = await res.json();
        console.log('Creation Status:', res.status);
        console.log('Result:', JSON.stringify(data));

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
