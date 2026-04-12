// Quick script to create admin user
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function createAdmin() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
  });

  try {
    // Get admin role
    const role = await pool.query("SELECT id FROM roles WHERE name = 'Администратор'");
    if (!role.rows[0]) {
      console.log('❌ Admin role not found');
      return;
    }
    
    const roleId = role.rows[0].id;
    
    // Delete old admin
    await pool.query("DELETE FROM users WHERE username = 'admin'");
    
    // Create new admin
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, email, full_name, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
      ['admin', hash, 'admin@example.com', 'Administrator', roleId, true]
    );
    
    console.log('✅ Admin user created!');
    console.log('   Username: admin');
    console.log('   Password: admin123');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

createAdmin();
