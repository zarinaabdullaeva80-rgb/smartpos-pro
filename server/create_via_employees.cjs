const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Creating Employee via /api/employees ---');
        
        // 1. Login as Owner
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const token = (await loginRes.json()).token;

        // 2. Create employee
        const empRes = await fetch('https://smartpos-pro-production.up.railway.app/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                username: 'Topcell11',
                password: 'Topcell11',
                full_name: 'Сотрудник Topcell (Direct)',
                role: 'Кассир'
            })
        });
        
        console.log('Status:', empRes.status);
        const data = await empRes.json();
        console.log('Response:', JSON.stringify(data));

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
