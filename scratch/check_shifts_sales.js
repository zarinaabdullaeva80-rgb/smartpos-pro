import pool from '../server/src/config/database.js';

async function checkData() {
    try {
        console.log('--- SHIFTS IN DATABASE ---');
        const shifts = await pool.query('SELECT id, shift_number, started_at, ended_at, initial_cash, final_cash, total_amount, sales_count, status FROM shifts ORDER BY id DESC LIMIT 5');
        console.log(shifts.rows);

        console.log('--- SALES IN DATABASE ---');
        const sales = await pool.query('SELECT id, document_number, total_amount, final_amount, status, user_id, created_at FROM sales ORDER BY id DESC LIMIT 5');
        console.log(sales.rows);

        if (shifts.rows.length > 0) {
            const lastShift = shifts.rows[0];
            console.log(`--- TEST STATS FOR SHIFT ${lastShift.id} (user_id=${lastShift.user_id}, started_at=${lastShift.started_at}) ---`);
            const stats = await pool.query(
                `SELECT COUNT(*) as count, COALESCE(SUM(final_amount), 0) as total
                 FROM sales 
                 WHERE user_id = $1 
                 AND created_at >= $2 
                 AND status != 'draft'`,
                [lastShift.user_id || 1, lastShift.started_at]
            );
            console.log('Calculated stats:', stats.rows[0]);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkData();
