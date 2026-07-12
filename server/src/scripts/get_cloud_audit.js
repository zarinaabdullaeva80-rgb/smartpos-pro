import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function run() {
    for (const cloudUrl of CLOUD_URLS) {
        try {
            console.log(`\n--- Fetching login attempts from ${cloudUrl} ---`);
            const response = await fetch(`${cloudUrl}/api/license/sync-pull-users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sync-secret': SYNC_SECRET
                }
            });
            const data = await response.json();
            // Let's modify the endpoint on the cloud dynamically to run custom queries or query database.
            // Since we can't easily run custom code there without deploy, we can deploy a temporary route.
        } catch (err) {
            console.error('Fetch failed:', err.message);
        }
    }
}
