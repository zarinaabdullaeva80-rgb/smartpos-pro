const pg = require('pg');
const bcrypt = require('bcrypt');

async function check() {
    const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });
    
    const r = await pool.query("SELECT id, username, password_hash, organization_id, license_id FROM users WHERE username = 'Smash2206'");
    
    if (r.rows.length === 0) {
        console.log('User not found!');
        await pool.end();
        return;
    }

    const user = r.rows[0];
    console.log('User found:', {
        id: user.id,
        username: user.username,
        organization_id: user.organization_id,
        license_id: user.license_id,
        has_password_hash: !!user.password_hash,
        hash_length: user.password_hash?.length
    });

    const match = await bcrypt.compare('Smash2206', user.password_hash);
    console.log('Password "Smash2206" matches:', match);

    if (!match) {
        // Fix it: reset password to Smash2206
        const newHash = await bcrypt.hash('Smash2206', 10);
        await pool.query("UPDATE users SET password_hash = $1 WHERE username = 'Smash2206'", [newHash]);
        console.log('Password RESET to Smash2206');

        // Verify
        const r2 = await pool.query("SELECT password_hash FROM users WHERE username = 'Smash2206'");
        const match2 = await bcrypt.compare('Smash2206', r2.rows[0].password_hash);
        console.log('Verification after reset:', match2);
    }

    await pool.end();
}

check().catch(e => console.error(e));
