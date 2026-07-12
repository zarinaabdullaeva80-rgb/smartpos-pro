import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

const HASH = '$2b$10$8ppAMh8bQSJ16fkYAgea8O5n1PVM4MYDgBmjK9MEc8EePQ6vTtckm'; // bcrypt hash for 'admin123'
const LICENSE_KEY = '0FF6-0343-932A-BC00';

async function sendQuery(cloudUrl, sql) {
    const response = await fetch(`${cloudUrl}/api/license/sync-query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-sync-secret': SYNC_SECRET
        },
        body: JSON.stringify({ sql })
    });
    return await response.json();
}

async function run() {
    for (const cloudUrl of CLOUD_URLS) {
        console.log(`\n=== Processing ${cloudUrl} ===`);
        try {
            // 1. Находим лицензию
            const licRes = await sendQuery(cloudUrl, `SELECT id, organization_id, customer_username FROM licenses WHERE license_key = '${LICENSE_KEY}'`);
            if (!licRes.success || licRes.rows.length === 0) {
                console.log(`❌ License not found on ${cloudUrl}`);
                continue;
            }
            const license = licRes.rows[0];
            const licenseId = license.id;
            const orgId = license.organization_id;
            console.log(`License found: ID=${licenseId}, OrgID=${orgId}, CustomerUsername=${license.customer_username}`);

            // 2. Обновляем пароль в лицензии
            const updateLicRes = await sendQuery(cloudUrl, `
                UPDATE licenses 
                SET customer_password_hash = '${HASH}', customer_username = 'admin'
                WHERE id = ${licenseId}
            `);
            if (updateLicRes.success) {
                console.log(`✅ Updated customer_password_hash in licenses table`);
            } else {
                console.log(`❌ Failed to update licenses:`, updateLicRes);
            }

            // 3. Проверяем существование пользователя 'admin'
            const userRes = await sendQuery(cloudUrl, `SELECT id, license_id, organization_id FROM users WHERE LOWER(username) = 'admin'`);
            if (userRes.success && userRes.rows.length > 0) {
                const user = userRes.rows[0];
                console.log(`Found existing user 'admin': ID=${user.id}, LicenseID=${user.license_id}, OrgID=${user.organization_id}`);

                // Обновляем существующего пользователя 'admin'
                const updateUserRes = await sendQuery(cloudUrl, `
                    UPDATE users 
                    SET license_id = ${licenseId}, 
                        organization_id = ${orgId}, 
                        password_hash = '${HASH}', 
                        is_active = true,
                        role = 'Администратор',
                        updated_at = NOW()
                    WHERE id = ${user.id}
                `);
                if (updateUserRes.success) {
                    console.log(`✅ Updated existing user 'admin' to link with license #${licenseId}`);
                } else {
                    console.log(`❌ Failed to update users:`, updateUserRes);
                }
            } else {
                // Если пользователя 'admin' вообще нет, создаем его
                console.log(`User 'admin' not found. Creating new user...`);
                const insertUserRes = await sendQuery(cloudUrl, `
                    INSERT INTO users (username, email, password_hash, full_name, role, is_active, license_id, organization_id, created_at, updated_at)
                    VALUES ('admin', 'admin@smartpos.local', '${HASH}', 'Администратор', 'Администратор', true, ${licenseId}, ${orgId}, NOW(), NOW())
                `);
                if (insertUserRes.success) {
                    console.log(`✅ Created new user 'admin' for license #${licenseId}`);
                } else {
                    console.log(`❌ Failed to create user:`, insertUserRes);
                }
            }
        } catch (err) {
            console.error(`❌ Error on ${cloudUrl}:`, err.message);
        }
    }
}

run();
