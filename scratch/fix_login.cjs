// Привязываем Smash2206 к организации 11 и лицензии 10 (как у Smash22)
// Затем проверяем полный логин
const https = require('https');

const CLOUD = 'smartpos-pro-production-f885.up.railway.app';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMyLCJ1c2VybmFtZSI6IlNtYXNoMjIwNiIsInJvbGUiOiJjYXNoaWVyIiwibGljZW5zZUlkIjpudWxsLCJvcmdhbml6YXRpb25faWQiOm51bGwsImlhdCI6MTc3ODMyMDI5NywiZXhwIjoxNzgwOTEyMjk3fQ.9a9EuKgho8-FWCuITZJiES_IvNeg1ziIiKK-huvH9xY';
const BOOTSTRAP_SECRET = '30af8f39611787a8';

function request(method, path, data, token) {
    const body = data ? JSON.stringify(data) : null;
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) headers['Content-Length'] = Buffer.byteLength(body);
        const req = https.request({ hostname: CLOUD, path, method, headers }, res => {
            let resBody = '';
            res.on('data', c => resBody += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(resBody) }); }
                catch(e) { resolve({ status: res.statusCode, data: resBody }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    console.log('=== Привязка Smash2206 к лицензии ===\n');

    // Сначала логинимся с обновлённой ролью для получения правильного токена
    console.log('1. Логин для получения admin-токена...');
    const login = await request('POST', '/api/auth/login', { username: 'Smash2206', password: 'Smash2206' });
    if (login.status !== 200) {
        console.log('   ❌ Логин не удался:', JSON.stringify(login.data));
        return;
    }
    const adminToken = login.data.token;
    console.log('   ✅ Токен получен. Роль:', login.data.user.role);

    // 2. Обновляем пользователя через PUT /api/users/32
    console.log('\n2. Привязываем к org=11, license=10...');
    const update = await request('PUT', '/api/users/32', {
        organization_id: 11,
        license_id: 10,
        role: 'Администратор'
    }, adminToken);
    console.log('   PUT /api/users/32:', update.status, JSON.stringify(update.data).substring(0, 300));

    // 3. Финальная проверка
    console.log('\n3. Финальная проверка /me...');
    const me = await request('GET', '/api/auth/me', null, adminToken);
    console.log('   /me:', me.status, JSON.stringify(me.data));

    // 4. Проверяем полный логин с лицензией
    console.log('\n4. Полный логин...');
    const fullLogin = await request('POST', '/api/auth/login', { username: 'Smash2206', password: 'Smash2206' });
    console.log('   Login:', fullLogin.status);
    if (fullLogin.status === 200) {
        console.log('   ✅ Роль:', fullLogin.data.user?.role);
        console.log('   Организация:', fullLogin.data.user?.organization_id);
        console.log('   Лицензия:', fullLogin.data.user?.license_id);
        console.log('   Данные лицензии:', JSON.stringify(fullLogin.data.license)?.substring(0, 200));
    }

    // 5. debug-users для финальной проверки
    console.log('\n5. Финальный список пользователей...');
    const users = await request('GET', '/api/auth/debug-users');
    if (users.data.users) {
        const smash = users.data.users.find(u => u.username === 'Smash2206');
        console.log('   Smash2206:', JSON.stringify(smash));
    }
}

main().catch(e => console.error('Fatal:', e.message));
