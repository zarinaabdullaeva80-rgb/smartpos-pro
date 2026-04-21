// Migration: Add license_id to users table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Starting migration: Adding license_id to users...');

        // Add license_id column to users table
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS license_id INTEGER REFERENCES licenses(id)
        `);
        console.log('✓ Added license_id column to users');

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
