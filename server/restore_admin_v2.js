import pool from './src/config/database.js';
import bcrypt from 'bcrypt';

async function restoreAdminV2() {
    try {
        console.log('Восстановление администратора (v2)...');
        
        let orgId = null;
        const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
        if (orgRes.rows.length === 0) {
            console.log('Создание системной организации...');
            const newOrg = await pool.query(
                "INSERT INTO organizations (name, code, is_active) VALUES ('Система', 'SYSTEM', true) RETURNING id"
            );
            orgId = newOrg.rows[0].id;
        } else {
            orgId = orgRes.rows[0].id;
        }

        const hashedPassword = await bcrypt.hash('admin', 10);

        const userCheck = await pool.query("SELECT id FROM users WHERE username = 'admin'");
        if (userCheck.rows.length === 0) {
            await pool.query(
                `INSERT INTO users (username, password_hash, role, user_type, organization_id, is_active) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                ['admin', hashedPassword, 'Администратор', 'super_admin', orgId, true]
            );
            console.log('✅ Администратор восстановлен!');
            console.log('Логин: admin');
            console.log('Пароль: admin');
        } else {
            console.log('⚠️ Пользователь admin уже существует. Сбрасываю пароль на admin...');
            await pool.query("UPDATE users SET password_hash = $1, is_active = true WHERE username = 'admin'", [hashedPassword]);
            console.log('✅ Пароль сброшен!');
        }

    } catch (e) {
        console.error('❌ Ошибка:', e.message);
    }
    process.exit(0);
}

restoreAdminV2();
