const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Creating Final Employee Topcell111 ---');
        
        // 1. Login as Owner
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const token = (await loginRes.json()).token;

        // 2. Create Topcell111
        const res = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                username: 'Topcell111',
                fullName: 'Сотрудник Mobile City',
                email: 'topcell111@topcell.com'
            })
        });
        const data = await res.json();
        const genPass = data.password;

        // 3. Set password to Topcell11
        const empLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell111', password: genPass })
        });
        const empToken = (await empLogin.json()).token;
        await fetch('https://smartpos-pro-production.up.railway.app/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + empToken },
            body: JSON.stringify({ old_password: genPass, new_password: 'Topcell11' })
        });
        
        console.log('✅ Topcell111 is ready with password Topcell11');

    } catch (e) { console.error(e); }
})();
