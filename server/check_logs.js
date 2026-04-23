import fetch from 'node-fetch';

const RAILWAY_API = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function check() {
    console.log('📜 Latest Logs & Errors from Railway:');
    
    const resLogs = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'get_logs' })
    });
    const dataLogs = await resLogs.json();
    console.log('\n--- API LOGS ---');
    console.log(JSON.stringify(dataLogs.results?.logs || [], null, 2));

    const resErrors = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'get_errors' })
    });
    const dataErrors = await resErrors.json();
    console.log('\n--- ERROR LOGS ---');
    console.log(JSON.stringify(dataErrors.results?.errors || [], null, 2));
}

check();
