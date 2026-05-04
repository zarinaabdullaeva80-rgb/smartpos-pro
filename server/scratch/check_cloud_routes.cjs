const fetch = require('node-fetch');

async function checkCloudRoutes() {
    const BASE = 'https://smartpos-pro-production.up.railway.app';
    const secret = 'smartpos-sync-key-2026';

    // Test sync-employee route exists
    const endpoints = [
        { name: '/api/license/sync', body: {} },
        { name: '/api/license/sync-employee', body: { username: '__test__' } },
        { name: '/api/license/sync-delete', body: {} },
        { name: '/api/license/admin-cleanup', body: { action: 'get_stats' } },
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(BASE + ep.name, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Secret': secret
                },
                body: JSON.stringify(ep.body)
            });
            const text = await res.text();
            const isHTML = text.startsWith('<!DOCTYPE') || text.startsWith('<html');
            console.log(`${ep.name}: ${res.status} ${isHTML ? '(HTML - route not found)' : text.substring(0, 120)}`);
        } catch (err) {
            console.log(`${ep.name}: ERROR ${err.message}`);
        }
    }
}

checkCloudRoutes();
