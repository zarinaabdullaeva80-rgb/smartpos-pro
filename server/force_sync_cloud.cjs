const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        const URLS = [
            'https://smartpos-pro-production.up.railway.app/api',
            'https://smartpos-pro-production-f885.up.railway.app/api'
        ];

        for (const baseUrl of URLS) {
            console.log(`\n--- Checking ${baseUrl} ---`);
            
            // 1. Login
            const loginRes = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
            });
            
            if (!loginRes.ok) {
                console.log(`  Login failed on ${baseUrl}`);
                continue;
            }
            
            const { token, user } = await loginRes.json();
            const orgId = user.organization_id;
            console.log(`  Logged in. Org ID: ${orgId}`);

            // 2. Ensure Category exists
            const catRes = await fetch(`${baseUrl}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: 'Общее', code: 'CAT-01' })
            });
            let categoryId = null;
            if (catRes.ok) {
                const cat = await catRes.json();
                categoryId = cat.id;
                console.log(`  Category "Общее" ensured (ID: ${categoryId})`);
            } else {
                const catsRes = await fetch(`${baseUrl}/categories`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const cats = await catsRes.json();
                categoryId = cats.categories?.[0]?.id || cats?.[0]?.id;
                console.log(`  Using existing category ID: ${categoryId}`);
            }

            // 3. Ensure Warehouse exists
            const whsRes = await fetch(`${baseUrl}/warehouses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const whs = await whsRes.json();
            let warehouseId = (whs.warehouses?.[0] || whs?.[0])?.id;

            if (!warehouseId) {
                const whRes = await fetch(`${baseUrl}/warehouses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ code: 'WH-MAIN', name: 'Основной склад' })
                });
                const wh = await whRes.json();
                warehouseId = wh.id;
                console.log(`  Warehouse created (ID: ${warehouseId})`);
            } else {
                console.log(`  Warehouse exists (ID: ${warehouseId})`);
            }

            // 4. Create Product with Category and Stock
            const prodRes = await fetch(`${baseUrl}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    code: 'KOD-TEST-777',
                    name: 'Тестовый товар (с категорией)',
                    categoryId: categoryId,
                    priceSale: 5000,
                    quantity: 10,
                    is_active: true
                })
            });

            if (prodRes.ok) {
                console.log('  ✅ Test product created successfully!');
            } else {
                console.log('  ❌ Failed to create test product:', await prodRes.text());
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
