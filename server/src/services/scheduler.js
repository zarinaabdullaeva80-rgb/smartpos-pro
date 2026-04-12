/**
 * Scheduler Service - Автоматическая синхронизация по расписанию
 * Использует node-cron для запуска задач синхронизации
 */

import cron from 'node-cron';
import pool from '../config/database.js';
import sync1cService from './sync1cService.js';

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * Инициализация планировщика
     */
    async init() {
        console.log('📅 Scheduler: Инициализация планировщика синхронизации...');

        // Убедимся что таблица sync_settings существует
        await this.ensureTables();

        // Загрузить настройки и запустить задачи
        await this.loadAndStartJobs();

        // Подписаться на изменения настроек (проверка каждые 5 минут)
        this.watchSettingsChanges();

        console.log('✅ Scheduler: Планировщик запущен');
    }

    /**
     * Создание необходимых таблиц
     */
    async ensureTables() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                description TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_log (
                id SERIAL PRIMARY KEY,
                sync_type VARCHAR(50) NOT NULL,
                direction VARCHAR(20) DEFAULT 'import',
                status VARCHAR(20) DEFAULT 'processing',
                records_total INTEGER DEFAULT 0,
                records_success INTEGER DEFAULT 0,
                records_error INTEGER DEFAULT 0,
                error_message TEXT,
                started_at TIMESTAMP DEFAULT NOW(),
                finished_at TIMESTAMP,
                duration_ms INTEGER,
                user_id INTEGER,
                details JSONB,
                triggered_by VARCHAR(50) DEFAULT 'manual'
            )
        `);

        // Добавить колонку triggered_by если не существует
        try {
            await pool.query(`
                ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50) DEFAULT 'manual'
            `);
        } catch (e) {
            // Игнорируем ошибку если колонка уже существует
        }

        // Инициализировать настройки по умолчанию
        const defaults = [
            { key: 'sync_enabled', value: 'false', desc: 'Включена автосинхронизация' },
            { key: 'sync_interval_minutes', value: '15', desc: 'Интервал синхронизации (мин)' },
            { key: 'sync_products', value: 'true', desc: 'Синхронизировать товары' },
            { key: 'sync_categories', value: 'true', desc: 'Синхронизировать категории' },
            { key: 'sync_counterparties', value: 'true', desc: 'Синхронизировать контрагентов' },
            { key: 'sync_sales', value: 'true', desc: 'Синхронизировать продажи' },
            { key: 'sync_direction', value: 'bidirectional', desc: 'Направление синхронизации' }
        ];

        for (const { key, value, desc } of defaults) {
            await pool.query(`
                INSERT INTO sync_settings (setting_key, setting_value, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (setting_key) DO NOTHING
            `, [key, value, desc]);
        }
    }

    /**
     * Загрузить настройки и запустить задачи
     */
    async loadAndStartJobs() {
        const settings = await this.getSettings();

        // Остановить существующие задачи
        this.stopAllJobs();

        const syncEnabled = settings['sync_enabled'] === 'true';
        const intervalMinutes = parseInt(settings['sync_interval_minutes']) || 15;

        if (!syncEnabled) {
            console.log('⏸️ Scheduler: Автосинхронизация отключена в настройках');
            return;
        }

        // Создать cron расписание
        const cronExpression = `*/${intervalMinutes} * * * *`; // Каждые N минут

        console.log(`🔄 Scheduler: Настройка задачи синхронизации - каждые ${intervalMinutes} мин`);

        const job = cron.schedule(cronExpression, async () => {
            await this.runScheduledSync(settings);
        }, {
            scheduled: true,
            timezone: 'Asia/Tashkent'
        });

        this.jobs.set('main_sync', job);
        this.isRunning = true;

        console.log(`✅ Scheduler: Задача запланирована - ${cronExpression}`);
    }

    /**
     * Получить настройки синхронизации
     */
    async getSettings() {
        try {
            const result = await pool.query('SELECT * FROM sync_settings');
            const settings = {};
            result.rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            return settings;
        } catch (error) {
            console.error('Scheduler: Ошибка получения настроек:', error);
            return {};
        }
    }

    /**
     * Выполнить запланированную синхронизацию
     */
    async runScheduledSync(settings) {
        const startTime = Date.now();
        console.log(`\n🔄 [${new Date().toISOString()}] Scheduler: Запуск автоматической синхронизации...`);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const syncTypes = [];
            if (settings['sync_categories'] === 'true') syncTypes.push('categories');
            if (settings['sync_products'] === 'true') syncTypes.push('products');
            if (settings['sync_counterparties'] === 'true') syncTypes.push('counterparties');
            if (settings['sync_sales'] === 'true') syncTypes.push('sales');

            let totalSuccess = 0;
            let totalError = 0;
            const details = [];

            for (const syncType of syncTypes) {
                try {
                    const result = await this.syncEntity(syncType, settings['sync_direction'] || 'bidirectional');
                    totalSuccess += result.success || 0;
                    totalError += result.error || 0;
                    details.push({
                        entity: syncType,
                        success: result.success,
                        error: result.error,
                        message: result.message
                    });
                    console.log(`   ✅ ${syncType}: ${result.success} успешно, ${result.error} ошибок`);
                } catch (err) {
                    totalError++;
                    details.push({
                        entity: syncType,
                        success: 0,
                        error: 1,
                        message: err.message
                    });
                    console.log(`   ❌ ${syncType}: ошибка - ${err.message}`);
                }
            }

            const duration = Date.now() - startTime;

            // Записать в лог
            await client.query(`
                INSERT INTO sync_log (
                    sync_type, direction, status, records_total, records_success, 
                    records_error, started_at, finished_at, duration_ms, 
                    details, triggered_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)
            `, [
                'auto_sync',
                settings['sync_direction'] || 'bidirectional',
                totalError > 0 ? 'partial' : 'success',
                totalSuccess + totalError,
                totalSuccess,
                totalError,
                new Date(startTime),
                duration,
                JSON.stringify(details),
                'scheduler'
            ]);

            await client.query('COMMIT');

            console.log(`✅ Scheduler: Синхронизация завершена за ${duration}мс (успешно: ${totalSuccess}, ошибок: ${totalError})\n`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Scheduler: Критическая ошибка синхронизации:', error);

            // Записать ошибку в лог
            try {
                await pool.query(`
                    INSERT INTO sync_log (
                        sync_type, direction, status, error_message, 
                        started_at, finished_at, duration_ms, triggered_by
                    )
                    VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
                `, [
                    'auto_sync',
                    settings['sync_direction'] || 'bidirectional',
                    'failed',
                    error.message,
                    new Date(startTime),
                    Date.now() - startTime,
                    'scheduler'
                ]);
            } catch (logError) {
                console.error('Scheduler: Ошибка записи в лог:', logError);
            }
        } finally {
            client.release();
        }
    }

    /**
     * Синхронизация отдельной сущности
     * Возвращает { success: number, error: number, message: string }
     */
    async syncEntity(entityType, direction) {
        try {
            return await sync1cService.syncEntity(entityType, direction);
        } catch (error) {
            console.error(`Scheduler: Error in syncEntity for ${entityType}:`, error);
            return { success: 0, error: 1, message: error.message };
        }
    }

    /**
     * Следить за изменениями настроек
     */
    watchSettingsChanges() {
        // Проверять изменения каждые 5 минут
        setInterval(async () => {
            try {
                const settings = await this.getSettings();
                const syncEnabled = settings['sync_enabled'] === 'true';

                if (syncEnabled && !this.isRunning) {
                    console.log('📅 Scheduler: Обнаружено включение автосинхронизации, перезапуск...');
                    await this.loadAndStartJobs();
                } else if (!syncEnabled && this.isRunning) {
                    console.log('📅 Scheduler: Обнаружено выключение автосинхронизации, остановка...');
                    this.stopAllJobs();
                }
            } catch (error) {
                console.error('Scheduler: Ошибка проверки настроек:', error);
            }
        }, 5 * 60 * 1000); // 5 минут
    }

    /**
     * Остановить все задачи
     */
    stopAllJobs() {
        for (const [name, job] of this.jobs) {
            console.log(`⏹️ Scheduler: Остановка задачи "${name}"`);
            job.stop();
        }
        this.jobs.clear();
        this.isRunning = false;
    }

    /**
     * Получить статус планировщика
     */
    getStatus() {
        return {
            running: this.isRunning,
            jobsCount: this.jobs.size,
            jobs: Array.from(this.jobs.keys())
        };
    }

    /**
     * Принудительно запустить синхронизацию
     */
    async triggerNow() {
        const settings = await this.getSettings();
        await this.runScheduledSync(settings);
    }
}

// Singleton instance
const schedulerService = new SchedulerService();

export default schedulerService;
