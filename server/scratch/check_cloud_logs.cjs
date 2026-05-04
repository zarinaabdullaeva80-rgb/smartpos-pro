const fetch = require('node-fetch');

async function checkCloudLogs() {
    const url = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
    const secret = 'smartpos-sync-key-2026';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': secret
            },
            body: JSON.stringify({ action: 'get_logs' })
        });
        const result = await response.json();
        console.log('Cloud Logs:', JSON.stringify(result.results.logs, null, 2));
    } catch (err) {
        console.error('Cloud logs check failed:', err.message);
    }
}

checkCloudLogs();
