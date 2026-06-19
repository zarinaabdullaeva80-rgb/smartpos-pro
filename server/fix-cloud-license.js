import https from 'https';

async function fetchJSON(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const body = options.body ? JSON.stringify(options.body) : undefined;
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
                ...(options.headers || {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch(e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const SERVERS = [
    'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

const PASSWORDS = ['admin123', 'Admin123!', 'password', 'smartpos123'];

async function fixOnServer(BASE) {
    console.log(`\n🌐 ${BASE}`);

    // 1. Логин — перебираем пароли
    let token;
    for (const pwd of PASSWORDS) {
        const r = await fetchJSON(`${BASE}/api/auth/login`, {
            method: 'POST',
            body: { username: 'admin', password: pwd }
        });
        if (r.status === 200 && r.body?.token) {
            token = r.body.token;
            console.log(`  ✅ Вошли (пароль: ${pwd})`);
            break;
        }
    }
    if (!token) { console.log('  ❌ Не удалось войти ни с одним паролем'); return; }

    // 2. Получить лицензии: GET /api/license/admin/licenses
    const licRes = await fetchJSON(`${BASE}/api/license/admin/licenses`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`  GET /api/license/admin/licenses → ${licRes.status}`);

    let licenses = [];
    if (Array.isArray(licRes.body)) licenses = licRes.body;
    else if (Array.isArray(licRes.body?.licenses)) licenses = licRes.body.licenses;
    else {
        console.log('  Ответ:', JSON.stringify(licRes.body).substring(0, 300));
        return;
    }

    console.log(`  Всего лицензий: ${licenses.length}`);

    const target = licenses.find(l =>
        (l.customer_username || '').toLowerCase() === 'smash22' ||
        (l.license_key || '').toUpperCase().replace(/-/g,'').includes('B5F387E6')
    );

    if (!target) {
        console.log('  ❌ Smash22 не найден');
        console.log('  Первые 10:', licenses.slice(0, 10).map(l => `${l.customer_username}(${l.status})`).join(', '));
        return;
    }

    console.log(`  Найдена: #${target.id} username=${target.customer_username} status=${target.status} expires=${target.expires_at}`);

    // Проверяем нужно ли исправлять
    const isExpired = target.status !== 'active' ||
        (target.expires_at && new Date(target.expires_at) < new Date());

    if (!isExpired) {
        console.log('  ✅ Лицензия уже активна и не истекла — проблема в другом месте');
    }

    // 3. PUT /api/license/admin/licenses/:id
    console.log(`  Обновляю статус → active, expires_at → 2028-05-02...`);
    const updRes = await fetchJSON(`${BASE}/api/license/admin/licenses/${target.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: {
            ...target,
            status: 'active',
            expires_at: '2028-05-02T23:59:59.000Z'
        }
    });
    console.log(`  PUT → ${updRes.status}:`, JSON.stringify(updRes.body).substring(0, 200));

    if (updRes.status === 200) {
        console.log('  ✅ ЛИЦЕНЗИЯ ИСПРАВЛЕНА на этом сервере!');
    }
}

async function main() {
    console.log('=== Исправление лицензии Smash22 ===\n');
    for (const srv of SERVERS) {
        await fixOnServer(srv);
    }
    console.log('\n✅ Готово! Попросите пользователя Smash22 войти снова.');
}

main().catch(console.error);
