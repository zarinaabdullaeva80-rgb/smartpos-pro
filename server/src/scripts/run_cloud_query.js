import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function run() {
    const sql = process.argv[2] || 'SELECT 1';
    console.log(`Executing SQL on cloud: ${sql}`);

    for (const cloudUrl of CLOUD_URLS) {
        try {
            console.log(`\n--- ${cloudUrl} ---`);
            const response = await fetch(`${cloudUrl}/api/license/sync-query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sync-secret': SYNC_SECRET
                },
                body: JSON.stringify({ sql })
            });
            const data = await response.json();
            if (data.success) {
                console.log(`Rows (${data.rowCount}):`);
                console.log(data.rows);
            } else {
                console.log('Error:', data);
            }
        } catch (err) {
            console.error('Failed:', err.message);
        }
    }
}

run();
