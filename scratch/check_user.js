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
    const sql = "SELECT u.id, u.username, u.role, u.user_type, u.license_id, u.organization_id, l.license_key, l.status, l.expires_at FROM users u LEFT JOIN licenses l ON u.license_id = l.id WHERE LOWER(u.username) = 'smash22'";
    
    for (const host of ['smartpos-pro-production-f885.up.railway.app', 'smartpos-pro-production.up.railway.app']) {
        console.log('\n--- Cloud:', host, '---');
        try {
            const result = await queryCloud(host, sql);
            console.log('Status:', result.status);
            const parsed = JSON.parse(result.data);
            console.log('Rows:', JSON.stringify(parsed.rows || parsed, null, 2));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

main();
