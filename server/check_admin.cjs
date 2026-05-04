const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Global Admin ---');
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        
        if (loginRes.ok) {
            console.log('✅ Global Admin Access! We can fix anything.');
        } else {
            console.log('❌ admin/admin failed.');
        }
    } catch (e) { console.error(e); }
})();
