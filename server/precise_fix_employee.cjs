const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- GETTING ID OF TOPCELL11 ---');
        
        // 1. Login as the orphaned Topcell11
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
        });
        
        if (!loginRes.ok) {
            console.log('Could not login as Topcell11. Maybe he doesnt exist or password changed.');
            return;
        }
        
        const data = await loginRes.json();
        const targetId = data.user.id;
        console.log(`FOUND ID: ${targetId}`);

        // 2. Login as Super Admin
        const adminLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const adminToken = (await adminLogin.json()).token;

        // 3. DELETE Topcell11
        const delRes = await fetch(`https://smartpos-pro-production.up.railway.app/api/users/${targetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + adminToken }
        });
        console.log('Delete Status:', delRes.status);

        // 4. Create Properly as Owner
        const ownerLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const ownerToken = (await ownerLogin.json()).token;

        const createRes = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ownerToken },
            body: JSON.stringify({
                username: 'Topcell11',
                fullName: 'Сотрудник Mobile City',
                email: 'topcell11@topcell.com'
            })
        });
        const createData = await createRes.json();
        const genPass = createData.password;
        console.log(`✅ Created Properly! Temp password: ${genPass}`);

        // 5. Set Password back to Topcell11
        const empLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: genPass })
        });
        const empToken = (await empLogin.json()).token;
        await fetch('https://smartpos-pro-production.up.railway.app/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + empToken },
            body: JSON.stringify({ old_password: genPass, new_password: 'Topcell11' })
        });
        console.log('✅ Final Password Set!');

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
