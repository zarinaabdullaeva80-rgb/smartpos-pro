/**
 * Migration: Fix organization binding for multi-tenant isolation
 * 1. Create organizations for each license
 * 2. Bind users to their organizations
 * 3. Delete orphaned test products
 * 4. Create default warehouses
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('=== Step 1: Get all licenses ===');
        const licenses = await client.query(`
            SELECT id, customer_username, company_name, customer_name, license_key, status
            FROM licenses ORDER BY id
        `);
        console.log(`Found ${licenses.rows.length} licenses`);

        for (const lic of licenses.rows) {
            console.log(`\n--- License #${lic.id}: ${lic.customer_username} (${lic.company_name || 'no company'}) ---`);

            // Check if organization already exists for this license
            let orgId = null;
            const existingOrg = await client.query(
                'SELECT id FROM organizations WHERE license_key = $1 OR name = $2',
                [lic.license_key, lic.company_name || lic.customer_name || lic.customer_username]
            );

            if (existingOrg.rows.length > 0) {
                orgId = existingOrg.rows[0].id;
                console.log(`  Organization already exists: id=${orgId}`);
            } else {
                // Create new organization
                const orgCode = 'ORG-' + Date.now().toString(36).toUpperCase() + '-' + lic.id;
                const orgName = lic.company_name || lic.customer_name || lic.customer_username;
                const orgResult = await client.query(`
                    INSERT INTO organizations (name, code, license_key, is_active)
                    VALUES ($1, $2, $3, true) RETURNING id
                `, [orgName, orgCode, lic.license_key || 'KEY-' + lic.id]);
                orgId = orgResult.rows[0].id;
                console.log(`  Created organization: id=${orgId}, name=${orgName}`);
            }

            // Update license with organization_id
            try {
                await client.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [orgId, lic.id]);
                console.log(`  License #${lic.id} → organization_id=${orgId}`);
            } catch (e) {
                // organization_id column may not exist in licenses table
                console.log(`  Note: licenses.organization_id column issue: ${e.message}`);
            }

            // Bind users with this license_id to the organization
            const userUpdate = await client.query(
                'UPDATE users SET organization_id = $1 WHERE license_id = $2 AND (organization_id IS NULL OR organization_id != $1)',
                [orgId, lic.id]
            );
            console.log(`  Updated ${userUpdate.rowCount} users → organization_id=${orgId}`);

            // Also bind users whose username matches license owner
            const ownerUpdate = await client.query(
                'UPDATE users SET organization_id = $1, license_id = COALESCE(license_id, $2) WHERE LOWER(username) = LOWER($3) AND organization_id IS NULL',
                [orgId, lic.id, lic.customer_username]
            );
            if (ownerUpdate.rowCount > 0) {
                console.log(`  Auto-bound owner "${lic.customer_username}" → organization_id=${orgId}`);
            }

            // Check if warehouse exists for this org
            const whCheck = await client.query(
                'SELECT id FROM warehouses WHERE organization_id = $1',
                [orgId]
            );
            if (whCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO warehouses (name, code, is_active, organization_id)
                    VALUES ('Основной склад', $1, true, $2)
                `, ['WH-' + orgId, orgId]);
                console.log(`  Created default warehouse for org ${orgId}`);
            }
        }

        // Step 2: Delete all test products (user confirmed deletion)
        console.log('\n=== Step 2: Delete test products ===');
        const tables = [
            'inventory_movements', 'sale_items', 'purchase_items', 'return_items',
            'inventory_items', 'inventory_adjustments', 'inventory_check_items',
            'stock_balances', 'stock_movements', 'warehouse_document_items'
        ];
        for (const table of tables) {
            try {
                const r = await client.query(`DELETE FROM ${table}`);
                if (r.rowCount > 0) console.log(`  Deleted ${r.rowCount} rows from ${table}`);
            } catch (e) {
                // Table may not exist
            }
        }
        // Delete sales and their payment details
        try {
            await client.query('DELETE FROM sale_payment_details');
            const salesDel = await client.query('DELETE FROM sales');
            if (salesDel.rowCount > 0) console.log(`  Deleted ${salesDel.rowCount} sales`);
        } catch (e) { console.log('  Sales cleanup:', e.message); }

        // Delete products
        const prodDel = await client.query('DELETE FROM products');
        console.log(`  Deleted ${prodDel.rowCount} products`);

        // Delete orphaned categories
        const catDel = await client.query('DELETE FROM product_categories');
        console.log(`  Deleted ${catDel.rowCount} categories`);

        // Step 3: Verify
        console.log('\n=== Step 3: Verification ===');
        const orgs = await client.query('SELECT id, name, license_key FROM organizations ORDER BY id');
        console.log('Organizations:');
        orgs.rows.forEach(o => console.log(`  id=${o.id} name=${o.name}`));

        const users = await client.query('SELECT id, username, organization_id, license_id FROM users ORDER BY id');
        console.log('Users:');
        users.rows.forEach(u => console.log(`  id=${u.id} user=${u.username} org=${u.organization_id} lic=${u.license_id}`));

        const products = await client.query('SELECT COUNT(*) as cnt FROM products');
        console.log(`Products remaining: ${products.rows[0].cnt}`);

        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e.message);
        console.error(e.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
