const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Railway All Users ---');
        
        // Login as admin or Topcell1 to get a token
        const loginRes = await fetch('https://smartpos-pro-production-f885.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        
        if (!loginRes.ok) {
            console.log('Login failed:', loginRes.status);
            return;
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Попробуем получить список всех пользователей или организаций.
        // На сервере может быть роут для этого, либо мы можем использовать секрет миграции
        // для выполнения произвольного SELECT запроса через специальный эндпоинт миграции.
        // Посмотрим, есть ли эндпоинт миграции в server/src/routes/ или в server/src/index.js!
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
