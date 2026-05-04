const fetch = require('node-fetch');

async function checkCloudSchema() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkCloudSchema();
