// Migration: Create generate_license_key function
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Creating generate_license_key function...');

        // Create function to generate license keys
        await client.query(`
            CREATE OR REPLACE FUNCTION generate_license_key()
            RETURNS VARCHAR(30) AS $$
            DECLARE
                chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                result VARCHAR(30) := '';
                i INTEGER;
            BEGIN
                -- Format: XXXX-XXXX-XXXX-XXXX-XXXX (25 chars with dashes)
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
        console.log('✓ Created generate_license_key function');

        // Test the function
        const testResult = await client.query('SELECT generate_license_key()');
        console.log('✓ Test key generated:', testResult.rows[0].generate_license_key);

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
