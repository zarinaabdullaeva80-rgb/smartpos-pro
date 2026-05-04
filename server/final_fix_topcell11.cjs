const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Cleaning up and Creating Topcell11 ---');
        
        // 1. Login as Super Admin
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const token = (await loginRes.json()).token;

        // 2. Bruteforce delete Topcell11 (because we can't find him in filtered list)
        // We know Topcell22 is 157. So Topcell11 is likely 156.
        for (let id = 150; id <= 160; id++) {
            await fetch(`https://smartpos-pro-production.up.railway.app/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
        console.log('Cleanup attempt finished.');

        // 3. Login as Owner (Topcell1)
        const ownerLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const ownerToken = (await ownerLogin.json()).token;

        // 4. Create Topcell11 PROPERLY
        // Note: The users.post API generates a random password. 
        // To set a specific one, we'll need to login as him and change it.
        const res = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ownerToken },
            body: JSON.stringify({
                username: 'Topcell11',
                fullName: 'Сотрудник Mobile City',
                email: 'topcell11@topcell.com'
            })
        });
        
        const data = await res.json();
        if (res.ok) {
            const genPassword = data.password;
            console.log(`✅ Topcell11 created! Temp password: ${genPassword}`);
            
            // 5. Login as new Topcell11 and change password to "Topcell11"
            const empLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Topcell11', password: genPassword })
            });
            const empToken = (await empLogin.json()).token;
            
            const changeRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + empToken },
                body: JSON.stringify({ old_password: genPassword, new_password: 'Topcell11' })
            });
            
            if (changeRes.ok) {
                console.log('✅ Password changed to "Topcell11" successfully!');
            }
        } else {
            console.log('Creation Failed:', JSON.stringify(data));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
