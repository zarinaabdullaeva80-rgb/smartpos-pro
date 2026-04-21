import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function createUser() {
    try {
        const hash = await bcrypt.hash('admin', 10);
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
        
        if (existing.rows.length > 0) {
            await pool.query('UPDATE users SET password_hash = $1, role = $3 WHERE username = $2', [hash, 'admin', 'super_admin']);
            console.log('✅ Пароль обновлён для admin');
        } else {
            await pool.query(
                `INSERT INTO users (username, password_hash, full_name, role, is_active, created_at, email) 
                 VALUES ($1, $2, $3, $4, true, NOW(), $5)`,
                ['admin', hash, 'Administrator', 'super_admin', 'admin@example.com']
            );
            console.log('✅ Пользователь admin создан (роль: super_admin)');
        }
        
        // Удаляем daler0602 если он был создан
        await pool.query('DELETE FROM users WHERE username = $1', ['daler0602']);
        
        // Проверка
        const check = await pool.query('SELECT id, username, role, full_name FROM users WHERE username = $1', ['admin']);
        console.log('Пользователь:', check.rows[0]);
        
        await pool.end();
        process.exit(0);
    } catch(e) {
        console.error('❌ Ошибка:', e.message);
        process.exit(1);
    }
}

createUser();
