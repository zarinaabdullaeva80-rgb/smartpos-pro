const fetch = require('node-fetch');

// Update cloud product quantities based on local data
// We'll send quantities for all organizations that have inventory

async function updateCloudQuantities() {
    console.log('=== Updating cloud product quantities ===\n');

    // 1. Get local products with quantities using dynamic import
    const { default: pool } = await import('../src/config/database.js');
    
    const localRes = await pool.query(`
        SELECT p.code, p.organization_id,
               COALESCE((
                 SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                ELSE im.quantity END)
                 FROM inventory_movements im WHERE im.product_id = p.id
               ), 0) AS quantity
        FROM products p
        WHERE p.is_active = true OR p.is_active IS NULL
    `);
    
    console.log(`Found ${localRes.rows.length} local products`);
    
    // 2. Get license mapping (local org -> cloud org via license key)
    const licRes = await pool.query('SELECT license_key, organization_id FROM licenses WHERE is_active = true');
    const licenseMap = {};
    for (const l of licRes.rows) {
        if (l.organization_id) licenseMap[l.organization_id] = l.license_key;
    }
    console.log('License map:', JSON.stringify(licenseMap));
    
    // 3. Group products by org
    const byOrg = {};
    for (const p of localRes.rows) {
        if (!byOrg[p.organization_id]) byOrg[p.organization_id] = [];
        byOrg[p.organization_id].push({ code: p.code, quantity: parseFloat(p.quantity) });
    }
    
    // 4. For each org, get the cloud org_id via license and build SQL UPDATE
    for (const [localOrgId, products] of Object.entries(byOrg)) {
        const licenseKey = licenseMap[localOrgId];
        if (!licenseKey) {
            console.log(`  Skip org ${localOrgId}: no license`);
            continue;
        }
        
        // Find cloud org_id for this license
        const cloudRes = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': 'smartpos-sync-key-2026' },
            body: JSON.stringify({
                action: 'run_sql',
                sql: `SELECT organization_id FROM licenses WHERE license_key = '${licenseKey}' LIMIT 1`
            })
        });
        const cloudData = await cloudRes.json();
        const cloudOrgId = cloudData.results?.rows?.[0]?.organization_id;
        if (!cloudOrgId) {
            console.log(`  Skip org ${localOrgId}: license ${licenseKey} not found on cloud`);
            continue;
        }
        
        console.log(`\n  Org ${localOrgId} -> Cloud org ${cloudOrgId} (license ${licenseKey})`);
        console.log(`  Updating ${products.length} products...`);
        
        // Build a batch UPDATE SQL
        const updates = products
            .filter(p => p.code && p.quantity > 0)
            .map(p => `UPDATE products SET quantity = ${p.quantity} WHERE code = '${p.code.replace(/'/g, "''")}' AND organization_id = ${cloudOrgId};`)
            .join('\n');
        
        if (!updates) {
            console.log('  No products with quantity > 0');
            continue;
        }
        
        const updateRes = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': 'smartpos-sync-key-2026' },
            body: JSON.stringify({ action: 'run_sql', sql: updates })
        });
        const updateData = await updateRes.json();
        console.log(`  Result:`, updateData.results?.success ? '✅ OK' : '❌ ' + JSON.stringify(updateData));
    }
    
    // 5. Verify
    const verifyRes = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': 'smartpos-sync-key-2026' },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT organization_id, COUNT(*) as total, COUNT(CASE WHEN quantity > 0 THEN 1 END) as with_stock FROM products GROUP BY organization_id ORDER BY total DESC"
        })
    });
    const verifyData = await verifyRes.json();
    console.log('\n=== Cloud verification ===');
    console.log(JSON.stringify(verifyData.results?.rows, null, 2));
    
    process.exit(0);
}

updateCloudQuantities();
