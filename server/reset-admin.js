import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function resetAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
  });

  try {
    console.log('🔍 Поиск роли администратора...');
    const role = await pool.query("SELECT id FROM roles WHERE name = 'Администратор'");
    const roleId = role.rows[0]?.id || 1;
    
    const username = 'admin';
    const password = 'admin123';
    
    console.log(`👤 Очистка и создание "${username}" с ролью "Администратор"...`);
    await pool.query("DELETE FROM users WHERE username = $1", [username]);
    
    const hash = await bcrypt.hash(password, 10);
    
    // Пытаемся вставить и в role_id, и в текстовое поле role для совместимости
    await pool.query(
      'INSERT INTO users (username, password_hash, email, full_name, role_id, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [username, hash, 'admin@example.com', 'System Administrator', roleId, 'Администратор', true]
    );
    
    console.log('✅ Готово! Пробуйте войти в админку.');
    console.log(`👉 Логин: ${username}`);
    console.log(`👉 Пароль: ${password}`);
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    // Если колонки role нет, пробуем без неё
    if (err.message.includes('column "role" does not exist')) {
        console.log('🔄 Пробую без колонки "role"...');
        const hash = await bcrypt.hash('admin123', 10);
        const role = await pool.query("SELECT id FROM roles WHERE name = 'Администратор'");
        const roleId = role.rows[0]?.id || 1;
        await pool.query(
          'INSERT INTO users (username, password_hash, email, full_name, role_id, is_active) VALUES ($1, $2, $3, $4, $5, $6)',
          ['admin', hash, 'admin@example.com', 'System Administrator', roleId, true]
        );
        console.log('✅ Создано через role_id');
    }
  } finally {
    await pool.end();
  }
}

resetAdmin();
