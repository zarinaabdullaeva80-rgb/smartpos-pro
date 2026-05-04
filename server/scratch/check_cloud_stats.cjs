const fetch = require('node-fetch');

async function checkCloud() {
    const url = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
    const secret = 'smartpos-sync-key-2026';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': secret
            },
            body: JSON.stringify({ action: 'get_stats' })
        });
        const result = await response.json();
        console.log('Cloud Stats:', result);
    } catch (err) {
        console.error('Cloud check failed:', err.message);
    }
}

checkCloud();
