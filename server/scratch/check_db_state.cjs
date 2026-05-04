
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function checkEmployees() {
  try {
    console.log('--- Organizations ---');
    const orgs = await pool.query('SELECT id, name FROM organizations');
    console.table(orgs.rows);

    console.log('\n--- Licenses ---');
    const licenses = await pool.query('SELECT id, license_key, organization_id, is_active FROM licenses');
    console.table(licenses.rows);

    console.log('\n--- Employees (Users) ---');
    const users = await pool.query('SELECT id, username, role, organization_id, license_id FROM users');
    console.table(users.rows);

    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkEmployees();
