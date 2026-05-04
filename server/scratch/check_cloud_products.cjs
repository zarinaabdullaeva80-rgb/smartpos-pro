const fetch = require('node-fetch');

async function checkCloudProducts() {
    const url = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
    const secret = 'smartpos-sync-key-2026';

    try {
        // Check total products
        const res1 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': secret },
            body: JSON.stringify({ action: 'run_sql', sql: "SELECT organization_id, COUNT(*) as cnt FROM products GROUP BY organization_id ORDER BY cnt DESC LIMIT 20" })
        });
        const r1 = await res1.json();
        console.log('Products by org:', r1.results.rows);

        // Check which orgs have users
        const res2 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': secret },
            body: JSON.stringify({ action: 'run_sql', sql: "SELECT u.id, u.username, u.organization_id, u.license_id, o.name as org_name FROM users u LEFT JOIN organizations o ON o.id = u.organization_id ORDER BY u.id DESC LIMIT 20" })
        });
        const r2 = await res2.json();
        console.log('\nUsers on cloud:', r2.results.rows);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkCloudProducts();
