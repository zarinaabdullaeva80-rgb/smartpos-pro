import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://smartpos-pro-production-f885.up.railway.app';

async function run() {
    // 1. Логин
    console.log('1. Logging in...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'cafe_admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) { console.error('Login failed:', loginData); return; }
    const token = loginData.token;
    console.log('✅ Logged in, org_id:', loginData.user?.organization_id);

    // 2. Загрузка файла
    const filePath = path.join(__dirname, 'import-products.xlsx');
    console.log('2. Uploading file:', filePath);
    console.log('   File size:', fs.statSync(filePath).size, 'bytes');

    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(filePath)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    formData.append('file', fileBlob, 'import.xlsx');

    console.log('3. Sending to /api/import/products/auto ...');
    const importRes = await fetch(`${BASE_URL}/api/import/products/auto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });

    const result = await importRes.json();
    if (!importRes.ok) {
        console.error('❌ Import failed:', result);
        return;
    }

    console.log('✅ Import result:');
    console.log(`   Total rows: ${result.totalRows}`);
    console.log(`   Imported:   ${result.imported}`);
    console.log(`   Updated:    ${result.updated}`);
    console.log(`   Errors:     ${result.errorsCount}`);
    if (result.errors?.length > 0) {
        console.log('   First errors:', result.errors.slice(0, 3));
    }
    console.log('   Mapping used:', Object.entries(result.mapping || {}).slice(0, 6).map(([k,v]) => `${k}→${v}`).join(', '));
}

run().catch(console.error);
