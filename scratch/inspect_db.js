import pool from '../server/src/config/database.js';

async function inspectSchema() {
    try {
        console.log('--- USERS table columns ---');
        const usersCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY column_name
        `);
        console.table(usersCols.rows);

        console.log('\n--- ERROR_LOGS table columns ---');
        const errorCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'error_logs'
            ORDER BY column_name
        `);
        console.table(errorCols.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error inspecting schema:', err);
        process.exit(1);
    }
}

inspectSchema();
