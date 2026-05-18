import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://postgres:CdPQsVYKiSijavcdyPWXAPKGlOkDtbQo@mainline.proxy.rlwy.net:44688/railway';
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('🔄 Creating telegram_admins table in production Postgres...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS telegram_admins (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                chat_id VARCHAR(100) UNIQUE NOT NULL,
                username VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ telegram_admins table successfully created on production database!');
    } catch (e) {
        console.error('Error creating table in production DB:', e);
    } finally {
        await pool.end();
    }
}
main();
