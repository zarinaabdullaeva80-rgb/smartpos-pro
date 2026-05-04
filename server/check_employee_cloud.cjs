const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Employee Topcell11 on Cloud ---');
        
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell11', password: 'Topcell11' })
        });
        
        if (loginRes.ok) {
            const data = await loginRes.json();
            console.log('✅ Topcell11 exists on Cloud! Org ID:', data.user.organization_id);
        } else {
            const err = await loginRes.json();
            console.log('❌ Topcell11 login failed:', err.error);
            
            // Try to find him locally to clone to cloud
            const pg = require('pg');
            const pool = new pg.Pool({
                connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
            });
            const localUser = await pool.query('SELECT * FROM users WHERE username = $1', ['Topcell11']);
            await pool.end();

            if (localUser.rows.length > 0) {
                console.log('Found Topcell11 LOCALLY. Need to create him in the cloud.');
                // To create him in the cloud, I need an admin token for Org 142.
                // I have it from Topcell1!
            } else {
                console.log('Topcell11 not found LOCALLY either.');
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
