const fetch = require('node-fetch');

const CLOUD_URL = 'https://smartpos-pro-production.up.railway.app/api';
const SYNC_SECRET = 'smartpos-sync-key-2026';
const LICENSE_KEY = 'B37A-BC8C-9288-BC3A';
const LOCAL_ORG_ID = 10; // local org for this license

async function testFullPullLoop() {
    console.log('--- Testing Full Cloud-to-Local Pull Loop ---');
    
    // 1. Insert a "mobile" sale into cloud DB
    const docNum = `TEST-PULL-${Date.now()}`;
    const insertRes = await fetch(`${CLOUD_URL}/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({
            action: 'run_sql',
            sql: `INSERT INTO sales (document_number, final_amount, total_amount, source_device, organization_id, status, created_at) VALUES ('${docNum}', 150, 150, 'mobile', 10, 'confirmed', NOW())`
        })
    });
    const insertData = await insertRes.json();
    console.log('Insert sale:', insertData.results?.success ? '✅' : '❌', JSON.stringify(insertData.results));

    // 2. Pull using the FIXED function (with localOrgId)
    console.log('\nTriggering pull with localOrgId...');
    const { pullSalesFromCloud } = await import('../src/services/cloudPull.js');
    const pullResult = await pullSalesFromCloud(LICENSE_KEY, LOCAL_ORG_ID);
    console.log('Pull result:', JSON.stringify(pullResult, null, 2));

    // 3. Verify locally
    const { default: pool } = await import('../src/config/database.js');
    const localRes = await pool.query('SELECT id, document_number, organization_id, source_device FROM sales WHERE document_number = $1', [docNum]);
    if (localRes.rows.length > 0) {
        console.log(`\n✅ SUCCESS: Sale ${docNum} found locally!`);
        console.log('Details:', JSON.stringify(localRes.rows[0]));
    } else {
        console.log(`\n❌ FAILURE: Sale ${docNum} not found locally.`);
    }

    process.exit(0);
}

testFullPullLoop();
