const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Creating Employee Topcell11 in Cloud ---');
        
        // 1. Register User (Public endpoint)
        const regRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Topcell11',
                password: 'Topcell11',
                email: 'topcell11@example.com',
                fullName: 'Сотрудник Topcell'
            })
        });
        
        if (!regRes.ok) {
            const err = await regRes.json();
            console.log('Registration Error:', err.error);
            if (err.error !== 'Пользователь уже существует') {
                return;
            }
        } else {
            console.log('✅ User registered successfully!');
        }

        // 2. Login as OWNER (Topcell1) to get Token
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        const orgId = loginData.user.organization_id;
        console.log(`Logged in as Owner. Org ID: ${orgId}`);

        // 3. Find the new user's ID
        // Note: we can't search easily, but we can try to find in the employees list
        const usersRes = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const usersData = await usersRes.json();
        const newUser = usersData.users.find(u => u.username === 'Topcell11');

        if (!newUser) {
            console.log('Could not find Topcell11 in user list. Maybe he is in another org?');
            return;
        }
        console.log(`Found Topcell11 ID: ${newUser.id}`);

        // 4. Update the user: assign Organization and Role
        // We need a Role ID. Let's find "Кассир" or "Менеджер"
        const rolesRes = await fetch('https://smartpos-pro-production.up.railway.app/api/users/roles', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const rolesData = await rolesRes.json();
        const role = rolesData.roles.find(r => r.name === 'Кассир' || r.name === 'Менеджер' || r.name === 'admin') || rolesData.roles[0];
        console.log(`Using Role: ${role.name} (ID: ${role.id})`);

        // Update call (manual SQL-like via update endpoint if it allows org change)
        // Actually, the server's users.put code (lines 97-103) strictly uses CURRENT orgId.
        // If we registered without orgId, he might be "orphaned".
        
        // Let's try to update him
        const updateRes = await fetch(`https://smartpos-pro-production.up.railway.app/api/users/${newUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                fullName: 'Сотрудник Topcell (Active)',
                isActive: true,
                roleId: role.id,
                email: 'topcell11@example.com'
            })
        });

        if (updateRes.ok) {
            console.log('✅ Employee Topcell11 activated and linked to organization!');
        } else {
            console.log('Update Failed:', await updateRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
