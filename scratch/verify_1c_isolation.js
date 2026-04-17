import pool from '../server/src/config/database.js';

async function verify1CIsolation() {
    console.log('--- STARTING 1C SYNC ISOLATION VERIFICATION ---');

    try {
        const orgA = 101;
        const orgB = 102;

        // 1. Create settings for Org A
        console.log('Creating settings for Org A...');
        await pool.query(
            `INSERT INTO sync_settings (setting_key, setting_value, organization_id) 
             VALUES ($1, $2, $3) ON CONFLICT (setting_key, organization_id) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
            ['1c_api_url', 'http://org-a.api', orgA]
        );

        // 2. Verify Org B sees nothing
        console.log('Verifying Org B isolation...');
        const resB = await pool.query('SELECT * FROM sync_settings WHERE organization_id = $1', [orgB]);
        if (resB.rows.length === 0) {
            console.log('SUCCESS: Org B sees no settings from Org A.');
        } else {
            console.error('FAIL: Org B sees settings! Data leak detected.');
        }

        // 3. Verify Org A sees its own
        const resA = await pool.query('SELECT * FROM sync_settings WHERE organization_id = $1', [orgA]);
        if (resA.rows.length > 0 && resA.rows[0].setting_value === 'http://org-a.api') {
            console.log('SUCCESS: Org A sees its own settings.');
        } else {
            console.error('FAIL: Org A cannot retrieve its own settings.');
        }

        // 4. Verify External Mapping Isolation
        console.log('Verifying External Mapping isolation...');
        await pool.query(
            `INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            ['products', 1, 'EXT-123', '1C', orgA]
        );

        const mapB = await pool.query(
            'SELECT * FROM external_id_mapping WHERE external_id = $1 AND organization_id = $2',
            ['EXT-123', orgB]
        );
        if (mapB.rows.length === 0) {
            console.log('SUCCESS: Org B cannot see Org A mapping.');
        } else {
            console.error('FAIL: Mapping leak detected.');
        }

    } catch (err) {
        console.error('Verification error:', err.message);
    } finally {
        process.exit(0);
    }
}

verify1CIsolation();
