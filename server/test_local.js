import pool from './src/config/database.js';

async function testLocal() {
    const key = 'B5F3-87E6-20F4-7B7A';
    console.log(`Testing key ${key} against local DB...`);
    
    try {
        const result = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [key]);
        if (result.rows.length > 0) {
            const license = result.rows[0];
            console.log('✅ License found locally!');
            console.log('ID:', license.id);
            console.log('Status:', license.status);
            console.log('Is Active:', license.is_active);
        } else {
            console.error('❌ License NOT found locally!');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

testLocal();
