import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function createUser() {
    try {
        const hash = await bcrypt.hash('daler5861', 10);
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', ['daler0602']);
        
        if (existing.rows.length > 0) {
            await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'daler0602']);
            console.log('✅ Пароль обновлён для daler0602');
        } else {
            await pool.query(
                `INSERT INTO users (username, password_hash, full_name, role, is_active, created_at) 
                 VALUES ($1, $2, $3, $4, true, NOW())`,
                ['daler0602', hash, 'Daler', 'admin']
            );
            console.log('✅ Пользователь daler0602 создан (роль: admin)');
        }
        
        // Проверка
        const check = await pool.query('SELECT id, username, role, full_name FROM users WHERE username = $1', ['daler0602']);
        console.log('Пользователь:', check.rows[0]);
        
        await pool.end();
        process.exit(0);
    } catch(e) {
        console.error('❌ Ошибка:', e.message);
        process.exit(1);
    }
}

createUser();
