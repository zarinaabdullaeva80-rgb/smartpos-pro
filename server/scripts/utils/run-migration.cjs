const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206',
    port: 5432
});

async function runMigration() {
    try {
        // Step 1: Check if organizations exists, if so drop and recreate
        console.log('Step 1: Checking organizations table...');
        const tableExists = await pool.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organizations')
        `);

        if (tableExists.rows[0].exists) {
            console.log('Dropping existing organizations table...');
            await pool.query('DROP TABLE IF EXISTS licenses CASCADE');
            await pool.query('DROP TABLE IF EXISTS organizations CASCADE');
        }

        // Step 2: Create organizations table
        console.log('Step 2: Creating organizations table...');
        await pool.query(`
            CREATE TABLE organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                license_key VARCHAR(100) UNIQUE,
                license_expires_at TIMESTAMP,
                settings JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ organizations created');

        // Step 3: Create licenses table
        console.log('Step 3: Creating licenses table...');
        await pool.query(`
            CREATE TABLE licenses (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(100) UNIQUE NOT NULL,
                organization_id INTEGER REFERENCES organizations(id),
                plan VARCHAR(50) DEFAULT 'basic',
                max_users INTEGER DEFAULT 5,
                max_products INTEGER DEFAULT 1000,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                activated_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ licenses created');

        // Step 4: Add organization_id to users
        console.log('Step 4: Adding organization_id to tables...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        await pool.query('ALTER TABLE shifts ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        await pool.query('ALTER TABLE returns ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        console.log('✓ organization_id columns added');

        // Step 5: Create default organization
        console.log('Step 5: Creating default organization...');
        await pool.query(`
            INSERT INTO organizations (name, code, license_key, is_active)
            VALUES ('Default Organization', 'DEFAULT', 'DEFAULT-LICENSE-KEY', true)
        `);
        console.log('✓ Default organization created');

        // Step 6: Assign existing data to default org
        console.log('Step 6: Assigning existing data to default org...');
        await pool.query('UPDATE users SET organization_id = 1 WHERE organization_id IS NULL');
        await pool.query('UPDATE products SET organization_id = 1 WHERE organization_id IS NULL');
        await pool.query('UPDATE sales SET organization_id = 1 WHERE organization_id IS NULL');
        await pool.query('UPDATE shifts SET organization_id = 1 WHERE organization_id IS NULL');
        await pool.query('UPDATE returns SET organization_id = 1 WHERE organization_id IS NULL');
        console.log('✓ Existing data assigned to default organization');

        // Step 7: Create indexes
        console.log('Step 7: Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(organization_id)');
        console.log('✓ Indexes created');

        console.log('\n=== Migration completed successfully! ===');

        // Verify
        const orgs = await pool.query('SELECT * FROM organizations');
        console.log('Organizations:', orgs.rows);

    } catch (error) {
        console.error('Migration error:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
