import pg from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const LICENSE_KEY = 'B5F3-87E6-20F4-7B7A';
const CLOUD_URL_F885 = 'https://smartpos-pro-production-f885.up.railway.app';
const CLOUD_URL_ORIG = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';

async function main() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
    });

    console.log('🔍 Поиск лицензии Smash22 в локальной БД...');
    const result = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [LICENSE_KEY]);
    if (result.rows.length === 0) {
        console.error('❌ Лицензия не найдена в локальной БД!');
        await pool.end();
        process.exit(1);
    }

    const lic = result.rows[0];
    console.log('✅ Лицензия найдена локально:');
    console.log('   Customer:', lic.customer_name);
    console.log('   Username:', lic.customer_username);
    console.log('   Status:', lic.status);
    console.log('   Expires:', lic.expires_at);

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
        status: 'active', // форсируем active
        is_active: true
    };

    // Синхронизация на оба сервера
    for (const url of [CLOUD_URL_F885, CLOUD_URL_ORIG]) {
        console.log(`\n🚀 Синхронизация → ${url}`);
        try {
            const response = await fetch(`${url}/api/license/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Secret': SYNC_SECRET
                },
                body: JSON.stringify(syncPayload)
            });
            const data = await response.json();
            if (response.ok && data.success) {
                console.log(`   ✅ УСПЕШНО! license_id=${data.license_id} org_id=${data.organization_id}`);
            } else {
                console.error(`   ❌ Ошибка:`, data.error || JSON.stringify(data));
            }
        } catch (err) {
            console.error(`   ❌ Сетевая ошибка:`, err.message);
        }
    }

    // Проверка на серверах
    for (const url of [CLOUD_URL_F885, CLOUD_URL_ORIG]) {
        console.log(`\n🔎 Проверка resolve на ${url}...`);
        try {
            const check = await fetch(`${url}/api/license/resolve?key=${LICENSE_KEY}`);
            const checkData = await check.json();
            console.log('   HTTP Status:', check.status, 'Response:', JSON.stringify(checkData));
        } catch (err) {
            console.error('   Ошибка проверки:', err.message);
        }
    }

    await pool.end();
    console.log('\n✅ Работа завершена');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
