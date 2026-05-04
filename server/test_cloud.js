import fetch from 'node-fetch';

async function testCloud() {
    const key = 'B5F3-87E6-20F4-7B7A';
    console.log(`Testing key ${key} against cloud...`);
    
    try {
        const response = await fetch('https://smartpos-pro-production.up.railway.app/api/license/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: key })
        });
        
        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testCloud();
