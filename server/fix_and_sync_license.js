/**
 * Синхронизация лицензии на ПРАВИЛЬНЫЙ Railway deployment (f885)
 */
import pg from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const LICENSE_KEY = '7DA0-6FA6-6E30-9783';
const CLOUD_URL_F885 = 'https://smartpos-pro-production-f885.up.railway.app';
const CLOUD_URL_ORIG = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';

async function main() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartpos'
    });

    const result = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [LICENSE_KEY]);
    if (result.rows.length === 0) {
        console.error('❌ Лицензия не найдена!');
        await pool.end();
        process.exit(1);
    }

    const lic = result.rows[0];
    console.log('✅ Лицензия:', lic.customer_name, '| Статус:', lic.status, '| Истекает:', lic.expires_at);

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
        status: 'active',
        is_active: true
    };

    // Sync to BOTH deployments
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
                console.log(`   ✅ OK! license_id=${data.license_id} org_id=${data.organization_id}`);
            } else {
                console.error(`   ❌ Ошибка:`, data.error || JSON.stringify(data));
            }
        } catch (err) {
            console.error(`   ❌ Сетевая ошибка:`, err.message);
        }
    }

    // Verify f885
    console.log('\n🔎 Проверка на f885...');
    try {
        const check = await fetch(`${CLOUD_URL_F885}/api/license/resolve?key=${LICENSE_KEY}`);
        const checkData = await check.json();
        console.log('   HTTP:', check.status, JSON.stringify(checkData));
    } catch (err) {
        console.error('   Ошибка:', err.message);
    }

    await pool.end();
    console.log('\n✅ Готово');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
