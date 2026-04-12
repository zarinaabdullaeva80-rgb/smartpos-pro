import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

// Поддержка DATABASE_URL (Railway) или отдельных DB_* переменных (локально)
const isRemoteDB = process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('127.0.0.1');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ...(isRemoteDB ? { ssl: { rejectUnauthorized: false } } : {})
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || '1c_accounting',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    };

const pool = new Pool(poolConfig);
console.log(`📡 Подключение к БД: ${process.env.DATABASE_URL ? (isRemoteDB ? 'Railway (DATABASE_URL + SSL)' : 'Локальная (DATABASE_URL)') : 'Локальная БД'}`);

async function createMigrationsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    await pool.query(query);
    console.log('✓ Таблица migrations готова');
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

        // Удаляем COMMIT из конца файла, если есть
        const cleanSql = sql.replace(/COMMIT;?\s*$/gi, '');

        await client.query(cleanSql);

        await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [filename]
        );

        await client.query('COMMIT');

        console.log(`✓ Применена миграция: ${filename}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Ошибка применения ${filename}:`, error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        console.log('🚀 Начало применения миграций...\n');

        await createMigrationsTable();

        const appliedMigrations = await getAppliedMigrations();
        console.log(`\nПрименено ранее: ${appliedMigrations.length} миграций`);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`\nНайдено миграций: ${files.length}\n`);

        let appliedCount = 0;
        let skippedCount = 0;

        for (const file of files) {
            if (appliedMigrations.includes(file)) {
                console.log(`⊙ Пропущена (уже применена): ${file}`);
                skippedCount++;
                continue;
            }

            const filePath = path.join(migrationsDir, file);
            await applyMigration(file, filePath);
            appliedCount++;
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ ЗАВЕРШЕНО`);
        console.log(`   Применено новых: ${appliedCount}`);
        console.log(`   Пропущено: ${skippedCount}`);
        console.log(`   Всего в БД: ${appliedMigrations.length + appliedCount}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
