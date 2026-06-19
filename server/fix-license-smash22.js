import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync } from 'fs';

// Загружаем .env
try {
    const env = readFileSync('.env', 'utf8');
    env.split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
} catch(e) {}

import pool from './src/config/database.js';

async function fixLicense() {
    try {
        console.log('\n=== Поиск лицензии Smash22 ===');
        
        // Найти лицензию
        const findRes = await pool.query(`
            SELECT id, license_key, customer_username, status, expires_at, license_type, created_at
            FROM licenses 
            WHERE LOWER(customer_username) = 'smash22' 
               OR license_key ILIKE 'B5F3%'
               OR license_key ILIKE 'B5F3-87E6%'
        `);
        
        if (findRes.rows.length === 0) {
            console.log('❌ Лицензия не найдена локально. Проверьте облачную БД Railway.');
            await pool.end();
            return;
        }
        
        console.log('\nНайдено лицензий:', findRes.rows.length);
        findRes.rows.forEach(lic => {
            console.log('\n---');
            console.log('ID:', lic.id);
            console.log('Ключ:', lic.license_key);
            console.log('Логин:', lic.customer_username);
            console.log('Статус в БД:', lic.status);
            console.log('Тип:', lic.license_type);
            console.log('Истекает:', lic.expires_at);
            console.log('Создана:', lic.created_at);
            
            const now = new Date();
            const expires = lic.expires_at ? new Date(lic.expires_at) : null;
            if (expires) {
                if (expires < now) {
                    console.log('⚠️  ПРОБЛЕМА: expires_at в прошлом!', expires.toISOString(), '<', now.toISOString());
                } else {
                    console.log('✅ expires_at в будущем:', expires.toISOString());
                }
            } else {
                console.log('expires_at: NULL (бессрочная)');
            }
        });
        
        // Исправить: установить статус active и expires_at = 2028-05-02
        console.log('\n=== Применяю исправление ===');
        for (const lic of findRes.rows) {
            const newExpiry = new Date('2028-05-02T00:00:00.000Z');
            await pool.query(`
                UPDATE licenses 
                SET status = 'active', expires_at = $1
                WHERE id = $2
            `, [newExpiry, lic.id]);
            console.log(`✅ Лицензия #${lic.id} (${lic.customer_username}) → status=active, expires_at=2028-05-02`);
        }
        
        // Проверить результат
        const checkRes = await pool.query(`
            SELECT id, customer_username, status, expires_at FROM licenses WHERE id = ANY($1)
        `, [findRes.rows.map(r => r.id)]);
        
        console.log('\n=== Результат после исправления ===');
        checkRes.rows.forEach(r => {
            console.log(`#${r.id} ${r.customer_username}: status=${r.status}, expires_at=${r.expires_at}`);
        });
        
        console.log('\n✅ ГОТОВО! Теперь пользователь Smash22 может войти снова.');
        
    } catch (err) {
        console.error('Ошибка:', err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

fixLicense();
