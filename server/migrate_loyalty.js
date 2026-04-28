import pool from './src/config/database.js';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration: adding loyalty columns to sales table...');
        
        // Add columns to sales table
        await client.query(`
            ALTER TABLE sales 
            ADD COLUMN IF NOT EXISTS loyalty_points_used DECIMAL(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS loyalty_points_earned DECIMAL(12, 2) DEFAULT 0;
        `);
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
