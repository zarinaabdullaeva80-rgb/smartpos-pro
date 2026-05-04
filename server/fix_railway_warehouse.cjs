const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Fixing Railway Cloud: Creating Default Warehouse ---');
        
        // 1. Login
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
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
        console.log(`Logged in. Org ID: ${loginData.user.organization_id}`);

        // 2. Create Warehouse
        const whRes = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({
                code: 'WH-MAIN-142',
                name: 'Основной склад',
                address: 'Облако',
                is_active: true
            })
        });

        if (whRes.ok) {
            const whData = await whRes.json();
            console.log('✅ Warehouse created successfully:', whData.name, `(ID: ${whData.id})`);
            console.log('\nТеперь товары должны появиться в мобильном приложении.');
        } else {
            const err = await whRes.text();
            console.log('❌ Failed to create warehouse:', whRes.status, err);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
