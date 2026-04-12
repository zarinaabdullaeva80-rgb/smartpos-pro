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
    database: process.env.DB_NAME || 'accounting_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

console.log('🚀 Полная инициализация базы данных 1С Бухгалтерия\n');

async function checkDatabase() {
    try {
        await pool.query('SELECT 1');
        console.log('✓ Подключение к PostgreSQL установлено');
        return true;
    } catch (error) {
        console.error('✗ Ошибка подключения к PostgreSQL:', error.message);
        console.log('\n📝 Проверьте настройки в server/.env:');
        console.log('   DB_HOST=' + (process.env.DB_HOST || 'localhost'));
        console.log('   DB_PORT=' + (process.env.DB_PORT || '5432'));
        console.log('   DB_NAME=' + (process.env.DB_NAME || '1c_accounting'));
        console.log('   DB_USER=' + (process.env.DB_USER || 'postgres'));
        return false;
    }
}

async function createMigrationsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log('✓ Таблица migrations создана');
}

async function getAppliedMigrations() {
    const result = await pool.query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map(row => row.filename);
}

async function applyMigration(filename, filePath) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const sql = fs.readFileSync(filePath, 'utf8');
        const cleanSql = sql.replace(/COMMIT;?\s*$/gi, '');

        await client.query(cleanSql);

        await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [filename]
        );

        await client.query('COMMIT');

        console.log(`  ✓ ${filename}`);
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${filename}: ${error.message}`);
        throw error;
    } finally {
        client.release();
    }
}

async function createSuperAdmin() {
    try {
        const password = await bcrypt.hash('admin123', 10);

        await pool.query(`
            INSERT INTO users (username, email, password_hash, full_name, role, is_active)
            VALUES ('admin', 'admin@1c-accounting.com', $1, 'Супер Администратор', 'super_admin', true)
            ON CONFLICT (username) DO NOTHING
        `, [password]);

        console.log('\n✓ Супер администратор создан:');
        console.log('   Логин: admin');
        console.log('   Пароль: admin123');
        console.log('   ⚠️  ИЗМЕНИТЕ ПАРОЛЬ после первого входа!');
    } catch (error) {
        console.log('⊙ Супер администратор уже существует');
    }
}

async function main() {
    try {
        console.log('━'.repeat(60));
        console.log('Проверка подключения к БД...\n');

        const connected = await checkDatabase();
        if (!connected) {
            process.exit(1);
        }

        console.log('\n' + '━'.repeat(60));
        console.log('Создание служебных таблиц...\n');
        await createMigrationsTable();

        console.log('\n' + '━'.repeat(60));
        console.log('Применение миграций...\n');

        const appliedMigrations = await getAppliedMigrations();
        console.log(`Применено ранее: ${appliedMigrations.length} миграций\n`);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Найдено миграций: ${files.length}\n`);

        let appliedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            if (appliedMigrations.includes(file)) {
                skippedCount++;
                continue;
            }

            const filePath = path.join(migrationsDir, file);
            try {
                await applyMigration(file, filePath);
                appliedCount++;
            } catch (error) {
                errorCount++;
                console.log(`\n⚠️  Пропуск оставшихся миграций из-за ошибки\n`);
                break;
            }
        }

        if (errorCount === 0 && appliedCount > 0) {
            console.log('\n' + '━'.repeat(60));
            console.log('Создание базовых данных...\n');
            await createSuperAdmin();
        }

        console.log('\n' + '━'.repeat(60));
        console.log('📊 РЕЗУЛЬТАТЫ:\n');
        console.log(`   ✅ Применено новых миграций: ${appliedCount}`);
        console.log(`   ⊙ Пропущено (уже были): ${skippedCount}`);
        if (errorCount > 0) {
            console.log(`   ❌ Ошибок: ${errorCount}`);
        }
        console.log(`   📝 Всего в БД: ${appliedMigrations.length + appliedCount}`);
        console.log('━'.repeat(60) + '\n');

        if (errorCount === 0 && appliedCount > 0) {
            console.log('✅ База данных успешно инициализирована!\n');
            console.log('Следующие шаги:');
            console.log('1. cd ../server && npm start');
            console.log('2. cd ../client-accounting && npm start');
            console.log('3. Войти как admin / admin123\n');
        } else if (errorCount > 0) {
            console.log('⚠️  Инициализация завершена с ошибками\n');
            process.exit(1);
        } else {
            console.log('✅ База данных уже инициализирована\n');
        }

    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
