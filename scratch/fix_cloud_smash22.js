import https from 'https';

function queryCloud(hostname, sql) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ sql });
        const options = {
            hostname,
            path: '/api/license/sync-query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': 'smartpos-sync-key-2026',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    const host = 'smartpos-pro-production-f885.up.railway.app';

    // 1. Check Smash22 user with license join
    console.log('=== 1. User Smash22 with license data ===');
    const sql1 = `SELECT u.id, u.username, u.role, u.user_type, u.license_id, u.organization_id, l.license_key, l.status, l.expires_at FROM users u LEFT JOIN licenses l ON u.license_id = l.id WHERE LOWER(u.username) = 'smash22'`;
    const r1 = await queryCloud(host, sql1);
    const d1 = JSON.parse(r1.data);
    console.log('Status:', r1.status);
    console.log('Rows:', JSON.stringify(d1.rows || d1, null, 2));

    // 2. Check if the license_id referenced by Smash22 actually exists
    if (d1.rows && d1.rows.length > 0) {
        const user = d1.rows[0];
        if (user.license_id && !user.license_key) {
            console.log(`\n⚠️  ORPHAN DETECTED: license_id=${user.license_id} but no license found!`);
            
            // Check if B5F3 exists
            const sql2 = `SELECT id, license_key, status, expires_at, organization_id, customer_username FROM licenses WHERE license_key = 'B5F3-87E6-20F4-7B7A'`;
            const r2 = await queryCloud(host, sql2);
            const d2 = JSON.parse(r2.data);
            console.log('\nB5F3 license on cloud:', JSON.stringify(d2.rows || d2, null, 2));

            if (d2.rows && d2.rows.length > 0) {
                const newLic = d2.rows[0];
                console.log(`\n🔧 FIX: Updating user ${user.username} (id=${user.id}) to license_id=${newLic.id}, org=${newLic.organization_id}`);
                const sqlFix = `UPDATE users SET license_id = ${newLic.id}, organization_id = ${newLic.organization_id} WHERE id = ${user.id}`;
                const rFix = await queryCloud(host, sqlFix);
                console.log('Fix result:', rFix.data);
            }
        } else if (user.license_key) {
            console.log(`\n✅ User ${user.username}: license ${user.license_key} (${user.status}), expires ${user.expires_at}`);
        }
    }

    // 3. Check raw license_id via direct query (bypass join)
    console.log('\n=== 2. Raw license_id from users table ===');
    const sql3 = `SELECT id, username, license_id, organization_id FROM users WHERE LOWER(username) = 'smash22'`;
    const r3 = await queryCloud(host, sql3);
    const d3 = JSON.parse(r3.data);
    console.log('Raw user:', JSON.stringify(d3.rows || d3, null, 2));

    if (d3.rows && d3.rows.length > 0) {
        const rawLicId = d3.rows[0].license_id;
        if (rawLicId) {
            console.log(`\n=== 3. License id=${rawLicId} exists? ===`);
            const sql4 = `SELECT id, license_key, status FROM licenses WHERE id = ${rawLicId}`;
            const r4 = await queryCloud(host, sql4);
            const d4 = JSON.parse(r4.data);
            console.log('License:', JSON.stringify(d4.rows || d4, null, 2));
        }
    }
}

main().catch(console.error);
