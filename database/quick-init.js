import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || '1c_accounting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

console.log('🚀 Быстрая инициализация БД (База + Новые Фазы 6-10)\n');

// Применяем ТОЛЬКО эти миграции
const migrationsToApply = [
    '000-base.sql',
    '028-system-settings.sql',
    '029-notifications.sql',
    '030-warehouse-management.sql',
    '031-financial-reports.sql',
    '032-licensing-extended.sql'
];

async function resetAndInit() {
    try {
        console.log('━'.repeat(60));
        console.log('Шаг 1: Очистка БД\n');

        await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
        await pool.query('CREATE SCHEMA public');
        await pool.query('GRANT ALL ON SCHEMA public TO postgres');
        await pool.query('GRANT ALL ON SCHEMA public TO public');

        console.log('✓ База очищена\n');

        console.log('━'.repeat(60));
        console.log('Шаг 2: Применение миграций\n');

        for (const filename of migrationsToApply) {
            const filePath = path.join(__dirname, 'migrations', filename);

            if (!fs.existsSync(filePath)) {
                console.log(`  ⊙ Пропущен ${filename} (не найден)`);
                continue;
            }

            const sql = fs.readFileSync(filePath, 'utf8');
            const cleanSql = sql.replace(/COMMIT;?\s*$/gi, '');

            try {
                await pool.query('BEGIN');
                await pool.query(cleanSql);
                await pool.query('COMMIT');
                console.log(`  ✓ ${filename}`);
            } catch (error) {
                await pool.query('ROLLBACK');
                console.error(`  ✗ ${filename}: ${error.message}`);
                throw error;
            }
        }

        console.log('\n' + '━'.repeat(60));
        console.log('Шаг 3: Создание пользователей\n');

        // Загрузить конфигурацию пользователей
        const usersConfigPath = path.join(__dirname, 'init-users.json');
        const usersConfig = JSON.parse(fs.readFileSync(usersConfigPath, 'utf8'));

        // Создать создателя
        const creatorPassword = await bcrypt.hash(usersConfig.creator.password, 10);
        await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role, user_level, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
        `, [
            usersConfig.creator.username,
            usersConfig.creator.email,
            creatorPassword,
            usersConfig.creator.full_name,
            usersConfig.creator.role,
            usersConfig.creator.user_level
        ]);

        console.log('✓ Создатель создан:');
        console.log(`   Логин: ${usersConfig.creator.username}`);
        console.log(`   Пароль: ${usersConfig.creator.password}`);

        // Создать администратора
        const adminPassword = await bcrypt.hash(usersConfig.admin.password, 10);
        await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role, user_level, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
        `, [
            usersConfig.admin.username,
            usersConfig.admin.email,
            adminPassword,
            usersConfig.admin.full_name,
            usersConfig.admin.role,
            usersConfig.admin.user_level
        ]);

        console.log('\n✓ Администратор создан:');
        console.log(`   Логин: ${usersConfig.admin.username}`);
        console.log(`   Пароль: ${usersConfig.admin.password}`);

        console.log('\n' + '━'.repeat(60));
        console.log('✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА!\n');
        console.log('Следующие шаги:');
        console.log('1. cd ../server && npm start');
        console.log('2. Войти как создатель или администратор\n');
        console.log('💡 Изменить учётные данные: database/init-users.json\n');

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

resetAndInit();
