import pool from './config/database.js';

async function checkRoles() {
    try {
        console.log('Checking roles table...');
        const result = await pool.query('SELECT * FROM roles ORDER BY id');
        console.log('Roles found:', result.rows);

        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            );
        `);
        console.log('Roles table exists:', tableCheck.rows[0].exists);

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkRoles();
