// Script to assign admin role to existing users
import pg from 'pg';

const { Pool } = pg;

// Database connection
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206'
});

async function assignAdminRole() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...\n');

        // Get admin role ID
        const adminRoleResult = await client.query(`
            SELECT id, name FROM roles WHERE code = 'admin'
        `);

        if (adminRoleResult.rows.length === 0) {
            throw new Error('Admin role not found! Run RBAC migration first.');
        }

        const adminRole = adminRoleResult.rows[0];
        console.log(`✓ Found admin role: ${adminRole.name} (ID: ${adminRole.id})\n`);

        // Get all existing admin users
        const usersResult = await client.query(`
            SELECT id, username, email, role 
            FROM users 
            WHERE role = 'Администратор' OR username = 'Smash2206'
        `);

        console.log(`Found ${usersResult.rows.length} admin user(s):\n`);
        usersResult.rows.forEach(user => {
            console.log(`  - ${user.username} (${user.email}) - ${user.role}`);
        });

        // Assign admin role to all admin users
        for (const user of usersResult.rows) {
            await client.query(`
                INSERT INTO user_roles (user_id, role_id, assigned_by)
                VALUES ($1, $2, 1)
                ON CONFLICT (user_id, role_id) DO NOTHING
            `, [user.id, adminRole.id]);

            console.log(`✓ Assigned admin role to: ${user.username}`);
        }

        // Verify role assignments
        const verifyResult = await client.query(`
            SELECT u.username, r.name as role_name
            FROM user_roles ur
            JOIN users u ON ur.user_id = u.id
            JOIN roles r ON ur.role_id = r.id
            ORDER BY u.username
        `);

        console.log(`\n📊 Current role assignments (${verifyResult.rows.length} total):`);
        verifyResult.rows.forEach(row => {
            console.log(`  - ${row.username}: ${row.role_name}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

assignAdminRole()
    .then(() => {
        console.log('\n🎉 Admin role assignment completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Failed:', error);
        process.exit(1);
    });
