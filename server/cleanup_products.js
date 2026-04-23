const API = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';
const HEADERS = { 'Content-Type': 'application/json', 'X-Sync-Secret': 'smartpos-sync-key-2026' };

async function callAdmin(action, extra = {}) {
    const res = await fetch(API, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ action, ...extra })
    });
    return await res.json();
}

async function waitForDeploy() {
    console.log('Waiting for Railway deploy...');
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        try {
            const res = await fetch('https://smartpos-pro-production.up.railway.app/api/health', { signal: AbortSignal.timeout(5000) });
            const data = await res.json();
            if (data.uptime < 120) { console.log(`Deploy detected! uptime=${Math.round(data.uptime)}s`); return true; }
        } catch(e) { console.log('  Not ready yet...'); }
    }
    return false;
}

async function main() {
    await waitForDeploy();

    // 1. Init tables with all missing columns
    console.log('\n1. Running init_tables...');
    const init = await callAdmin('init_tables');
    console.log('   Result:', JSON.stringify(init));

    // 2. Delete all products
    console.log('\n2. Deleting all products...');
    const del = await callAdmin('delete_all_products');
    console.log('   Result:', JSON.stringify(del));

    // 3. Verify products endpoint works
    console.log('\n3. Verifying products API...');
    const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Nematullo1', password: 'Nematullo1', license_key: '834B-D59B-4D92-3DD0' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const prodData = await prodRes.json();
    console.log(`   Status: ${prodRes.status}, Products: ${prodData.products?.length ?? 'ERROR: ' + JSON.stringify(prodData)}`);

    console.log('\nDone!');
}

main();
