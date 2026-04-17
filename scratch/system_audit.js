import pool from '../server/src/config/database.js';

async function fullSystemAudit() {
    console.log('--- STARTING COMPREHENSIVE MULTI-TENANT AUDIT ---');
    
    const tables = [
        'users', 'products', 'product_categories', 'warehouses', 'stock_balances',
        'sales', 'inventory_movements', 'sync_settings', 'sync_log', 
        'external_id_mapping', 'customers', 'suppliers'
    ];

    console.log('\n[1] Orphaned Records Check (NULL organization_id):');
    for (const table of tables) {
        try {
            const countRes = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
            const nullRes = await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE organization_id IS NULL`);
            const total = countRes.rows[0].count;
            const orphaned = nullRes.rows[0].count;
            
            if (orphaned > 0) {
                console.log(`[!] ${table.padEnd(20)}: ${orphaned.padStart(5)} / ${total.padStart(5)} records are ORPHANED (HIDDEN)`);
            } else {
                console.log(`[+] ${table.padEnd(20)}: All ${total} records are correctly tagged.`);
            }
        } catch (e) {
            console.log(`[?] ${table.padEnd(20)}: Table check failed or organization_id missing.`);
        }
    }

    console.log('\n[2] High-Risk Global Routes Check (Search for missing WHERE org_id):');
    // This is a manual check I'll perform by reading files, but I'll list the files here to keep track
    const filesToAudit = [
        'server/src/routes/analytics.js',
        'server/src/routes/reports.js',
        'server/src/routes/dashboard.js',
        'server/src/routes/customers.js'
    ];
    console.log('Files scheduled for manual inspection:', filesToAudit);

    process.exit(0);
}

fullSystemAudit();
