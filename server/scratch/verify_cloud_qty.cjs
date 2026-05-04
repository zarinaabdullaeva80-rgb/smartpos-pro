const fetch = require('node-fetch');

async function verifyCloudQuantities() {
    console.log('Checking cloud products with quantity > 0...\n');
    
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': 'smartpos-sync-key-2026' },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT name, quantity FROM products WHERE organization_id = 11 AND quantity > 0 LIMIT 5"
        })
    });
    const data = await res.json();
    console.log('Products with stock (org 11):');
    console.log(JSON.stringify(data.results?.rows, null, 2));
}

verifyCloudQuantities();
