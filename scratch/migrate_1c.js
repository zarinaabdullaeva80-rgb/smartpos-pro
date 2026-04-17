import pool from '../server/src/config/database.js';

async function migrate() {
    console.log('--- STARTING 1C MULTI-TENANT MIGRATION ---');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding organization_id columns...');
        await client.query(`
            ALTER TABLE sync_settings ADD COLUMN IF NOT EXISTS organization_id INTEGER;
            ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS organization_id INTEGER;
            ALTER TABLE external_id_mapping ADD COLUMN IF NOT EXISTS organization_id INTEGER;
        `);

        console.log('Updating sync_settings constraints...');
        // Remove old global unique constraint if it exists
        await client.query('ALTER TABLE sync_settings DROP CONSTRAINT IF EXISTS sync_settings_setting_key_key');
        
        // Add new unique constraint (key + organization)
        try {
            await client.query('ALTER TABLE sync_settings ADD CONSTRAINT sync_settings_org_key UNIQUE(setting_key, organization_id)');
            console.log('New constraint sync_settings_org_key added.');
        } catch (e) {
            console.log('Note: Constraint might already exist:', e.message);
        }

        console.log('Updating external_id_mapping constraints...');
        try {
            // Usually mappings should be unique per (type, internal, system, org)
            await client.query('ALTER TABLE external_id_mapping DROP CONSTRAINT IF EXISTS external_id_mapping_entity_type_internal_id_external_system_ke');
            await client.query(`
                ALTER TABLE external_id_mapping 
                ADD CONSTRAINT eim_org_unique 
                UNIQUE(entity_type, internal_id, external_system, organization_id)
            `);
            console.log('New constraint eim_org_unique added.');
        } catch (e) {
             console.log('Note: EIM constraint update note:', e.message);
        }

        await client.query('COMMIT');
        console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
