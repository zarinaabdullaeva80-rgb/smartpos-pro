/**
 * Сервис автоматического резервного копирования
 * Хранит бэкапы за 1 год с подразделением на daily/weekly/monthly
 */
import pool from '../config/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

        // Настройки хранения (1 год)
        this.retentionConfig = {
            daily: 30,     // Дневные бэкапы хранить 30 дней
            weekly: 90,    // Недельные бэкапы хранить 3 месяца
            monthly: 365,  // Месячные бэкапы хранить 1 год
            manual: 365    // Ручные бэкапы хранить 1 год
        };

        this.dailyBackupHour = 2; // 2:00 ночи
        this.lastBackupTime = null;
        this.schedulerInterval = null;
    }

    /**
     * Инициализация директорий бэкапов
     */
    init() {
        const dirs = [
            this.backupDir,
            path.join(this.backupDir, 'daily'),
            path.join(this.backupDir, 'weekly'),
            path.join(this.backupDir, 'monthly'),
            path.join(this.backupDir, 'manual')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log('📁 Создана директория для бэкапов:', dir);
            }
        });
    }

    /**
     * Запустить планировщик автоматических бэкапов
     */
    startScheduler() {
        this.init();
        console.log('🕐 Запущен планировщик бэкапов (хранение: 1 год)');

        // Проверять каждый час
        this.schedulerInterval = setInterval(() => {
            this.runScheduledBackups();
        }, 60 * 60 * 1000);

        // Очистка старых бэкапов раз в день
        setInterval(() => {
            this.cleanupAllBackups();
        }, 24 * 60 * 60 * 1000);

        // Запустить первую проверку через 1 минуту
        setTimeout(() => this.runScheduledBackups(), 60 * 1000);
    }

    /**
     * Остановить планировщик
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            console.log('⏹️ Планировщик бэкапов остановлен');
        }
    }

    /**
     * Запустить запланированные бэкапы
     */
    async runScheduledBackups() {
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();
        const dayOfMonth = now.getDate();

        // Запускать бэкапы только в заданный час
        if (hour !== this.dailyBackupHour) return;

        try {
            // Ежедневный бэкап
            await this.createBackup('daily');

            // Еженедельный бэкап (воскресенье)
            if (dayOfWeek === 0) {
                await this.createBackup('weekly');
            }

            // Ежемесячный бэкап (1-е число)
            if (dayOfMonth === 1) {
                await this.createBackup('monthly');
            }
        } catch (error) {
            console.error('❌ Ошибка планового бэкапа:', error.message);
        }
    }

    /**
     * Создать бэкап базы данных
     * @param {string} type - Тип бэкапа: 'daily', 'weekly', 'monthly', 'manual'
     */
    async createBackup(type = 'manual') {
        try {
            this.init();
            const startTime = Date.now();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `smartpos_${type}_${timestamp}.sql`;
            const typeDir = path.join(this.backupDir, type);
            const filepath = path.join(typeDir, filename);

            console.log(`💾 Создание ${type} бэкапа: ${filename}`);

            // Получить параметры подключения к БД
            const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db';
            const url = new URL(dbUrl);

            process.env.PGPASSWORD = url.password;

            const command = `pg_dump -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${url.pathname.slice(1)} -F p -f "${filepath}"`;

            await execAsync(command);

            const stats = fs.statSync(filepath);
            const duration = Date.now() - startTime;
            this.lastBackupTime = new Date();

            console.log(`✅ ${type} бэкап создан: ${filename} (${this.formatBytes(stats.size)}, ${duration}ms)`);

            // Записать в лог
            await this.logBackup(filename, stats.size, 'success', null, type);

            // Сжать месячные и недельные бэкапы
            if (type === 'monthly' || type === 'weekly') {
                await this.compressBackup(filepath);
            }

            return {
                success: true,
                filename,
                size: stats.size,
                sizeMB: this.formatBytes(stats.size),
                type,
                duration
            };
        } catch (error) {
            console.error(`❌ Ошибка ${type} бэкапа:`, error.message);
            await this.logBackup(null, 0, 'error', error.message, type);
            return { success: false, error: error.message };
        }
    }

    /**
     * Сжать бэкап файл
     */
    async compressBackup(filepath) {
        try {
            const zipPath = `${filepath}.zip`;

            if (process.platform === 'win32') {
                await execAsync(`powershell Compress-Archive -Path "${filepath}" -DestinationPath "${zipPath}" -Force`);
            } else {
                await execAsync(`gzip -c "${filepath}" > "${filepath}.gz"`);
            }

            // Удалить несжатый файл
            fs.unlinkSync(filepath);
            console.log(`📦 Бэкап сжат: ${path.basename(zipPath)}`);
            return true;
        } catch (error) {
            console.error('Ошибка сжатия бэкапа:', error.message);
            return false;
        }
    }

    /**
     * Восстановить из бэкапа
     */
    async restoreFromBackup(filepath) {
        try {
            console.log(`🔄 Восстановление из бэкапа: ${path.basename(filepath)}`);

            // Если файл сжат - разжать
            let sqlFile = filepath;
            if (filepath.endsWith('.zip')) {
                const extractDir = path.dirname(filepath);
                await execAsync(`powershell Expand-Archive -Path "${filepath}" -DestinationPath "${extractDir}" -Force`);
                sqlFile = filepath.replace('.zip', '');
            } else if (filepath.endsWith('.gz')) {
                await execAsync(`gzip -d -k "${filepath}"`);
                sqlFile = filepath.replace('.gz', '');
            }

            const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/accounting_db';
            const url = new URL(dbUrl);

            process.env.PGPASSWORD = url.password;

            const command = `psql -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${url.pathname.slice(1)} -f "${sqlFile}"`;

            await execAsync(command);

            console.log('✅ База данных восстановлена из бэкапа');
            return { success: true };
        } catch (error) {
            console.error('❌ Ошибка восстановления:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Очистка старых бэкапов по всем категориям
     */
    async cleanupAllBackups() {
        console.log('🧹 Очистка старых бэкапов...');
        let totalDeleted = 0;
        let totalFreed = 0;

        for (const [type, retentionDays] of Object.entries(this.retentionConfig)) {
            const result = await this.cleanupBackupsByType(type, retentionDays);
            totalDeleted += result.deleted;
            totalFreed += result.freedBytes;
        }

        console.log(`✅ Очистка завершена. Удалено: ${totalDeleted} файлов, освобождено: ${this.formatBytes(totalFreed)}`);
        return { totalDeleted, totalFreed: this.formatBytes(totalFreed) };
    }

    /**
     * Очистка бэкапов по типу
     */
    async cleanupBackupsByType(type, retentionDays) {
        const typeDir = path.join(this.backupDir, type);
        if (!fs.existsSync(typeDir)) return { deleted: 0, freedBytes: 0 };

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let deleted = 0;
        let freedBytes = 0;

        try {
            const files = fs.readdirSync(typeDir);

            for (const file of files) {
                const filepath = path.join(typeDir, file);
                const stats = fs.statSync(filepath);

                if (stats.mtime < cutoffDate) {
                    freedBytes += stats.size;
                    fs.unlinkSync(filepath);
                    deleted++;
                    console.log(`🗑️ Удалён ${type} бэкап: ${file}`);
                }
            }
        } catch (error) {
            console.error(`Ошибка очистки ${type} бэкапов:`, error.message);
        }

        return { deleted, freedBytes };
    }

    /**
     * Получить список всех бэкапов
     */
    getBackupsList() {
        this.init();

        const backups = {
            daily: [],
            weekly: [],
            monthly: [],
            manual: []
        };

        for (const type of Object.keys(backups)) {
            const typeDir = path.join(this.backupDir, type);

            if (!fs.existsSync(typeDir)) continue;

            try {
                const files = fs.readdirSync(typeDir);

                backups[type] = files
                    .filter(f => f.startsWith('smartpos_') || f.startsWith('auto_backup_'))
                    .map(file => {
                        const filepath = path.join(typeDir, file);
                        const stats = fs.statSync(filepath);

                        return {
                            filename: file,
                            path: filepath,
                            size: stats.size,
                            sizeMB: this.formatBytes(stats.size),
                            createdAt: stats.mtime.toISOString(),
                            type
                        };
                    })
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } catch (error) {
                console.error(`Ошибка чтения ${type} бэкапов:`, error.message);
            }
        }

        return backups;
    }

    /**
     * Получить статистику бэкапов
     */
    getBackupStats() {
        const backups = this.getBackupsList();
        let totalSize = 0;
        let totalCount = 0;
        let oldestDate = null;
        let newestDate = null;

        for (const [type, files] of Object.entries(backups)) {
            for (const backup of files) {
                totalSize += backup.size;
                totalCount++;

                const date = new Date(backup.createdAt);
                if (!oldestDate || date < oldestDate) oldestDate = date;
                if (!newestDate || date > newestDate) newestDate = date;
            }
        }

        return {
            totalBackups: totalCount,
            totalSize: this.formatBytes(totalSize),
            daily: backups.daily.length,
            weekly: backups.weekly.length,
            monthly: backups.monthly.length,
            manual: backups.manual.length,
            oldestBackup: oldestDate?.toISOString(),
            newestBackup: newestDate?.toISOString(),
            lastBackup: this.lastBackupTime?.toISOString(),
            backupDir: this.backupDir,
            retentionConfig: this.retentionConfig
        };
    }

    /**
     * Записать информацию о бэкапе в БД
     */
    async logBackup(filename, size, status, error = null, type = 'manual') {
        try {
            // Создать таблицу если не существует
            await pool.query(`
                CREATE TABLE IF NOT EXISTS backup_logs (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255),
                    backup_type VARCHAR(20) DEFAULT 'manual',
                    size_bytes BIGINT,
                    status VARCHAR(20),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // Добавить колонку backup_type если не существует
            await pool.query(`
                ALTER TABLE backup_logs ADD COLUMN IF NOT EXISTS backup_type VARCHAR(20) DEFAULT 'manual'
            `);

            await pool.query(`
                INSERT INTO backup_logs (filename, backup_type, size_bytes, status, error_message)
                VALUES ($1, $2, $3, $4, $5)
            `, [filename, type, size, status, error]);
        } catch (e) {
            console.error('Ошибка записи лога бэкапа:', e.message);
        }
    }

    /**
     * Получить статус последнего бэкапа
     */
    async getStatus() {
        try {
            const result = await pool.query(`
                SELECT * FROM backup_logs 
                ORDER BY created_at DESC 
                LIMIT 10
            `);

            return {
                lastBackup: this.lastBackupTime,
                logs: result.rows,
                stats: this.getBackupStats()
            };
        } catch (e) {
            return {
                lastBackup: this.lastBackupTime,
                error: e.message,
                stats: this.getBackupStats()
            };
        }
    }

    /**
     * Форматировать размер файла
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export const backupService = new BackupService();
export default backupService;
