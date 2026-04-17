import pool from '../config/database.js';

async function listTables() {
    try {
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log('Tables in database:');
        console.log(result.rows.map(r => r.table_name).join(', '));
        process.exit(0);
    } catch (err) {
        console.error('Failed to list tables:', err);
        process.exit(1);
    }
}

listTables();
