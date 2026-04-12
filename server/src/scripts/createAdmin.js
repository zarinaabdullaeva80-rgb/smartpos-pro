import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
    try {
        console.log('Creating admin user...');

        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            console.error('❌ ADMIN_PASSWORD environment variable is required.');
            console.error('   Set it: ADMIN_PASSWORD=your_secure_password node createAdmin.js');
            process.exit(1);
        }
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        // Check if user exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        if (existing.rows.length > 0) {
            console.log('Admin user already exists, updating password...');
            await pool.query(
                'UPDATE users SET password_hash = $1, is_active = true WHERE username = $2',
                [passwordHash, 'admin']
            );
            console.log('✓ Admin password updated!');
        } else {
            // Create admin user
            const result = await pool.query(
                `INSERT INTO users (username, email, password_hash, full_name, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username`,
                ['admin', 'admin@localhost', passwordHash, 'Administrator', true]
            );
            console.log('✓ Admin user created:', result.rows[0]);
        }

        // List all users
        const users = await pool.query('SELECT id, username, email, is_active FROM users LIMIT 10');
        console.log('All users:', users.rows);

        await pool.end();
        console.log('Done!');
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

createAdmin();
