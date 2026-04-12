import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createAdmin() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        // First check if user exists
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);

        if (existing.rows.length > 0) {
            // Update password
            await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
            console.log('✅ User admin password updated to: admin123');
        } else {
            // Create new user
            await pool.query(`
                INSERT INTO users (username, email, password_hash, full_name, role_id, is_active) 
                VALUES ('admin', 'admin@smartpos.uz', $1, 'Администратор', 1, true)
            `, [hash]);
            console.log('✅ User admin created with password: admin123');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

createAdmin();
