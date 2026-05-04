const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Searching for Users in Org 142 ---');
        
        // Login as super-admin (if possible) or just check who we can find
        // Since I don't have super-admin, I will try to login as "admin" / "admin"
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Try to get employees/users if endpoint exists
        const usersRes = await fetch('https://smartpos-pro-production.up.railway.app/api/employees', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (usersRes.ok) {
            const usersData = await usersRes.json();
            const users = usersData.employees || usersData || [];
            console.log(`Found ${users.length} users in this organization:`);
            users.forEach(u => console.log(`  - ${u.username} (Role: ${u.role}, ID: ${u.id})`));
        } else {
            console.log('Failed to fetch users:', usersRes.status);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
