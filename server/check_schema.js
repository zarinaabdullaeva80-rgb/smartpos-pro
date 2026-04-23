import fetch from 'node-fetch';

const RAILWAY_API = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function check(table) {
    console.log(`📊 Schema for ${table}:`);
    const res = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'get_schema', table })
    });
    const data = await res.json();
    console.log(JSON.stringify(data.results?.schema || [], null, 2));
}

async function run() {
    await check('products');
    await check('inventory_movements');
}

run();
