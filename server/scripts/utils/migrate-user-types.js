// Migration: Add user_type and created_by_license_id to users table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Starting migration: Multi-tenant user management...');

        // 1. Add user_type column
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'employee'
        `);
        console.log('✓ Added user_type column');

        // 2. Add created_by_license_id column
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS created_by_license_id INTEGER REFERENCES licenses(id)
        `);
        console.log('✓ Added created_by_license_id column');

        // 3. Update existing super admin (admin user)
        await client.query(`
            UPDATE users SET user_type = 'super_admin' 
            WHERE username = 'admin' OR role = 'admin'
        `);
        console.log('✓ Marked existing admin as super_admin');

        // 4. Update existing license users as client_admin
        await client.query(`
            UPDATE users SET user_type = 'client_admin' 
            WHERE license_id IS NOT NULL AND user_type = 'employee'
        `);
        console.log('✓ Marked license users as client_admin');

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
