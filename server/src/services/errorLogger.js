/**
 * SmartPOS Pro — Централизованный логгер ошибок
 * Запуск диагностики: node server/src/services/errorLogger.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'errors.log');
const ALL_LOG = path.join(LOG_DIR, 'all.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function fmt(level, source, msg, details) {
    let entry = `[${new Date().toISOString()}] [${level}] [${source}] ${msg}`;
    if (details instanceof Error) entry += `\n  Stack: ${details.stack}`;
    else if (details) entry += `\n  ${JSON.stringify(details)}`;
    return entry + '\n';
}

function write(file, entry) {
    try { fs.appendFileSync(file, entry, 'utf8'); } catch (e) { /* */ }
}

const logger = {
    error(src, msg, d) { const e = fmt('ERROR', src, msg, d); write(ERROR_LOG, e); write(ALL_LOG, e); },
    warn(src, msg, d) { write(ALL_LOG, fmt('WARN', src, msg, d)); },
    info(src, msg, d) { write(ALL_LOG, fmt('INFO', src, msg, d)); },
};

// Диагностика при прямом запуске
async function diagnose() {
    console.log('='.repeat(60));
    console.log('🔍 SmartPOS Pro — ДИАГНОСТИКА');
    console.log('='.repeat(60));

    // 1. PM2 логи
    console.log('\n📋 1. PM2 ошибки:');
    try {
        const out = execSync('pm2 logs smartpos-server --lines 200 --nostream --err 2>&1', { encoding: 'utf8', timeout: 10000 });
        const errs = out.split('\n').filter(l => /error|ECONN|ENOENT|❌|⚠/i.test(l));
        console.log(errs.length ? `   ⚠️ ${errs.length} ошибок:` : '   ✅ Нет ошибок');
        errs.slice(0, 10).forEach(e => console.log(`   ${e.trim()}`));
    } catch (e) { console.log('   ⚠️ PM2 недоступен'); }

    // 2. Критичные файлы
    console.log('\n📋 2. Файлы:');
    const files = [
        [path.join(__dirname, '..', '..', '.env'), '.env'],
        [path.join(__dirname, '..', 'index.js'), 'server/src/index.js'],
        [path.join(__dirname, '..', '..', '..', 'client-accounting', 'dist', 'index.html'), 'client dist/'],
    ];
    files.forEach(([p, n]) => console.log(`   ${fs.existsSync(p) ? '✅' : '❌'} ${n}`));

    // 3. БД
    console.log('\n📋 3. База данных:');
    try {
        const dotenv = await import('dotenv');
        dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
        const pg = (await import('pg')).default;
        const pool = new pg.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'accounting_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'Smash2206',
        });
        const r = await pool.query('SELECT NOW() as now');
        console.log(`   ✅ Подключена: ${r.rows[0].now}`);

        const counts = await pool.query(`
            SELECT 'licenses' as t, COUNT(*) as c FROM licenses
            UNION ALL SELECT 'products', COUNT(*) FROM products
            UNION ALL SELECT 'employees', COUNT(*) FROM employees
            UNION ALL SELECT 'users', COUNT(*) FROM users
            UNION ALL SELECT 'sales', COUNT(*) FROM sales
        `);
        counts.rows.forEach(r => console.log(`   📊 ${r.t}: ${r.c}`));
        await pool.end();
    } catch (e) { console.log(`   ❌ ${e.message}`); }

    // 4. Сервер
    console.log('\n📋 4. HTTP сервер:');
    try {
        const http = await import('http');
        await new Promise((ok, fail) => {
            const req = http.default.get('http://127.0.0.1:5000/api/health', r => {
                console.log(`   ✅ HTTP ${r.statusCode}`);
                ok();
            });
            req.on('error', e => { console.log(`   ❌ ${e.message}`); ok(); });
            req.setTimeout(3000, () => { req.destroy(); ok(); });
        });
    } catch (e) { console.log(`   ❌ ${e.message}`); }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
    console.log('='.repeat(60));
}

if (process.argv[1] === __filename) diagnose();
export default logger;
