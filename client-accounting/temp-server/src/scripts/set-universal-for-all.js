// Script to set universal configuration for all users
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_1c',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function setUniversalConfigForAllUsers() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        // Get universal configuration ID
        const configResult = await client.query(`
            SELECT id FROM configurations WHERE code = 'universal-full'
        `);

        if (configResult.rows.length === 0) {
            console.error('✗ Universal configuration not found!');
            client.release();
            await pool.end();
            process.exit(1);
        }

        const universalConfigId = configResult.rows[0].id;
        console.log(`✓ Found universal configuration (ID: ${universalConfigId})`);

        // Deactivate all existing user configurations
        console.log('Deactivating old configurations...');
        await client.query(`
            UPDATE user_configurations SET is_active = false
        `);

        // Set universal configuration for all users
        console.log('Setting universal configuration for all users...');
        const usersResult = await client.query(`
            SELECT id FROM users
        `);

        for (const user of usersResult.rows) {
            await client.query(`
                INSERT INTO user_configurations (user_id, configuration_id, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (user_id) 
                DO UPDATE SET configuration_id = $2, is_active = true, updated_at = CURRENT_TIMESTAMP
            `, [user.id, universalConfigId]);
        }

        console.log(`✓ Universal configuration set for ${usersResult.rows.length} users`);

        client.release();
        await pool.end();

        process.exit(0);
    } catch (error) {
        console.error('✗ Failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

setUniversalConfigForAllUsers();
