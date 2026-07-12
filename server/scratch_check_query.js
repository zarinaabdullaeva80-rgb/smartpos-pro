import pool from './src/config/database.js';

async function main() {
    try {
        console.log('--- Checking Licenses in DB ---');
        
        // 1. Запрос, как в middleware auth.js
        const licenseCheckId = 13; // organization_id пользователя Smash22
        const licRes = await pool.query(
            'SELECT id, license_key, customer_username, status, expires_at, organization_id FROM licenses WHERE id = $1 OR organization_id = $1 LIMIT 1',
            [licenseCheckId]
        );
        
        console.log('Result of: WHERE id = 13 OR organization_id = 13 LIMIT 1');
        console.log(JSON.stringify(licRes.rows, null, 2));
        
        // 2. Все лицензии
        const allRes = await pool.query(
            'SELECT id, license_key, customer_username, status, expires_at, organization_id FROM licenses ORDER BY id'
        );
        console.log('\nAll licenses:');
        allRes.rows.forEach(r => {
            console.log(`ID:${r.id} | Key:${r.license_key} | User:${r.customer_username} | Status:${r.status} | Exp:${r.expires_at} | OrgID:${r.organization_id}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
