// Assign admin role to 'admin' user
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206'
});

async function assignAdminRoleToAdmin() {
    const client = await pool.connect();
    try {
        // Get admin role ID
        const adminRoleResult = await client.query(`SELECT id FROM roles WHERE code = 'admin'`);
        if (adminRoleResult.rows.length === 0) {
            throw new Error('Admin role not found!');
        }
        const adminRoleId = adminRoleResult.rows[0].id;

        // Get 'admin' user ID
        const adminUserResult = await client.query(`SELECT id FROM users WHERE username = 'admin'`);
        if (adminUserResult.rows.length === 0) {
            throw new Error('Admin user not found!');
        }
        const adminUserId = adminUserResult.rows[0].id;

        // Assign role
        await client.query(`
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            VALUES ($1, $2, $1)
            ON CONFLICT (user_id, role_id) DO NOTHING
        `, [adminUserId, adminRoleId]);

        console.log('✅ Admin role assigned to admin user');

        // Verify
        const verifyResult = await client.query(`
            SELECT u.username, r.name as role_name
            FROM user_roles ur
            JOIN users u ON ur.user_id = u.id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.username IN ('admin', 'Smash2206')
            ORDER BY u.username
        `);

        console.log('\n📊 Current role assignments:');
        verifyResult.rows.forEach(row => {
            console.log(`  - ${row.username}: ${row.role_name}`);
        });

    } finally {
        client.release();
        await pool.end();
    }
}

assignAdminRoleToAdmin();
