const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function extend() {
    try {
        await client.connect();
        const res = await client.query(`
            UPDATE licenses 
            SET expires_at = '2027-05-03', 
                is_active = true 
            WHERE license_key = 'B5F387E620F47B7A' 
               OR license_key = 'B5F3-87E6-20F4-7B7A' 
            RETURNING *
        `);
        console.log('Successfully extended license:', res.rows[0]);
    } catch (err) {
        console.error('Error extending license:', err);
    } finally {
        await client.end();
    }
}

extend();
