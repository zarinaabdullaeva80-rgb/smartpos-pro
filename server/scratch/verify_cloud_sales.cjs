const fetch = require('node-fetch');

async function checkCloudSales() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT id, document_number, source_device, synced_to_desktop, organization_id FROM sales WHERE document_number LIKE 'TEST-PULL-%' ORDER BY id DESC LIMIT 5"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkCloudSales();
