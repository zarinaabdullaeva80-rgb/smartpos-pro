const fetch = require('node-fetch');

async function checkAllCloudProducts() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT DISTINCT organization_id FROM products"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkAllCloudProducts();
