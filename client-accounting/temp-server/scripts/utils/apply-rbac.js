import pool from './src/config/database.js';

async function applyMigration() {
    const client = await pool.connect();
    try {
        console.log('Создание таблицы permissions...');
        await client.query(`
            DROP TABLE IF EXISTS user_roles CASCADE;
            DROP TABLE IF EXISTS role_permissions CASCADE;
            DROP TABLE IF EXISTS permissions CASCADE;
            DROP TABLE IF EXISTS roles CASCADE;
        `);

        await client.query(`
            CREATE TABLE permissions (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                module VARCHAR(50),
                action VARCHAR(20),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ permissions');

        await client.query(`
            CREATE TABLE roles (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✓ roles');

        await client.query(`
            CREATE TABLE role_permissions (
                role_id INT REFERENCES roles(id) ON DELETE CASCADE,
                permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (role_id, permission_id)
            );
        `);
        console.log('✓ role_permissions');

        await client.query(`
            CREATE TABLE user_roles (
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                role_id INT REFERENCES roles(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT NOW(),
                assigned_by INT REFERENCES users(id),
                PRIMARY KEY (user_id, role_id)
            );
        `);
        console.log('✓ user_roles');

        // Создание базовых ролей
        await client.query(`
            INSERT INTO roles (code, name, description, is_system) VALUES
            ('admin', 'Администратор', 'Полный доступ ко всем функциям системы', true),
            ('cashier', 'Кассир', 'Доступ к продажам, кассе и возвратам', true);
        `);
        console.log('✓ Роли созданы');

        // Назначение роли админа пользователям
        await client.query(`
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            SELECT u.id, r.id, 1
            FROM users u, roles r
            WHERE r.code = 'admin'
            ON CONFLICT DO NOTHING;
        `);
        console.log('✓ Роли назначены пользователям');

        console.log('\\n✅ Миграция RBAC выполнена успешно!');
    } catch (e) {
        console.error('Ошибка:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

applyMigration();
