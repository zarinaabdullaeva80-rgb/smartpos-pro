const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Adding Stock to Railway Cloud ---');
        
        // 1. Login
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Topcell1', password: 'Topcell1' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;

        // 2. Get Product and Warehouse
        const prodRes = await fetch('https://smartpos-pro-production.up.railway.app/api/products', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const prods = await prodRes.json();
        const product = prods.products?.[0];

        const whRes = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const whs = await whRes.json();
        const warehouse = whs.warehouses?.[0] || whs?.[0];

        if (!product || !warehouse) {
            console.log('Product or Warehouse missing:', { product: !!product, warehouse: !!warehouse });
            return;
        }

        console.log(`Adding 100 units of "${product.name}" to "${warehouse.name}"`);

        // 3. Add Stock Movement
        const moveRes = await fetch(`https://smartpos-pro-production.up.railway.app/api/products/${product.id}/stock`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify({
                quantity: 100,
                type: 'receipt',
                warehouse_id: warehouse.id,
                reason: 'Initial stock for testing'
            })
        });

        if (moveRes.ok) {
            const moveData = await moveRes.json();
            console.log('✅ Stock added successfully. New total:', moveData.total_stock);
        } else {
            console.log('❌ Failed to add stock:', moveRes.status, await moveRes.text());
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
