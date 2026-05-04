const fetch = require('node-fetch');

async function checkCloudProducts() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT id, name, code, organization_id FROM products WHERE organization_id = 142 LIMIT 10"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkCloudProducts();
