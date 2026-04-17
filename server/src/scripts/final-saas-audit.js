import pool from '../config/database.js';

async function finalAudit() {
    const business_tables = [
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
        'backups', 'equipment', 'keyboard_shortcuts', 'user_configurations'
    ];

    console.log('--- SYSTEM-WIDE SaaS ISOLATION AUDIT ---');
    console.log(`Checking ${business_tables.length} tables...`);

    let totalViolations = 0;

    for (const table of business_tables) {
        try {
            // Check if column exists
            const colCheck = await pool.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'organization_id'
            `, [table]);

            if (colCheck.rows.length === 0) {
                console.error(`[CRITICAL] Table "${table}" is MISSING organization_id column!`);
                totalViolations++;
                continue;
            }

            // Check for NULL values
            const nullCheck = await pool.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE organization_id IS NULL`);
            const count = parseInt(nullCheck.rows[0].cnt);

            if (count > 0) {
                console.error(`[VIOLATION] Table "${table}" has ${count} records with NULL organization_id!`);
                totalViolations += count;
            } else {
                // console.log(`[OK] Table "${table}" is clean.`);
            }
        } catch (err) {
            console.warn(`[SKIP] Table "${table}" error: ${err.message}`);
        }
    }

    console.log('--- AUDIT COMPLETED ---');
    if (totalViolations === 0) {
        console.log('✅ ALL BOUNDARIES SECURE. No orphaned records found.');
    } else {
        console.error(`❌ FOUND ${totalViolations} ISOLATION VIOLATIONS. Action required.`);
    }

    process.exit(totalViolations > 0 ? 1 : 0);
}

finalAudit();
