const fetch = require('node-fetch');

async function testInsert() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "INSERT INTO sales (document_number, final_amount, source_device, organization_id, status, created_at) VALUES ('DEBUG-123', 10, 'mobile', 142, 'confirmed', NOW()) RETURNING id"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testInsert();
