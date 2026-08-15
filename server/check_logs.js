import pool from './src/config/database.js';

async function checkLogs() {
  try {
    console.log('=== RECENT PAYMENT PROVIDER LOGS ===');
    const res = await pool.query('SELECT * FROM payment_provider_logs ORDER BY created_at DESC LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('=== ORDER 88 DETAILS ===');
    const orderRes = await pool.query('SELECT id, document_number, total_amount, final_amount, status, payment_status FROM sales WHERE id = 88 OR document_number = \'88\'');
    console.log(JSON.stringify(orderRes.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkLogs();
