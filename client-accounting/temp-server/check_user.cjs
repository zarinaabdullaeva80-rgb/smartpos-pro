const pg = require('pg');
const bcrypt = require('bcrypt');

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smartpos'
});

async function main() {
    const result = await pool.query(
        "SELECT id, username, password_hash, role, user_type, license_id FROM users ORDER BY id"
    );

    console.log('=== ALL USERS ===');
    for (const user of result.rows) {
        const hashValid = user.password_hash && user.password_hash.startsWith('$2');
        console.log(`ID:${user.id} | ${user.username} | hash_valid:${hashValid} | hash_len:${user.password_hash?.length}`);
    }

    const omar = result.rows.find(u => u.username === 'omar');
    if (omar) {
        console.log('\n=== TESTING OMAR PASSWORD ===');
        console.log('Hash:', omar.password_hash);
        const testPasswords = ['omar', '123456', 'password', '1234', 'omar123', '12345678', 'qwerty', '123', 'omar1234'];
        for (const pwd of testPasswords) {
            const match = await bcrypt.compare(pwd, omar.password_hash);
            if (match) console.log(`  "${pwd}" => MATCH!`);
        }
        console.log('Done testing.');
    }

    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
