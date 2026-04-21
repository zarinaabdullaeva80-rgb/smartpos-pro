// Script to run RBAC migration
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database connection
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'accounting_db',
    user: 'postgres',
    password: 'Smash2206'
});

async function runRBACMigration() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        // Read RBAC migration file
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007-rbac-system.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing RBAC migration (007-rbac-system.sql)...');
        await client.query(sql);

        console.log('✅ RBAC Migration completed successfully!');

        // Verify tables were created
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('permissions', 'roles', 'role_permissions', 'user_roles')
            ORDER BY table_name
        `);

        console.log('\n✅ Created RBAC tables:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Show stats
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM permissions) as permissions_count,
                (SELECT COUNT(*) FROM roles) as roles_count,
                (SELECT COUNT(*) FROM role_permissions) as role_permissions_count,
                (SELECT COUNT(*) FROM user_roles) as user_roles_count
        `);

        console.log('\n📊 RBAC Statistics:');
        console.log(`  - Permissions: ${stats.rows[0].permissions_count}`);
        console.log(`  - Roles: ${stats.rows[0].roles_count}`);
        console.log(`  - Role-Permission mappings: ${stats.rows[0].role_permissions_count}`);
        console.log(`  - User-Role assignments: ${stats.rows[0].user_roles_count}`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runRBACMigration()
    .then(() => {
        console.log('\n🎉 RBAC system configured successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    });
