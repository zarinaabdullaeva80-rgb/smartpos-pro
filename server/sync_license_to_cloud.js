/**
 * Принудительная синхронизация лицензии из локальной БД → Railway Cloud
 * Запуск: cd server && node sync_license_to_cloud.js
 */
import pg from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const LICENSE_KEY = '7DA0-6FA6-6E30-9783';
const CLOUD_URL = process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';

async function main() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartpos'
    });

    console.log('🔍 Ищем лицензию в локальной БД:', LICENSE_KEY);

    const result = await pool.query(
        'SELECT * FROM licenses WHERE license_key = $1', [LICENSE_KEY]
    );

    if (result.rows.length === 0) {
        console.error('❌ Лицензия не найдена в локальной БД!');
        await pool.end();
        process.exit(1);
    }

    const lic = result.rows[0];
    console.log('✅ Найдена:');
    console.log('   Клиент:', lic.customer_name);
    console.log('   Логин:', lic.customer_username);
    console.log('   Тип:', lic.license_type);
    console.log('   Статус:', lic.status);
    console.log('   Истекает:', lic.expires_at);
    console.log('   is_active:', lic.is_active);

    // Отправка на Railway Cloud
    console.log('\n🚀 Синхронизация в облако:', CLOUD_URL);

    const syncPayload = {
        license_key: lic.license_key,
        customer_name: lic.customer_name,
        customer_email: lic.customer_email,
        customer_phone: lic.customer_phone,
        customer_username: lic.customer_username,
        customer_password_hash: lic.customer_password_hash,
        company_name: lic.company_name,
        license_type: lic.license_type,
        max_devices: lic.max_devices,
        max_users: lic.max_users,
        max_pos_terminals: lic.max_pos_terminals,
        expires_at: lic.expires_at,
        trial_days: lic.trial_days,
        features: lic.features || {},
        server_type: lic.server_type || 'cloud',
        server_url: lic.server_url,
        server_api_key: lic.server_api_key,
        status: lic.status,
        is_active: lic.is_active
    };

    try {
        const response = await fetch(`${CLOUD_URL}/api/license/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': SYNC_SECRET
            },
            body: JSON.stringify(syncPayload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Синхронизация успешна!');
            console.log('   license_id (облако):', data.license_id);
            console.log('   organization_id (облако):', data.organization_id);
        } else {
            console.error('❌ Ошибка синхронизации:', response.status, data.error || JSON.stringify(data));
        }
    } catch (err) {
        console.error('❌ Сетевая ошибка:', err.message);
    }

    // Проверка
    console.log('\n🔎 Проверка на облаке...');
    try {
        const checkRes = await fetch(`${CLOUD_URL}/api/license/resolve?key=${LICENSE_KEY}`);
        const checkData = await checkRes.json();
        console.log('   Статус:', checkRes.status);
        console.log('   Ответ:', JSON.stringify(checkData, null, 2));
    } catch (err) {
        console.error('   Ошибка проверки:', err.message);
    }

    await pool.end();
    console.log('\n✅ Готово');
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
