import fetch from 'node-fetch';

const RAILWAY_API = 'https://smartpos-pro-production.app.railway.app'; // Wait, it's .up.railway.app
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function check(dirPath) {
    console.log(`📂 Listing files in ${dirPath || 'CWD'}:`);
    const res = await fetch(`https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'list_files', path: dirPath })
    });
    const data = await res.json();
    console.log(JSON.stringify(data.results, null, 2));
}

async function run() {
    await check(); // CWD
    await check('/app'); // Railway common path
    await check('/app/client-accounting/dist');
    await check('/app/server/dist');
}

run();
