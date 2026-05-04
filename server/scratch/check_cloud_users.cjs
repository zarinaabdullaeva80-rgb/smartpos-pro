const fetch = require('node-fetch');

async function checkCloudUsers() {
    const url = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
    const secret = 'smartpos-sync-key-2026';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': secret },
        body: JSON.stringify({ 
            action: 'run_sql', 
            sql: `SELECT u.id, u.username, u.organization_id, u.license_id, u.role, u.is_active,
                         o.name as org_name, 
                         LENGTH(u.password_hash) as pw_len,
                         (SELECT COUNT(*) FROM products p WHERE p.organization_id = u.organization_id) as product_count
                  FROM users u 
                  LEFT JOIN organizations o ON o.id = u.organization_id
                  ORDER BY u.id DESC`
        })
    });
    const data = await res.json();
    console.table(data.results.rows);
}

checkCloudUsers();
