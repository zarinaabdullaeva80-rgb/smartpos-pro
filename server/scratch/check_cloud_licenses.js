import fetch from 'node-fetch';

async function checkCloud(url, name) {
    console.log(`\n=== Checking Cloud: ${name} (${url}) ===`);
    try {
        const loginRes = await fetch(`${url}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        
        if (!loginRes.ok) {
            console.log(`❌ Login admin failed: ${loginRes.status}`);
            return;
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        
        // Получаем все лицензии
        const licRes = await fetch(`${url}/api/license/admin/licenses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!licRes.ok) {
            console.log(`❌ Failed to get licenses: ${licRes.status}`);
            return;
        }
        
        const licData = await licRes.json();
        const licenses = licData.licenses || licData || [];
        console.log(`Total licenses on cloud: ${licenses.length}`);
        
        const smashLic = licenses.find(l => 
            l.license_key?.includes('B5F3') || 
            l.customer_username?.toLowerCase() === 'smash22'
        );
        
        if (smashLic) {
            console.log('Smash22 License Details in Cloud:');
            console.log(JSON.stringify(smashLic, null, 2));
            
            // Также проверим логин самого пользователя smash22
            console.log('\nTrying login as smash22...');
            const userLoginRes = await fetch(`${url}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Smash22', password: '123' }) // Здесь надо проверить реальный пароль, но мы просто посмотрим на ответ (403, 401 и т.д.)
            });
            console.log(`User login HTTP status: ${userLoginRes.status}`);
            const userLoginData = await userLoginRes.json();
            console.log('User login response:', JSON.stringify(userLoginData, null, 2));
        } else {
            console.log('❌ Smash22 license NOT FOUND on this cloud!');
        }
    } catch (e) {
        console.error(`Error checking cloud ${name}:`, e.message);
    }
}

async function main() {
    await checkCloud('https://smartpos-pro-production.up.railway.app', 'Main Cloud');
    await checkCloud('https://smartpos-pro-production-f885.up.railway.app', 'f885 Cloud');
}

main();
