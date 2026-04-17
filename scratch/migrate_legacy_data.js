import pool from '../server/src/config/database.js';

/**
 * PHASE 1: Migrate legacy data — assign NULL organization_id records to Org #1.
 * 
 * This script performs a ONE-TIME data migration:
 * 1. Ensures Organization #1 exists in the organizations table.
 * 2. Assigns all orphaned records (organization_id IS NULL) to Org #1.
 * 3. Adds organization_id column to stock_balances if missing.
 * 4. Prints a summary of changes.
 */

const DEFAULT_ORG_ID = 1;
const DEFAULT_ORG_NAME = 'Основная организация';

async function migrate() {
    const client = await pool.connect();
    console.log('=== PHASE 1: LEGACY DATA MIGRATION ===');
    console.log(`Target organization: ID=${DEFAULT_ORG_ID} ("${DEFAULT_ORG_NAME}")\n`);

    try {
        await client.query('BEGIN');

        // Step 0: Ensure default organization exists
        console.log('[Step 0] Ensuring default organization exists...');
        const orgCheck = await client.query('SELECT id FROM organizations WHERE id = $1', [DEFAULT_ORG_ID]);
        if (orgCheck.rows.length === 0) {
            await client.query(
                'INSERT INTO organizations (id, name, is_active) VALUES ($1, $2, true) ON CONFLICT (id) DO NOTHING',
                [DEFAULT_ORG_ID, DEFAULT_ORG_NAME]
            );
            console.log(`  Created organization "${DEFAULT_ORG_NAME}" with ID=${DEFAULT_ORG_ID}`);
        } else {
            console.log(`  Organization ID=${DEFAULT_ORG_ID} already exists.`);
        }

        // Step 1: Migrate users
        console.log('\n[Step 1] Migrating users...');
        const usersResult = await client.query(
            'UPDATE users SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, username',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${usersResult.rowCount} users assigned to Org #${DEFAULT_ORG_ID}`);
        usersResult.rows.forEach(u => console.log(`    - User: ${u.username} (ID: ${u.id})`));

        // Step 2: Migrate sales
        console.log('\n[Step 2] Migrating sales...');
        const salesResult = await client.query(
            'UPDATE sales SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, document_number',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${salesResult.rowCount} sales assigned to Org #${DEFAULT_ORG_ID}`);
        salesResult.rows.forEach(s => console.log(`    - Sale: ${s.document_number || s.id}`));

        // Step 3: Migrate sync_settings
        console.log('\n[Step 3] Migrating sync_settings...');
        const syncSettingsResult = await client.query(
            'UPDATE sync_settings SET organization_id = $1 WHERE organization_id IS NULL RETURNING id, setting_key',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${syncSettingsResult.rowCount} sync settings assigned to Org #${DEFAULT_ORG_ID}`);

        // Step 4: Migrate sync_log
        console.log('\n[Step 4] Migrating sync_log...');
        const syncLogResult = await client.query(
            'UPDATE sync_log SET organization_id = $1 WHERE organization_id IS NULL RETURNING id',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${syncLogResult.rowCount} sync logs assigned to Org #${DEFAULT_ORG_ID}`);

        // Step 5: Migrate products (safety net)
        console.log('\n[Step 5] Checking products...');
        const productsResult = await client.query(
            'UPDATE products SET organization_id = $1 WHERE organization_id IS NULL RETURNING id',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${productsResult.rowCount} products assigned (expected 0 if already done).`);

        // Step 6: Migrate external_id_mapping (safety net)
        console.log('\n[Step 6] Checking external_id_mapping...');
        const eimResult = await client.query(
            'UPDATE external_id_mapping SET organization_id = $1 WHERE organization_id IS NULL RETURNING id',
            [DEFAULT_ORG_ID]
        );
        console.log(`  ✓ ${eimResult.rowCount} mappings assigned.`);

        // Step 7: Add organization_id to stock_balances if missing
        console.log('\n[Step 7] Schema: Adding organization_id to stock_balances...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name='stock_balances' AND column_name='organization_id') THEN
                    ALTER TABLE stock_balances ADD COLUMN organization_id INTEGER;
                END IF;
            END $$;
        `);
        console.log('  ✓ stock_balances.organization_id column ensured.');

        // Populate stock_balances organization_id from products
        const sbResult = await client.query(`
            UPDATE stock_balances sb
            SET organization_id = p.organization_id
            FROM products p
            WHERE sb.product_id = p.id AND sb.organization_id IS NULL
            RETURNING sb.id
        `);
        console.log(`  ✓ ${sbResult.rowCount} stock_balances records tagged from products.`);

        await client.query('COMMIT');

        // Summary
        console.log('\n=== MIGRATION COMPLETE ===');
        console.log(`Users migrated:          ${usersResult.rowCount}`);
        console.log(`Sales migrated:          ${salesResult.rowCount}`);
        console.log(`Sync settings migrated:  ${syncSettingsResult.rowCount}`);
        console.log(`Sync logs migrated:      ${syncLogResult.rowCount}`);
        console.log(`Products migrated:       ${productsResult.rowCount}`);
        console.log(`EID mappings migrated:   ${eimResult.rowCount}`);
        console.log(`Stock balances tagged:   ${sbResult.rowCount}`);
        console.log('\nAll orphaned records have been assigned to Organization #1.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n[FATAL] Migration failed, all changes rolled back:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
