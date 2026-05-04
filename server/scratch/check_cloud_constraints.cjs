const fetch = require('node-fetch');

async function checkCloudConstraints() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'products'::regclass"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkCloudConstraints();
