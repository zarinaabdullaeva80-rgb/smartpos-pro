const pg = require('pg');

const RAILWAY_URL = 'https://smartpos-pro-production-f885.up.railway.app/api';
const CLOUD_SYNC_SECRET = 'smartpos-sync-key-2026';

async function syncOrgAndLicense() {
    const localPool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });
    
    const orgResult = await localPool.query('SELECT * FROM organizations WHERE id = 13');
    const licResult = await localPool.query('SELECT * FROM licenses WHERE organization_id = 13');
    
    const org = orgResult.rows[0];
    const lic = licResult.rows[0];
    
    console.log('Organization:', org.name, '(id:', org.id, ')');
    console.log('License:', lic.license_key, 'status:', lic.status, 'expires:', lic.expires_at);
    
    // Use the /license/sync endpoint which handles full org+license creation
    console.log('\n--- Syncing via /license/sync endpoint ---');
    const syncResp = await fetch(RAILWAY_URL + '/license/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': CLOUD_SYNC_SECRET },
        body: JSON.stringify({
            license_key: lic.license_key,
            customer_name: org.name,
            customer_username: org.name.replace(/\s+/g, ''),
            customer_password_hash: '$2b$10$placeholder',
            company_name: org.name,
            license_type: lic.license_type || 'standard',
            max_devices: lic.max_devices || 3,
            max_users: lic.max_users || 5,
            expires_at: lic.expires_at,
            status: lic.status,
            is_active: true
        })
    });
    const syncData = await syncResp.json();
    console.log('Sync result:', JSON.stringify(syncData, null, 2));
    
    // Verify
    console.log('\n--- Verifying license resolution ---');
    const verifyResp = await fetch(RAILWAY_URL + '/license/resolve?key=B5F3-87E6-20F4-7B7A');
    const verifyData = await verifyResp.json();
    console.log('Verification:', JSON.stringify(verifyData, null, 2));
    
    await localPool.end();
}

syncOrgAndLicense().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
