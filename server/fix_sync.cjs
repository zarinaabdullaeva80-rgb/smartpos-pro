const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'licensing.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of the sync endpoint
const marker = '/**\r\n * POST /api/license/sync';
const idx = content.indexOf(marker);
if (idx === -1) {
    console.log('Marker not found!');
    process.exit(1);
}

// Cut everything from the sync endpoint to the end
content = content.substring(0, idx);

// Add the fixed sync endpoint
const syncEndpoint = `/**
 * POST /api/license/sync
 * Sync license data from local server to Railway cloud.
 * Protected by X-Sync-Secret header.
 */
router.post('/sync', async (req, res) => {
    try {
        const secret = req.headers['x-sync-secret'];
        if (secret !== CLOUD_SYNC_SECRET) {
            return res.status(403).json({ error: 'Invalid sync secret' });
        }

        const {
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices = 3, max_users = 5,
            max_pos_terminals = 1, expires_at, trial_days = 0,
            features = {}, server_type = 'cloud', server_url, server_api_key
        } = req.body;

        if (!license_key || !customer_username) {
            return res.status(400).json({ error: 'license_key and customer_username required' });
        }

        console.log('[SYNC] Receiving license:', license_key, 'for', customer_username);

        // 0. Auto-create tables if they don't exist
        try {
            await pool.query(\`CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
                code VARCHAR(100) NOT NULL UNIQUE, license_key VARCHAR(255) UNIQUE,
                license_expires_at TIMESTAMP, settings JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
            await pool.query(\`CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
                code VARCHAR(100), is_active BOOLEAN DEFAULT true,
                organization_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
            for (const tbl of ['licenses', 'users', 'products']) {
                try { await pool.query(\`ALTER TABLE \${tbl} ADD COLUMN IF NOT EXISTS organization_id INTEGER\`); } catch(e) {}
            }
        } catch (e) {
            console.log('[SYNC] Table setup:', e.message);
        }

        // 1. Upsert license
        const licResult = await pool.query(\`
            INSERT INTO licenses (
                license_key, customer_name, customer_email, customer_phone,
                customer_username, customer_password_hash,
                company_name, license_type, max_devices, max_users,
                max_pos_terminals, expires_at, trial_days, features, status,
                server_type, server_url, server_api_key, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16,$17,true)
            ON CONFLICT (license_key) DO UPDATE SET
                customer_name = EXCLUDED.customer_name,
                customer_username = EXCLUDED.customer_username,
                customer_password_hash = EXCLUDED.customer_password_hash,
                company_name = EXCLUDED.company_name,
                license_type = EXCLUDED.license_type,
                max_devices = EXCLUDED.max_devices,
                max_users = EXCLUDED.max_users,
                expires_at = EXCLUDED.expires_at,
                features = EXCLUDED.features,
                updated_at = NOW()
            RETURNING id\`, [
            license_key, customer_name, customer_email, customer_phone,
            customer_username, customer_password_hash,
            company_name, license_type, max_devices, max_users,
            max_pos_terminals, expires_at, trial_days, JSON.stringify(features),
            server_type, server_url, server_api_key
        ]);
        const licenseId = licResult.rows[0].id;

        // 2. Upsert organization
        const orgName = company_name || customer_name || customer_username;
        const orgCode = 'ORG-' + license_key.replace(/-/g, '').substring(0, 8);
        const orgResult = await pool.query(\`
            INSERT INTO organizations (name, code, license_key, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (license_key) DO UPDATE SET name = EXCLUDED.name, is_active = true
            RETURNING id\`, [orgName, orgCode, license_key]);
        const organizationId = orgResult.rows[0].id;

        // 3. Link license to organization
        try { await pool.query('UPDATE licenses SET organization_id = $1 WHERE id = $2', [organizationId, licenseId]); } catch(e) {}

        // 4. Upsert owner user
        await pool.query(\`
            INSERT INTO users (username, email, password_hash, full_name, role,
                               license_id, organization_id, user_type, is_active)
            VALUES ($1, $2, $3, $4, '\\u0410\\u0434\\u043c\\u0438\\u043d\\u0438\\u0441\\u0442\\u0440\\u0430\\u0442\\u043e\\u0440', $5, $6, 'owner', true)
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                organization_id = EXCLUDED.organization_id,
                license_id = EXCLUDED.license_id,
                is_active = true\`, [
            customer_username,
            customer_email || customer_username + '@smartpos.local',
            customer_password_hash,
            customer_name || customer_username,
            licenseId, organizationId
        ]);

        // 5. Default warehouse
        await pool.query(\`
            INSERT INTO warehouses (name, code, is_active, organization_id)
            VALUES ('\\u041e\\u0441\\u043d\\u043e\\u0432\\u043d\\u043e\\u0439 \\u0441\\u043a\\u043b\\u0430\\u0434', $1, true, $2)
            ON CONFLICT DO NOTHING\`, ['WH-' + organizationId, organizationId]);

        // 6. Fix orphaned products
        try {
            const fx = await pool.query('UPDATE products SET organization_id = $1 WHERE organization_id IS NULL', [organizationId]);
            if (fx.rowCount > 0) console.log('[SYNC] Fixed', fx.rowCount, 'orphaned products');
        } catch(e) {}

        console.log('[SYNC] Done:', license_key, 'org=' + organizationId, 'user=' + customer_username);
        res.json({ success: true, license_id: licenseId, organization_id: organizationId, message: 'Synced' });
    } catch (error) {
        console.error('[SYNC] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
`;

fs.writeFileSync(filePath, content + syncEndpoint, 'utf8');
console.log('DONE! File size:', fs.statSync(filePath).size);
