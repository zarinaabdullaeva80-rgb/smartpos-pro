import fetch from 'node-fetch';

const CLOUD_URLS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

async function testLogin(baseUrl, username, password) {
    try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
            console.log(`  ✅ Login OK — user_id=${data.user?.id}, org=${data.user?.organization_id}, license=${data.user?.license_id}`);
        } else {
            console.log(`  ❌ Login FAILED — status=${res.status}, message=${data.message || data.error || JSON.stringify(data)}`);
        }
    } catch (err) {
        console.log(`  ❌ Network error: ${err.message}`);
    }
}

async function main() {
    for (const url of CLOUD_URLS) {
        console.log(`\n--- ${url} ---`);
        await testLogin(url, 'admin', 'admin123');
    }
}

main();
