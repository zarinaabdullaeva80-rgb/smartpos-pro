import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function run() {
    for (const cloudUrl of CLOUD_URLS) {
        try {
            console.log(`\n--- Fetching users from ${cloudUrl} ---`);
            const response = await fetch(`${cloudUrl}/api/license/sync-pull-users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sync-secret': SYNC_SECRET
                }
            });
            const data = await response.json();
            if (data.success) {
                console.log(`Total users on cloud: ${data.users.length}`);
                console.log(data.users);
            } else {
                console.log('Error:', data);
            }
        } catch (err) {
            console.error('Fetch failed:', err.message);
        }
    }
}

run();
