/**
 * Пометить все существующие миграции как уже применённые
 * Используйте когда БД уже настроена, но таблица migrations пустая
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || '1c_accounting',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    };

const pool = new Pool(poolConfig);

async function main() {
    console.log('📋 Помечаю все миграции как применённые...\n');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let marked = 0;
    for (const file of files) {
        const exists = await pool.query('SELECT 1 FROM migrations WHERE filename = $1', [file]);
        if (exists.rows.length === 0) {
            await pool.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
            console.log(`  ✓ ${file}`);
            marked++;
        } else {
            console.log(`  - ${file} (уже помечен)`);
        }
    }

    console.log(`\n✅ Помечено: ${marked} из ${files.length} миграций`);
    await pool.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
