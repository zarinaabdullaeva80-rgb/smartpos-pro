import pool from '../server/src/config/database.js';
async function check() { 
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'external_id_mapping'");
  console.log(res.rows.map(r => r.column_name));
  process.exit(0);
} check();
