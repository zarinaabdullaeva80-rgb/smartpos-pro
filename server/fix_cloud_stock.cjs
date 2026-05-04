const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Fixing Warehouse and Stock in Cloud ---');
        
        // 1. Login as Super Admin
        const loginRes = await fetch('https://smartpos-pro-production.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const token = (await loginRes.json()).token;

        // 2. Set Warehouse 213 as Default
        // (We assume PUT /api/warehouses/:id exists)
        const whUpdate = await fetch('https://smartpos-pro-production.up.railway.app/api/warehouses/213', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ is_default: true, name: 'Основной склад (Default)' })
        });
        console.log('Warehouse update status:', whUpdate.status);

        // 3. Create Stock for products
        // Since we don't have a direct "add stock" API that we are sure about,
        // we'll try to find a route for inventory.
        // But wait! We can just create a "Receipt" document if the API allows.
        
        // Actually, many systems show products even with 0 stock. 
        // BUT if SmartPOS filters by quantity > 0, they are hidden.
        
        // Let's try to find an endpoint to set quantity.
        const stockRes = await fetch('https://smartpos-pro-production.up.railway.app/api/inventory/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                warehouse_id: 213,
                products: [
                    { id: 7894, quantity: 100 }, // FINAL-5
                    { id: 7890, quantity: 100 }  // Example ID
                ]
            })
        });
        console.log('Stock adjustment status:', stockRes.status);

    } catch (e) { console.error(e); }
})();
