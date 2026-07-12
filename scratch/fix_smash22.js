import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    console.log('Checking local DB for Smash22...');
    
    // Check user
    const userRes = await pool.query(`
        SELECT u.id, u.username, u.role, u.user_type, u.license_id, u.organization_id, 
               l.license_key, l.status, l.expires_at
        FROM users u
        LEFT JOIN licenses l ON u.license_id = l.id
        WHERE LOWER(u.username) = 'smash22'
    `);
    console.log('User data:', JSON.stringify(userRes.rows, null, 2));
    
    // If license_id is set but license doesn't exist, show orphan
    if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        if (user.license_id && !user.license_key) {
            console.log(`\n⚠️  USER ${user.username} has license_id=${user.license_id} but NO LICENSE FOUND (orphan!)`);
            
            // Find the active license B5F3-87E6-20F4-7B7A
            const licRes = await pool.query(`SELECT id, license_key, status, expires_at, organization_id FROM licenses WHERE license_key = 'B5F3-87E6-20F4-7B7A'`);
            console.log('Active license in local DB:', JSON.stringify(licRes.rows, null, 2));
            
            if (licRes.rows.length > 0) {
                const newLic = licRes.rows[0];
                console.log(`\n🔧 Fixing: Setting license_id=${newLic.id}, organization_id=${newLic.organization_id} for ${user.username}`);
                await pool.query('UPDATE users SET license_id = $1, organization_id = $2 WHERE id = $3', [newLic.id, newLic.organization_id, user.id]);
                console.log('✅ Fixed!');
            } else {
                console.log('❌ License B5F3-87E6-20F4-7B7A not found in local DB either!');
                // List all active licenses
                const allLics = await pool.query(`SELECT id, license_key, status, customer_username FROM licenses WHERE status = 'active' LIMIT 10`);
                console.log('Active licenses in local DB:', JSON.stringify(allLics.rows, null, 2));
            }
        } else if (user.license_key) {
            console.log(`\n✅ User ${user.username} has valid license: ${user.license_key} (${user.status}, expires: ${user.expires_at})`);
        }
    }
    
    await pool.end();
}

main().catch(console.error);
