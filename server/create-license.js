/**
 * Создание лицензии в локальной БД
 * Запуск: node create-license.js
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db';
console.log('[DB] Using:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function createLicense() {
    try {
        await pool.query('SELECT 1');
        console.log('✓ Connected to database');

        // Лицензионный ключ (тот же, что пользователь вводил)
        const LICENSE_KEY = '0FF6-0343-932A-BC00';
        
        // Проверяем, нет ли уже
        const existing = await pool.query('SELECT id FROM licenses WHERE license_key = $1', [LICENSE_KEY]);
        if (existing.rows.length > 0) {
            console.log('License already exists with ID:', existing.rows[0].id);
            await pool.end();
            return;
        }

        // Создаём лицензию
        const result = await pool.query(`
            INSERT INTO licenses (
                license_key, customer_name, customer_email,
                customer_username, customer_password_hash,
                company_name, license_type, status,
                max_devices, max_users, max_pos_terminals,
                expires_at, features, server_type
            ) VALUES (
                $1, 'Администратор', 'admin@smartpos.local',
                'admin', '$2b$10$defaulthashnotusedforlogin000000000000000000000000',
                'Мой магазин', 'lifetime', 'active',
                10, 50, 10,
                NULL, '{"all": true}'::jsonb, 'self_hosted'
            ) RETURNING id, license_key, license_type, status
        `, [LICENSE_KEY]);

        console.log('✅ License created:', result.rows[0]);
        console.log('   Key:', LICENSE_KEY);
        console.log('   Type: lifetime (бессрочная)');
        console.log('   Status: active');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createLicense();
