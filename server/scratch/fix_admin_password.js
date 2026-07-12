import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function runQuery(cloudUrl, sql, params) {
    const response = await fetch(`${cloudUrl}/api/license/sync-query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-sync-secret': SYNC_SECRET
        },
        body: JSON.stringify({ sql, params })
    });
    return response.json();
}

async function main() {
    // The correct bcrypt hash for password "admin123"
    const passwordHash = '$2b$10$8ppAMh8bQSJ16fkYAgea8O5n1PVM4MYDgBmjK9MEc8EePQ6vTtckm';

    const sql = `
        UPDATE users
        SET
          organization_id = (SELECT organization_id FROM licenses WHERE license_key = '0FF6-0343-932A-BC00' LIMIT 1),
          license_id      = (SELECT id FROM licenses WHERE license_key = '0FF6-0343-932A-BC00' LIMIT 1),
          password_hash   = $1,
          is_active       = true
        WHERE LOWER(username) = 'admin'
        RETURNING id, username, license_id, organization_id, LEFT(password_hash,15) AS hash_preview
    `;

    for (const url of CLOUD_URLS) {
        console.log(`\n--- ${url} ---`);
        try {
            const data = await runQuery(url, sql, [passwordHash]);
            if (data.success) {
                console.log('✅ Updated rows:', data.rowCount);
                console.log(JSON.stringify(data.rows, null, 2));
            } else {
                console.log('❌ Error:', JSON.stringify(data));
            }
        } catch (err) {
            console.error('❌ Fetch error:', err.message);
        }
    }
}

main();
