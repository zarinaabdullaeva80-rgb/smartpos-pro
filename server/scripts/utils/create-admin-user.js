import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function createAdminUser() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🔄 Connecting to database...');

        // Get admin role ID
        const roleResult = await pool.query(
            "SELECT id FROM roles WHERE name = 'Администратор' LIMIT 1"
        );

        if (roleResult.rows.length === 0) {
            console.error('❌ Admin role not found! Please run migrations first.');
            process.exit(1);
        }

        const adminRoleId = roleResult.rows[0].id;
        console.log(`✅ Found admin role with ID: ${adminRoleId}`);

        // Delete existing admin user if exists
        await pool.query("DELETE FROM users WHERE username = 'admin'");
        console.log('🗑️  Removed existing admin user (if any)');

        // Hash password
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 10);
        console.log('🔐 Password hashed successfully');

        // Create admin user
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, email, full_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name`,
            ['admin', passwordHash, 'admin@example.com', 'System Administrator', adminRoleId, true]
        );

        console.log('\n✅ Admin user created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 User Details:');
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   Username: ${result.rows[0].username}`);
        console.log(`   Email: ${result.rows[0].email}`);
        console.log(`   Full Name: ${result.rows[0].full_name}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔑 Login Credentials:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createAdminUser();
