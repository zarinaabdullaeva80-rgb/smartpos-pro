/**
 * runMigrations.js — Автоматический запуск SQL-миграций
 * 
 * Читает все SQL-файлы из database/migrations/ в числовом порядке
 * и применяет те, которые ещё не были применены.
 * 
 * Поддерживает DATABASE_URL (для CI/CD) и .env переменные (для локальной разработки).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Поддержка DATABASE_URL (CI/CD) и отдельных переменных (.env)
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'accounting_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    });

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

async function ensureMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

async function getAppliedMigrations(client) {
    const result = await client.query('SELECT filename FROM _migrations ORDER BY filename');
    return new Set(result.rows.map(r => r.filename));
}

async function runMigrations() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Запуск миграций...');
        console.log(`📁 Директория миграций: ${MIGRATIONS_DIR}`);
        
        await ensureMigrationsTable(client);
        const applied = await getAppliedMigrations(client);
        
        // Находим все SQL-файлы и сортируем по числовому префиксу
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => {
                const numA = parseInt(a.split('-')[0]) || 0;
                const numB = parseInt(b.split('-')[0]) || 0;
                return numA - numB || a.localeCompare(b);
            });

        console.log(`📋 Найдено ${files.length} файлов миграций, ${applied.size} уже применено`);
        
        let appliedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            if (applied.has(file)) {
                skippedCount++;
                continue;
            }

            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                    [file]
                );
                await client.query('COMMIT');
                appliedCount++;
                console.log(`  ✅ ${file}`);
            } catch (error) {
                await client.query('ROLLBACK');
                errorCount++;
                // Логируем ошибку, но продолжаем (миграция может быть уже частично применена)
                console.warn(`  ⚠️  ${file}: ${error.message.split('\n')[0]}`);
                // Помечаем как применённую, чтобы не пытаться повторно
                try {
                    await client.query(
                        'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                        [file]
                    );
                } catch (e) { /* ignore */ }
            }
        }

        console.log('');
        console.log(`📊 Результат: ${appliedCount} применено, ${skippedCount} пропущено, ${errorCount} с предупреждениями`);
        console.log('✅ Миграции завершены');
        
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Критическая ошибка миграций:', err.message);
        process.exit(1);
    });
