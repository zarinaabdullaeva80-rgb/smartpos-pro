const axios = require('axios');

async function testLogin() {
    const url = 'https://smartpos-pro-production-f885.up.railway.app/api/auth/login';
    const payload = {
        username: 'Nurullo2626',
        password: 'wrong_password' // testing if it gets past the "license required" check
    };

    console.log('Testing login for:', payload.username);
    console.log('URL:', url);

    try {
        const response = await axios.post(url, payload);
        console.log('Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error Code:', error.response.status);
            console.log('Error Data:', error.response.data);
            
            if (error.response.data.error === 'Неверные учетные данные') {
                console.log('✅ TEST PASSED: Server correctly identified the user and didn\'t ask for a license key!');
            } else if (error.response.data.code === 'LICENSE_KEY_REQUIRED') {
                console.log('❌ TEST FAILED: Server is still asking for a license key.');
            }
        } else {
            console.log('Request Error:', error.message);
        }
    }
}

testLogin();
