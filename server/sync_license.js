import pg from 'pg';
const { Pool } = pg;

const RAILWAY_URL = process.env.DATABASE_URL || 'postgresql://postgres:gOHNrdKYSrPYMaLqMuRGqtSxwXLhMrMd@monorail.proxy.rlwy.net:24312/railway';

const localPool = new Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function main() {
    // First, try to get Railway DB URL from the .env or use the known one
    let railwayUrl = RAILWAY_URL;
    
    // Check if we can read it from Railway environment
    console.log('Using Railway DB URL:', railwayUrl.replace(/:[^:@]+@/, ':***@'));
    
    const railwayPool = new Pool({ connectionString: railwayUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        // 1. Create organizations table on Railway if it doesn't exist
        console.log('\n1. Creating organizations table on Railway...');
        await railwayPool.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100) NOT NULL UNIQUE,
                license_key VARCHAR(255) UNIQUE,
                license_expires_at TIMESTAMP,
                settings JSONB DEFAULT '{}'::jsonb,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ organizations table ready');

        // 2. Create warehouses table if not exists
        console.log('2. Creating warehouses table on Railway...');
        await railwayPool.query(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                organization_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ warehouses table ready');

        // 3. Ensure organization_id column exists on key tables
        const tablesNeedingOrgId = ['licenses', 'users', 'products'];
        for (const table of tablesNeedingOrgId) {
            try {
                await railwayPool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS organization_id INTEGER`);
                console.log(`   ✅ ${table}.organization_id column ensured`);
            } catch (e) {
                console.log(`   ⚠️ ${table}: ${e.message}`);
            }
        }

        // 4. Get local license data
        console.log('\n3. Getting local license data...');
        const licRes = await localPool.query(
            `SELECT license_key, customer_name, customer_email, customer_phone,
                    customer_username, customer_password_hash, company_name,
                    license_type, max_devices, max_users, max_pos_terminals, expires_at, trial_days
             FROM licenses WHERE license_key = '834B-D59B-4D92-3DD0'`
        );
        
        if (licRes.rows.length === 0) {
            console.log('   ❌ License not found locally!');
            return;
        }
        const lic = licRes.rows[0];
        console.log(`   Found: ${lic.customer_username} / ${lic.company_name}`);

        // 5. Now call the sync endpoint
        console.log('\n4. Syncing to Railway via /api/license/sync...');
        const response = await fetch('https://smartpos-pro-production.up.railway.app/api/license/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': 'smartpos-sync-key-2026'
            },
            body: JSON.stringify({
                ...lic,
                company_name: lic.company_name || lic.customer_name || lic.customer_username
            })
        });
        
        const result = await response.json();
        console.log('   Sync result:', JSON.stringify(result, null, 2));

        // 6. Also update all products with NULL organization_id
        console.log('\n5. Fixing products with NULL organization_id...');
        const fixRes = await railwayPool.query(`
            UPDATE products SET organization_id = (
                SELECT id FROM organizations WHERE license_key = '834B-D59B-4D92-3DD0' LIMIT 1
            ) WHERE organization_id IS NULL
        `);
        console.log(`   ✅ Fixed ${fixRes.rowCount} products`);

        // 7. Verify
        console.log('\n6. Verification...');
        const orgCheck = await railwayPool.query(`SELECT id, name, license_key FROM organizations`);
        console.log('   Organizations:', JSON.stringify(orgCheck.rows));
        
        const userCheck = await railwayPool.query(`SELECT id, username, organization_id FROM users WHERE username = 'Nematullo1'`);
        console.log('   User:', JSON.stringify(userCheck.rows));
        
        const prodCount = await railwayPool.query(`SELECT COUNT(*) as total, organization_id FROM products GROUP BY organization_id`);
        console.log('   Products by org:', JSON.stringify(prodCount.rows));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await localPool.end();
        await railwayPool.end();
    }
}

main();
