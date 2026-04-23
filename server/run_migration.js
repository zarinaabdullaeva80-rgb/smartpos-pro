import fetch from 'node-fetch';

const SYNC_SECRET = 'smartpos-sync-key-2026';
const API = 'https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup';

async function runSQL(sql, label) {
    console.log(`\n📌 ${label}...`);
    const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'run_sql', sql })
    });
    const data = await res.json();
    if (data.results?.success) {
        console.log(`   ✅ OK (rows: ${data.results.rowCount})`);
    } else {
        console.log(`   ❌ Error: ${data.results?.error || JSON.stringify(data)}`);
    }
    return data.results;
}

async function run() {
    // 1. connected_devices
    await runSQL(`
        CREATE TABLE IF NOT EXISTS connected_devices (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(255) UNIQUE NOT NULL,
            device_type VARCHAR(50) NOT NULL,
            device_name VARCHAR(255),
            user_id INTEGER REFERENCES users(id),
            app_version VARCHAR(50),
            os_info TEXT,
            status VARCHAR(50) DEFAULT 'offline',
            last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, 'Create connected_devices');

    // 2. sync_log
    await runSQL(`
        CREATE TABLE IF NOT EXISTS sync_log (
            id SERIAL PRIMARY KEY,
            sync_type VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP,
            duration_ms INTEGER,
            records_processed INTEGER DEFAULT 0,
            records_failed INTEGER DEFAULT 0,
            error_message TEXT,
            details JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, 'Create sync_log');

    // 3. sync_conflicts
    await runSQL(`
        CREATE TABLE IF NOT EXISTS sync_conflicts (
            id SERIAL PRIMARY KEY,
            entity_type VARCHAR(100) NOT NULL,
            entity_id INTEGER NOT NULL,
            client_device_id VARCHAR(255),
            server_data JSONB NOT NULL,
            client_data JSONB NOT NULL,
            server_version INTEGER,
            client_version INTEGER,
            status VARCHAR(50) DEFAULT 'pending',
            resolution VARCHAR(50),
            resolved_at TIMESTAMP,
            resolved_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, 'Create sync_conflicts');

    // 4. sync_queue
    await runSQL(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id SERIAL PRIMARY KEY,
            sync_type VARCHAR(50) NOT NULL,
            priority INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'pending',
            created_by INTEGER REFERENCES users(id),
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            error_message TEXT,
            retries INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, 'Create sync_queue');

    // 5. Indexes
    await runSQL('CREATE INDEX IF NOT EXISTS idx_connected_devices_status ON connected_devices(status)', 'Index: connected_devices status');
    await runSQL('CREATE INDEX IF NOT EXISTS idx_connected_devices_user_id ON connected_devices(user_id)', 'Index: connected_devices user_id');

    // 6. Verify
    const verify = await runSQL("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('connected_devices','sync_log','sync_conflicts','sync_queue') ORDER BY table_name", 'Verify tables exist');
    if (verify?.rows) {
        console.log('\n📋 Tables found:', verify.rows.map(r => r.table_name).join(', '));
    }

    console.log('\n🎉 Migration complete!');
}

run().catch(e => console.error('Fatal:', e));
