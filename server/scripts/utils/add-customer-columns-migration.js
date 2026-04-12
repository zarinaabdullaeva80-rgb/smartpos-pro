// Migration: Add missing customer credentials columns to licenses table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Starting migration: Adding customer credentials columns...');

        // Add customer_username column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS customer_username VARCHAR(100)
        `);
        console.log('✓ Added customer_username column');

        // Add customer_password_hash column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS customer_password_hash VARCHAR(255)
        `);
        console.log('✓ Added customer_password_hash column');

        // Add customer_last_login column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS customer_last_login TIMESTAMP
        `);
        console.log('✓ Added customer_last_login column');

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
