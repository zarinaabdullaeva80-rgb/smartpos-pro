import pool from '../src/config/database.js';

async function deepAudit() {
    const tables = [
        // Base Tables
        'products', 'sales', 'purchases', 'customers', 'users', 
        'bank_accounts', 'payments', 'transactions', 'counterparties', 
        'warehouses', 'product_categories', 'uom', 'inventory_movements',
        'sales_drafts', 'sale_items', 'purchase_items', 'shifts',
        
        // Modules
        'contracts', 'deliveries', 'serial_numbers', 'product_expiry', 
        'product_bundles', 'bundle_items', 'modifier_groups', 
        'modifiers', 'product_modifiers', 'product_variants', 
        'variant_modifiers', 'preorders', 'preorder_items', 
        'installment_plans', 'installment_sales', 'installment_payments', 
        'customer_deposits', 'deposit_usage', 'tips', 
        'tip_distributions', 'tip_settings', 'gift_certificates', 
        'gift_certificate_usage', 'birthday_campaigns', 'sms_campaigns', 
        'referrals', 'achievements', 'customer_achievements', 
        'reviews', 'wishlists', 'wishlist_items', 'work_schedules', 
        'backups', 'equipment', 'keyboard_shortcuts', 'user_configurations',
        
        // Missing ones found
        'sync_log', 'sync_settings'
    ];

    console.log('--- DEEP SaaS ISOLATION AUDIT ---');
    console.log(`Auditing ${tables.length} tables...`);

    let columnViolations = 0;
    let dataViolations = 0;

    for (const table of tables) {
        try {
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                ) as exists
            `, [table]);

            if (!tableCheck.rows[0].exists) {
                // Table doesn't exist, skip
                continue;
            }

            const colCheck = await pool.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'organization_id'
            `, [table]);

            if (colCheck.rows.length === 0) {
                console.error(`🔴 MISSING COLUMN: "${table}"`);
                columnViolations++;
                continue;
            }

            const nullCheck = await pool.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE organization_id IS NULL`);
            const count = parseInt(nullCheck.rows[0].cnt);

            if (count > 0) {
                console.error(`❌ DATA LEAK: "${table}" has ${count} NULL organization_id records!`);
                dataViolations += count;
            }
        } catch (err) {
            console.warn(`[SKIP] "${table}" error: ${err.message}`);
        }
    }

    console.log('\n--- AUDIT RESULTS ---');
    console.log(`Column Violations: ${columnViolations}`);
    console.log(`Data Violations: ${dataViolations}`);
    
    if (columnViolations === 0 && dataViolations === 0) {
        console.log('✅ DATABASE FULLY ISOLATED.');
    } else {
        console.log('⚠️ ACTION REQUIRED: Database isolation incomplete.');
    }
}

deepAudit().catch(console.error);
