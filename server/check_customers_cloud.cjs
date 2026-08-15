const fetch = require('node-fetch') || globalThis.fetch;

(async () => {
    try {
        console.log('--- Checking Railway Customers Data ---');
        
        // Login as admin
        const loginRes = await fetch('https://smartpos-pro-production-f885.up.railway.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin', license_key: 'L-DEFAULT-20260418' })
        });
        
        if (!loginRes.ok) {
            console.log('Login failed:', loginRes.status, await loginRes.text());
            return;
        }
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('Logged in successfully as admin! Org ID:', loginData.user.organization_id);

        // Get Customers list
        const custRes = await fetch('https://smartpos-pro-production-f885.up.railway.app/api/customers', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const custData = await custRes.json();
        const customers = custData.customers || [];
        
        console.log(`Total customers found: ${customers.length}`);
        customers.forEach(c => {
            console.log(`ID: ${c.id} | Name: ${c.name} | Phone: ${c.phone} | Card: ${c.card_number} | Points: ${c.loyalty_points}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
