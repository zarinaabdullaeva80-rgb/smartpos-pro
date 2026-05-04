
const fetch = require('node-fetch') || globalThis.fetch;

async function testFullFlow() {
  const LOCAL_API = 'http://localhost:5000/api';
  const CLOUD_API = 'https://smartpos-pro-production.up.railway.app/api';
  const MASTER_KEY = 'smartpos-master-2026';

  try {
    console.log('1. Creating new license locally...');
    const createRes = await fetch(`${LOCAL_API}/onboarding/create-license`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-master-key': MASTER_KEY
      },
      body: JSON.stringify({
        company_name: 'Test-Org-' + Date.now(),
        plan: 'pro',
        days: 30
      })
    });
    
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error('Create license failed: ' + JSON.stringify(createData));
    
    const { license_key, organization } = createData;
    console.log(`✅ Created license: ${license_key} for ${organization.name}`);

    console.log('\n2. Registering admin for the new organization...');
    const regRes = await fetch(`${LOCAL_API}/onboarding/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key,
        company_name: organization.name,
        admin_username: 'testadmin_' + Date.now().toString(36),
        admin_password: 'password123',
        admin_full_name: 'Test Admin'
      })
    });

    const regData = await regRes.json();
    if (!regRes.ok) throw new Error('Registration failed: ' + JSON.stringify(regData));
    console.log(`✅ Admin registered: ${regData.user.username}`);
    const token = regData.token;

    console.log('\n3. Creating a cashier (employee) in this organization...');
    const employeeUsername = 'cashier_' + Date.now().toString(36);
    const empRes = await fetch(`${LOCAL_API}/users`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        username: employeeUsername,
        password: 'password123',
        full_name: 'Test Cashier',
        role: 'Кассир',
        email: employeeUsername + '@test.com'
      })
    });

    const empData = await empRes.json();
    if (!empRes.ok) throw new Error('Employee creation failed: ' + JSON.stringify(empData));
    console.log(`✅ Cashier created: ${employeeUsername}`);

    console.log('\n4. Verifying if cashier synced to the cloud (waiting 3s)...');
    await new Promise(r => setTimeout(r, 3000));

    const cloudLoginRes = await fetch(`${CLOUD_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: employeeUsername,
        password: 'password123'
      })
    });

    if (cloudLoginRes.ok) {
      const cloudData = await cloudLoginRes.json();
      console.log(`🚀 SUCCESS! Cashier logged into CLOUD! Token: ${cloudData.token.substring(0, 20)}...`);
      console.log(`Org ID on Cloud: ${cloudData.user.organization_id}`);
    } else {
      const cloudErr = await cloudLoginRes.json();
      console.error(`❌ Cloud login failed: ${JSON.stringify(cloudErr)}`);
    }

  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testFullFlow();
