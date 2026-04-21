// Скрипт для создания всех таблиц синхронизации
import pool from '../config/database.js';

async function createAllSyncTables() {
    const client = await pool.connect();

    try {
        console.log('📝 Создание всех таблиц синхронизации...\n');

        await client.query('BEGIN');

        // 1. sync_log
        console.log('1️⃣ Создание sync_log...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_log (
                id SERIAL PRIMARY KEY,
                sync_type VARCHAR(50) NOT NULL,
                direction VARCHAR(50),
                status VARCHAR(50) DEFAULT 'pending',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                duration_ms INTEGER,
                records_total INTEGER DEFAULT 0,
                records_success INTEGER DEFAULT 0,
                records_error INTEGER DEFAULT 0,
                records_processed INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                error_message TEXT,
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ sync_log создана\n');

        // 2. external_id_mapping
        console.log('2️⃣ Создание external_id_mapping...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS external_id_mapping (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                internal_id INTEGER NOT NULL,
                external_id VARCHAR(255) NOT NULL,
                external_system VARCHAR(50) DEFAULT '1C',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_type, internal_id, external_system),
                UNIQUE(entity_type, external_id, external_system)
            )
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_id_mapping_entity ON external_id_mapping(entity_type, internal_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_id_mapping_external ON external_id_mapping(entity_type, external_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_id_mapping_system ON external_id_mapping(external_system)`);
        console.log('✅ external_id_mapping создана\n');

        // 3. sync_settings
        console.log('3️⃣ Создание sync_settings...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS sync_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            INSERT INTO sync_settings (setting_key, setting_value, description)
            VALUES 
                ('auto_sync_enabled', 'false', 'Автоматическая синхронизация включена'),
                ('sync_interval_minutes', '15', 'Интервал автоматической синхронизации (минут)'),
                ('last_product_sync', NULL, 'Время последней синхронизации товаров'),
                ('last_sales_sync', NULL, 'Время последней синхронизации продаж')
            ON CONFLICT (setting_key) DO NOTHING
        `);
        console.log('✅ sync_settings создана\n');

        // 4. sync_queue
        console.log('4️⃣ Создание sync_queue...');
        await client.query(`
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
        `);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC)`);
        console.log('✅ sync_queue создана\n');

        await client.query('COMMIT');

        console.log('═══════════════════════════════════════');
        console.log('✅ Все таблицы синхронизации созданы!');
        console.log('═══════════════════════════════════════\n');

        // Проверка
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sync_log', 'external_id_mapping', 'sync_settings', 'sync_queue')
            ORDER BY table_name
        `);

        console.log('Созданные таблицы:');
        result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
        console.log('');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createAllSyncTables().catch(console.error);
