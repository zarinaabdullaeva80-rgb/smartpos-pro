import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || '1c_accounting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
};

console.log('🔄 Полная переинициализация базы данных\n');
console.log('⚠️  ВНИМАНИЕ: Все данные будут удалены!\n');

async function resetDatabase() {
    // Подключаемся к postgres database для пересоздания схемы
    const adminPool = new Pool({
        ...dbConfig,
        database: 'postgres'
    });

    try {
        console.log('━'.repeat(60));
        console.log('Шаг 1: Очистка схемы public\n');

        const pool = new Pool(dbConfig);

        // Отключаем все активные соединения
        await pool.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [dbConfig.database]);

        // Удаляем и пересоздаём схему
        await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
        await pool.query('CREATE SCHEMA public');
        await pool.query('GRANT ALL ON SCHEMA public TO postgres');
        await pool.query('GRANT ALL ON SCHEMA public TO public');

        console.log('✓ Схема public очищена и пересоздана\n');

        await pool.end();

        console.log('━'.repeat(60));
        console.log('Шаг 2: Применение миграций\n');

        // Запускаем init script
        const { stdout, stderr } = await execAsync('npm run init', {
            cwd: __dirname,
            env: process.env
        });

        console.log(stdout);
        if (stderr && !stderr.includes('npm')) {
            console.error(stderr);
        }

        console.log('\n' + '━'.repeat(60));
        console.log('✅ База данных успешно переинициализирована!\n');
        console.log('Следующие шаги:');
        console.log('1. cd ../server && npm start');
        console.log('2. Войти как admin / admin123\n');

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        process.exit(1);
    } finally {
        await adminPool.end();
    }
}

resetDatabase();
