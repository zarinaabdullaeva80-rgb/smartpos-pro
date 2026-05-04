const fetch = require('node-fetch');

async function checkCloudSchema() {
    const url = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
    const secret = 'smartpos-sync-key-2026';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': secret
            },
            body: JSON.stringify({ 
                action: 'run_sql', 
                sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name" 
            })
        });
        const result = await response.json();
        console.log('Cloud Users Schema:', result.results.rows);
    } catch (err) {
        console.error('Cloud schema check failed:', err.message);
    }
}

checkCloudSchema();
