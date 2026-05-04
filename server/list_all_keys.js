import pool from './src/config/database.js';

const result = await pool.query(`SELECT id, license_key, status, is_active, customer_name, company_name FROM licenses ORDER BY id`);
console.log('=== ALL LICENSES ===');
result.rows.forEach(l => console.log(`ID=${l.id} | Key=${l.license_key} | Status=${l.status} | Active=${l.is_active} | Company=${l.company_name}`));

// Check specifically the problematic keys
for (const key of ['B5F3-87E6-20F4-7B7A', '8D7C-3C89-06A3-19A1']) {
    const r = await pool.query('SELECT id, status, is_active FROM licenses WHERE license_key = $1', [key]);
    if (r.rows.length > 0) {
        console.log(`\n✅ Key ${key}: FOUND (id=${r.rows[0].id}, status=${r.rows[0].status}, active=${r.rows[0].is_active})`);
    } else {
        console.log(`\n❌ Key ${key}: NOT FOUND in database!`);
    }
}

await pool.end();
