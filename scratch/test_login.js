import https from 'https';

function post(hostname, path, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = JSON.stringify(body);
        const options = {
            hostname,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr)
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
    });
}

async function main() {
    const host = 'smartpos-pro-production-f885.up.railway.app';
    
    console.log('Testing login for Smash22 with license key B5F3...');
    
    // Try login with license key
    const r = await post(host, '/api/auth/login', {
        username: 'Smash22',
        password: 'Smash2206',
        license_key: 'B5F3-87E6-20F4-7B7A'
    });
    
    console.log('Status:', r.status);
    try {
        const data = JSON.parse(r.data);
        if (data.token) {
            console.log('✅ LOGIN SUCCESS!');
            console.log('User:', JSON.stringify(data.user, null, 2));
            console.log('License:', JSON.stringify(data.license, null, 2));
            
            // Now test check-expiry with the token
            console.log('\nTesting check-expiry...');
            const token = data.token;
            const r2 = await new Promise((resolve, reject) => {
                const opts = {
                    hostname: host,
                    path: '/api/license/check-expiry',
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                };
                const req = https.request(opts, res => {
                    let d = '';
                    res.on('data', x => d += x);
                    res.on('end', () => resolve({ status: res.statusCode, data: d }));
                });
                req.on('error', reject);
                req.end();
            });
            console.log('check-expiry status:', r2.status);
            console.log('check-expiry data:', r2.data);
        } else {
            console.log('❌ LOGIN FAILED:', JSON.stringify(data, null, 2));
        }
    } catch(e) {
        console.log('Parse error:', e.message, '\nRaw:', r.data.substring(0, 500));
    }
}

main().catch(console.error);
