// Migration: Add server_type columns to licenses table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db'
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Starting migration: Adding server_type columns...');

        // Add server_type column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS server_type VARCHAR(20) DEFAULT 'cloud'
        `);
        console.log('✓ Added server_type column');

        // Add server_url column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS server_url VARCHAR(500)
        `);
        console.log('✓ Added server_url column');

        // Add server_api_key column
        await client.query(`
            ALTER TABLE licenses 
            ADD COLUMN IF NOT EXISTS server_api_key VARCHAR(255)
        `);
        console.log('✓ Added server_api_key column');

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
