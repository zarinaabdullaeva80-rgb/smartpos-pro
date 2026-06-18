import pool from './src/config/database.js';

async function main() {
  try {
    const res = await pool.query("SELECT id, username, organization_id, license_id FROM users");
    console.log('Users:', res.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
