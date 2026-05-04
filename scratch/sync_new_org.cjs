const pg = require('pg');

const RAILWAY_URL = 'https://smartpos-pro-production-f885.up.railway.app/api';
const SYNC_SECRET_KEY = 'smartpos-sync-key-2026';

async function syncOrgAndLicense() {
    // 1. Get local data
    const localPool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });
    
    const orgResult = await localPool.query('SELECT * FROM organizations WHERE id = 13');
    const licResult = await localPool.query('SELECT * FROM licenses WHERE organization_id = 13');
    const usersResult = await localPool.query('SELECT * FROM users WHERE organization_id = 13');
    const whResult = await localPool.query('SELECT * FROM warehouses WHERE organization_id = 13');
    const prodResult = await localPool.query('SELECT * FROM products WHERE organization_id = 13');
    
    console.log('Local org:', orgResult.rows[0]?.name);
    console.log('Local license:', licResult.rows[0]?.license_key, 'status:', licResult.rows[0]?.status);
    console.log('Local users:', usersResult.rows.length);
    console.log('Local warehouses:', whResult.rows.length);
    console.log('Local products:', prodResult.rows.length);
    
    // 2. Check what exists in cloud
    const cloudLicCheck = await fetch(RAILWAY_URL + '/license/resolve?key=B5F3-87E6-20F4-7B7A');
    const cloudLicData = await cloudLicCheck.json();
    console.log('\nCloud license check:', JSON.stringify(cloudLicData));
    
    // 3. Sync organization via bulk-import
    const orgPayload = {
        organizations: orgResult.rows,
        licenses: licResult.rows,
        users: usersResult.rows,
        warehouses: whResult.rows,
        products: prodResult.rows
    };
    
    console.log('\nSyncing to cloud...');
    const syncResp = await fetch(RAILWAY_URL + '/sync/bulk-import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': SYNC_SECRET_KEY
        },
        body: JSON.stringify(orgPayload)
    });
    
    const syncData = await syncResp.json();
    console.log('Sync result:', JSON.stringify(syncData, null, 2));
    
    // 4. Verify
    const verifyResp = await fetch(RAILWAY_URL + '/license/resolve?key=B5F3-87E6-20F4-7B7A');
    const verifyData = await verifyResp.json();
    console.log('\nVerification:', JSON.stringify(verifyData, null, 2));
    
    await localPool.end();
}

syncOrgAndLicense().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
