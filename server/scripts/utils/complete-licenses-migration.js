// Complete Migration: Ensure ALL columns exist in licenses table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('=== Complete Licenses Table Migration ===\n');

        // Check if licenses table exists, if not create it
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'licenses'
            );
        `);

        if (!tableExists.rows[0].exists) {
            console.log('Creating licenses table from scratch...');
            await client.query(`
                CREATE TABLE licenses (
                    id SERIAL PRIMARY KEY,
                    license_key VARCHAR(50) UNIQUE NOT NULL,
                    customer_name VARCHAR(255) NOT NULL,
                    customer_email VARCHAR(255),
                    customer_phone VARCHAR(50),
                    customer_username VARCHAR(100),
                    customer_password_hash VARCHAR(255),
                    customer_last_login TIMESTAMP,
                    company_name VARCHAR(255),
                    license_type VARCHAR(50) DEFAULT 'monthly',
                    status VARCHAR(50) DEFAULT 'active',
                    max_devices INTEGER DEFAULT 1,
                    max_users INTEGER DEFAULT 5,
                    max_pos_terminals INTEGER DEFAULT 1,
                    expires_at TIMESTAMP,
                    trial_days INTEGER DEFAULT 0,
                    features JSONB DEFAULT '{}',
                    server_type VARCHAR(20) DEFAULT 'cloud',
                    server_url VARCHAR(500),
                    server_api_key VARCHAR(255),
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log('✓ Created licenses table');
        } else {
            console.log('Licenses table exists, adding missing columns...\n');

            // All columns that should exist
            const columns = [
                { name: 'customer_name', type: 'VARCHAR(255)' },
                { name: 'customer_email', type: 'VARCHAR(255)' },
                { name: 'customer_phone', type: 'VARCHAR(50)' },
                { name: 'customer_username', type: 'VARCHAR(100)' },
                { name: 'customer_password_hash', type: 'VARCHAR(255)' },
                { name: 'customer_last_login', type: 'TIMESTAMP' },
                { name: 'company_name', type: 'VARCHAR(255)' },
                { name: 'license_type', type: 'VARCHAR(50) DEFAULT \'monthly\'' },
                { name: 'status', type: 'VARCHAR(50) DEFAULT \'active\'' },
                { name: 'max_devices', type: 'INTEGER DEFAULT 1' },
                { name: 'max_users', type: 'INTEGER DEFAULT 5' },
                { name: 'max_pos_terminals', type: 'INTEGER DEFAULT 1' },
                { name: 'expires_at', type: 'TIMESTAMP' },
                { name: 'trial_days', type: 'INTEGER DEFAULT 0' },
                { name: 'features', type: 'JSONB DEFAULT \'{}\'::jsonb' },
                { name: 'server_type', type: 'VARCHAR(20) DEFAULT \'cloud\'' },
                { name: 'server_url', type: 'VARCHAR(500)' },
                { name: 'server_api_key', type: 'VARCHAR(255)' },
                { name: 'created_by', type: 'INTEGER' },
                { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
                { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' }
            ];

            for (const col of columns) {
                try {
                    await client.query(`
                        ALTER TABLE licenses 
                        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
                    `);
                    console.log(`✓ Column ${col.name} ready`);
                } catch (err) {
                    console.log(`⚠ Column ${col.name}: ${err.message}`);
                }
            }
        }

        // Ensure generate_license_key function exists
        console.log('\nCreating generate_license_key function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION generate_license_key()
            RETURNS VARCHAR(30) AS $$
            DECLARE
                chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                result VARCHAR(30) := '';
                i INTEGER;
            BEGIN
                FOR i IN 1..20 LOOP
                    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
                    IF i IN (4, 8, 12, 16) THEN
                        result := result || '-';
                    END IF;
                END LOOP;
                RETURN result;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✓ generate_license_key function ready');

        // Ensure license_activations table exists
        console.log('\nChecking license_activations table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS license_activations (
                id SERIAL PRIMARY KEY,
                license_id INTEGER REFERENCES licenses(id),
                device_id VARCHAR(255) NOT NULL,
                device_type VARCHAR(50),
                device_name VARCHAR(255),
                device_fingerprint VARCHAR(255),
                last_ip VARCHAR(50),
                activated_at TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT true,
                deactivated_at TIMESTAMP,
                deactivation_reason TEXT
            );
        `);
        console.log('✓ license_activations table ready');

        // Ensure license_history table exists
        console.log('\nChecking license_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS license_history (
                id SERIAL PRIMARY KEY,
                license_id INTEGER REFERENCES licenses(id),
                action VARCHAR(50) NOT NULL,
                performed_by INTEGER,
                details JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ license_history table ready');

        // Test key generation
        const testResult = await client.query('SELECT generate_license_key()');
        console.log('\n✓ Test license key:', testResult.rows[0].generate_license_key);

        console.log('\n=== Migration completed successfully! ===');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
