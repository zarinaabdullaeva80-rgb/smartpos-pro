const pg = require('pg');
const bcrypt = require('bcrypt');

async function createUser() {
    const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });
    
    // Check if user already exists
    const existing = await pool.query("SELECT id, username, organization_id FROM users WHERE LOWER(username) = 'smash2206'");
    
    if (existing.rows.length > 0) {
        console.log('User exists, updating:', existing.rows[0]);
        const hash = await bcrypt.hash('Smash2206', 10);
        await pool.query(
            'UPDATE users SET password_hash = $1, organization_id = 13, license_id = 12, role = $2, user_type = $3, is_active = true WHERE LOWER(username) = $4',
            [hash, 'Администратор', 'owner', 'smash2206']
        );
        console.log('Updated successfully');
    } else {
        console.log('User does not exist, creating...');
        const hash = await bcrypt.hash('Smash2206', 10);
        const r = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, role, user_type, is_active, organization_id, license_id) 
             VALUES ($1, $2, $3, $4, $5, $6, true, 13, 12) RETURNING id, username`,
            ['Smash2206', 'smash2206@smartpos.local', hash, 'Samandar', 'Администратор', 'owner']
        );
        console.log('Created:', r.rows[0]);
    }
    
    // Verify
    const verify = await pool.query("SELECT id, username, organization_id, license_id, role, user_type, is_active FROM users WHERE LOWER(username) = 'smash2206'");
    console.log('Final state:', JSON.stringify(verify.rows[0], null, 2));
    
    await pool.end();
}

createUser().catch(e => { console.error('Error:', e); process.exit(1); });
