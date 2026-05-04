const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        // 1. Get License Key from Topcell1
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Try to find license key in settings or organization info
        const orgRes = await fetch('https://smartpos-pro-production.up.railway.app/api/organizations', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const orgs = await orgRes.json();
        console.log('Organizations:', JSON.stringify(orgs));

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
