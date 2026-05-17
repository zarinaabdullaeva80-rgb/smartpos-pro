// Проверяем пользователей через API облачного сервера
const https = require('https');

const CLOUD = 'smartpos-pro-production-f885.up.railway.app';

function cloudPost(path, data, token) {
    const body = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const req = https.request({ hostname: CLOUD, path, method: 'POST', headers }, res => {
            let resBody = '';
            res.on('data', c => resBody += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(resBody) }); }
                catch(e) { resolve({ status: res.statusCode, data: resBody }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

function cloudGet(path, token) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const req = https.request({ hostname: CLOUD, path, method: 'GET', headers }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch(e) { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function main() {
    console.log('=== Диагностика логина Smash2206 ===\n');

    // 1. Логин через admin-login (без license_key)
    console.log('1. Попытка admin-login...');
    try {
        const res = await cloudPost('/api/auth/admin-login', { username: 'Smash2206', password: 'Smash2206' });
        console.log('   admin-login:', res.status, JSON.stringify(res.data).substring(0, 200));
    } catch(e) { console.log('   Ошибка:', e.message); }

    // 2. Обычный логин — разные пароли
    const passwords = ['Smash2206', 'smash2206', '12345678', 'admin', 'password', '123456'];
    for (const pwd of passwords) {
        try {
            const res = await cloudPost('/api/auth/login', { username: 'Smash2206', password: pwd });
            console.log(`2. login(pass="${pwd}"): ${res.status}`, JSON.stringify(res.data).substring(0, 200));
            if (res.status === 200) {
                console.log('   ✅ НАЙДЕН ПРАВИЛЬНЫЙ ПАРОЛЬ:', pwd);
                
                // Получить информацию о пользователе
                const me = await cloudGet('/api/auth/me', res.data.token);
                console.log('   /me:', me.status, JSON.stringify(me.data).substring(0, 200));
                return;
            }
        } catch(e) { console.log(`   Ошибка (${pwd}):`, e.message); }
    }

    // 3. Проверяем другие имена пользователей
    console.log('\n3. Пробуем другие логины...');
    const usernames = ['admin', 'Admin', 'administrator', 'Администратор'];
    for (const un of usernames) {
        try {
            const res = await cloudPost('/api/auth/login', { username: un, password: 'Smash2206' });
            console.log(`   login("${un}", "Smash2206"): ${res.status}`, JSON.stringify(res.data).substring(0, 150));
            if (res.status === 200) {
                console.log('   ✅ Успешный логин!');
                return;
            }
        } catch(e) {}
    }

    // 4. Список пользователей через API
    console.log('\n4. Получаем список пользователей через API...');
    try {
        const res = await cloudGet('/api/users');
        console.log('   GET /api/users:', res.status, JSON.stringify(res.data).substring(0, 500));
    } catch(e) { console.log('   Ошибка:', e.message); }

    console.log('\n❌ Не удалось войти ни с одним паролем. Нужно проверить/сбросить пароль в БД.');
}

main().catch(e => console.error('Fatal:', e));
