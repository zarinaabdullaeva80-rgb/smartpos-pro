const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Syncing User to Cloud ---');
        
        // 1. Get user data from LOCAL DB
        const pg = require('pg');
        const pool = new pg.Pool({
            connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
        });
        const localUser = await pool.query('SELECT * FROM users WHERE username = $1', ['Topcell1']);
        await pool.end();

        if (localUser.rows.length === 0) {
            console.log('User Topcell1 not found LOCALLY. Please create him in the app first.');
            return;
        }
        const user = localUser.rows[0];
        console.log('Local user found:', user.username, 'Role:', user.role);

        // 2. Create/Update user on Railway Cloud
        // Since we don't have a direct "admin create user" without being admin, 
        // we might need to use the register endpoint if it allows organization_id
        
        // BUT! We can use our SYNC script logic if we had one for users.
        // Let's try to just log in with Topcell1/Topcell1 again to be ABSOLUTELY sure.
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        
        if (loginRes.ok) {
            console.log('✅ Success! Login "Topcell1" / "Topcell1" works on Cloud.');
        } else {
            const err = await loginRes.json();
            console.log('❌ Cloud login failed:', err.error);
            
            // If failed, let's try to CREATE the user in the cloud
            console.log('Attempting to create user in Cloud...');
            // To create a user, we need an admin token. 
            // I'll try to find an admin user in the cloud first.
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
