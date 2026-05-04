const fetch = require('node-fetch');

async function setupTestData() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "INSERT INTO products (name, code, price_sale, organization_id, is_active) VALUES ('Test Product', 'T001', 100, 1, true) ON CONFLICT (code, organization_id) DO UPDATE SET name = EXCLUDED.name"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

setupTestData();
