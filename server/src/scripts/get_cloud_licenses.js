import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function run() {
    for (const cloudUrl of CLOUD_URLS) {
        try {
            console.log(`\n--- Fetching licenses from ${cloudUrl} ---`);
            const response = await fetch(`${cloudUrl}/api/license/sync-pull-licenses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sync-secret': SYNC_SECRET
                }
            });
            const data = await response.json();
            if (data.success) {
                console.log(`Total licenses on cloud: ${data.licenses.length}`);
                const b5f3 = data.licenses.find(l => l.license_key === 'B5F3-87E6-20F4-7B7A');
                if (b5f3) {
                    console.log('Found key B5F3-87E6-20F4-7B7A:');
                    console.log(b5f3);
                } else {
                    console.log('Key B5F3-87E6-20F4-7B7A not found in cloud!');
                }
            } else {
                console.log('Error:', data);
            }
        } catch (err) {
            console.error('Fetch failed:', err.message);
        }
    }
}

run();
