const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Fixing Topcell11 with Admin Privileges ---');
        
        // 1. Login as Super Admin
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const token = (await loginRes.json()).token;

        // 2. Search for Topcell11 in ALL users
        const usersRes = await fetch('https://smartpos-pro-production.up.railway.app/api/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const usersData = await usersRes.json();
        const target = usersData.users.find(u => u.username === 'Topcell11');

        if (!target) {
            console.log('User Topcell11 not found in global list.');
            return;
        }
        console.log(`Found Topcell11 (ID: ${target.id}, Current Org: ${target.organization_id})`);

        // 3. Find Organization ID 142 (Mobile City)
        // (I know it's 142 from previous steps, but let's be sure)
        const owner = usersData.users.find(u => u.username === 'Topcell1');
        const realOrgId = owner.organization_id;
        console.log(`Target Organization ID: ${realOrgId}`);

        // 4. UPDATE Topcell11 - the users.put route might have restriction on org change
        // but we are SUPER ADMIN.
        // Let's try to update him.
        const updateRes = await fetch(`https://smartpos-pro-production.up.railway.app/api/users/${target.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({
                organization_id: realOrgId, // Try to force it
                fullName: 'Сотрудник Mobile City',
                isActive: true
            })
        });
        
        console.log('Update Status:', updateRes.status);
        if (updateRes.ok) {
            console.log('✅ Topcell11 updated successfully!');
        } else {
            console.log('Update Failed:', await updateRes.text());
        }

        // 5. Verify by logging in as Topcell11
        const empLogin = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
        });
        const empData = await empLogin.json();
        console.log('Final Employee OrgID:', empData.user.organization_id);

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
