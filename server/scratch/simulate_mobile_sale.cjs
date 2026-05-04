const fetch = require('node-fetch');

const CLOUD_URL = 'https://smartpos-pro-production.up.railway.app/api';
const SYNC_SECRET = 'smartpos-sync-key-2026';
const LICENSE_KEY = '76C3-582E-B7B7-4D9D'; // Active license from previous tests

async function simulateMobileSale() {
    console.log('--- Simulating Mobile Sale to Cloud ---');
    
    const saleData = {
        receipts: [{
            document_number: `MOB-${Date.now()}`,
            final_amount: 500,
            payment_type: 'cash',
            created_at: new Date().toISOString(),
            items: [{
                code: '00001', // Product that exists on local and should be synced to cloud
                quantity: 2,
                price: 250,
                total_price: 500
            }]
        }],
        device_id: 'SAMSUNG-S21-SIMULATOR'
    };

    const res = await fetch(`${CLOUD_URL}/sync/receipts`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TEST_TOKEN || ''}`, // Usually mobile uses JWT, but sync endpoint might need it
            'x-sync-key': 'smartpos-sync-key' // The key expected by sync.js line 276
        },
        body: JSON.stringify(saleData)
    });

    const data = await res.json();
    console.log('Cloud Sync Response:', JSON.stringify(data, null, 2));

    if (data.success) {
        console.log('✅ Sale posted to cloud. Now try pulling it locally...');
    }
}

simulateMobileSale();
