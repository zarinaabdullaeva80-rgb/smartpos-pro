// Скрипт для создания таблицы external_id_mapping
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createExternalIdMapping() {
    const client = await pool.connect();

    try {
        console.log('📝 Создание таблицы external_id_mapping...');

        await client.query('BEGIN');

        // Создаём таблицу
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

        console.log('✅ Таблица external_id_mapping создана');

        // Создаём индексы
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_external_id_mapping_entity 
            ON external_id_mapping(entity_type, internal_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_external_id_mapping_external 
            ON external_id_mapping(entity_type, external_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_external_id_mapping_system 
            ON external_id_mapping(external_system)
        `);

        console.log('✅ Индексы созданы');

        // Обновляем sync_log
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sync_log' AND column_name = 'direction'
                ) THEN
                    ALTER TABLE sync_log ADD COLUMN direction VARCHAR(50);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sync_log' AND column_name = 'records_total'
                ) THEN
                    ALTER TABLE sync_log ADD COLUMN records_total INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sync_log' AND column_name = 'records_success'
                ) THEN
                    ALTER TABLE sync_log ADD COLUMN records_success INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'sync_log' AND column_name = 'records_error'
                ) THEN
                    ALTER TABLE sync_log ADD COLUMN records_error INTEGER DEFAULT 0;
                END IF;
            END $$
        `);

        console.log('✅ Таблица sync_log обновлена');

        // Создаём таблицу sync_settings
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

        console.log('✅ Таблица sync_settings создана');

        await client.query('COMMIT');

        console.log('\n✅ Все таблицы для синхронизации созданы успешно!');

        // Проверка
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('external_id_mapping', 'sync_settings', 'sync_log')
            ORDER BY table_name
        `);

        console.log('\nСозданные таблицы:');
        result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createExternalIdMapping().catch(console.error);
