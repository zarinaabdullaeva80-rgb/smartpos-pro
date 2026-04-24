import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { backupService } from '../services/backup.js';

const router = express.Router();
const execAsync = promisify(exec);

// Получить информацию о БД
router.get('/info', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const [sizeResult, tablesResult, connectionsResult] = await Promise.all([
            pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`),
            pool.query(`
                SELECT schemaname, tablename, 
                       pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size,
                       (SELECT count(*) FROM information_schema.columns WHERE table_name = tablename) as columns
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
            `),
            pool.query(`
                SELECT count(*) as total,
                       count(*) FILTER (WHERE state = 'active') as active,
                       count(*) FILTER (WHERE state = 'idle') as idle
                FROM pg_stat_activity
            `)
        ]);

        res.json({
            size: sizeResult.rows[0].size,
            tables: tablesResult.rows,
            connections: connectionsResult.rows[0]
        });
    } catch (error) {
        console.error('DB info error:', error);
        res.status(500).json({ error: 'Failed to get database info' });
    }
});

// Получить список бэкапов
router.get('/backups', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
            .map(f => {
                const stats = fs.statSync(path.join(backupDir, f));
                return {
                    name: f,
                    size: stats.size,
                    sizeHuman: formatBytes(stats.size),
                    created: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({ backups: files, directory: backupDir });
    } catch (error) {
        console.error('Backups list error:', error);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// Получить статус автоматического бэкапа
router.get('/backup/status', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const status = await backupService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Backup status error:', error);
        res.status(500).json({ error: 'Failed to get backup status' });
    }
});

// Запустить автобэкап вручную
router.post('/backup/auto', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await backupService.createBackup();
        res.json(result);
    } catch (error) {
        console.error('Manual auto-backup error:', error);
        res.status(500).json({ error: 'Failed to create backup: ' + error.message });
    }
});

// Создать бэкап
router.post('/backup', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await backupService.createBackup('manual');
        
        if (result.success) {
            res.json({
                success: true,
                backup: {
                    name: result.filename,
                    path: path.join(backupService.backupDir, 'manual', result.filename),
                    size: result.sizeMB,
                    created: new Date()
                }
            });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Failed to create backup: ' + error.message });
    }
});

// Удалить бэкап
router.delete('/backup/:filename', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { filename } = req.params;
        const backupDir = path.join(process.cwd(), 'backups');
        const filepath = path.join(backupDir, filename);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        fs.unlinkSync(filepath);
        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

// Очистить старые записи
router.post('/cleanup', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { days = 30, tables = [] } = req.body;
        const results = {};

        // Таблицы для очистки с колонкой даты
        const cleanupTables = [
            { table: 'audit_log', column: 'created_at' },
            { table: 'error_logs', column: 'created_at', condition: 'is_resolved = true' },
            { table: 'server_logs', column: 'created_at' },
            { table: 'api_logs', column: 'created_at' }
        ];

        for (const item of cleanupTables) {
            if (tables.length > 0 && !tables.includes(item.table)) continue;

            try {
                const tableExists = await pool.query(`
                    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
                `, [item.table]);

                if (tableExists.rows[0].exists) {
                    let query = `DELETE FROM ${item.table} WHERE ${item.column} < NOW() - INTERVAL '${parseInt(days)} days'`;
                    if (item.condition) {
                        query += ` AND ${item.condition}`;
                    }
                    const result = await pool.query(query + ' RETURNING id');
                    results[item.table] = result.rowCount;
                }
            } catch (e) {
                results[item.table] = { error: e.message };
            }
        }

        res.json({ success: true, cleaned: results, days });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup' });
    }
});

// Выполнить VACUUM
router.post('/vacuum', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const { table, analyze = true } = req.body;

        let query = 'VACUUM';
        if (analyze) query += ' ANALYZE';
        if (table) query += ` ${table}`;

        await pool.query(query);

        res.json({ success: true, message: `VACUUM ${analyze ? 'ANALYZE ' : ''}completed` });
    } catch (error) {
        console.error('Vacuum error:', error);
        res.status(500).json({ error: 'Failed to vacuum: ' + error.message });
    }
});

// Получить статистику таблиц
router.get('/tables', authenticate, authorize('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                schemaname,
                relname as table_name,
                n_live_tup as row_count,
                n_dead_tup as dead_rows,
                last_vacuum,
                last_autovacuum,
                last_analyze,
                pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) as total_size
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
        `);

        res.json({ tables: result.rows });
    } catch (error) {
        console.error('Tables stats error:', error);
        res.status(500).json({ error: 'Failed to get tables stats' });
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Получить статистику БД для страницы оптимизации
router.get('/stats', authenticate, async (req, res) => {
    try {
        const [sizeResult, tablesResult, indexesResult, uptimeResult] = await Promise.all([
            pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`),
            pool.query(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`),
            pool.query(`SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public'`),
            pool.query(`SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime`)
        ]);

        res.json({
            total_size: sizeResult.rows[0].size,
            tables_count: parseInt(tablesResult.rows[0].count),
            indexes_count: parseInt(indexesResult.rows[0].count),
            uptime: uptimeResult.rows[0].uptime
        });
    } catch (error) {
        console.error('DB stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Оптимизация базы данных
router.post('/optimize', authenticate, async (req, res) => {
    const { type } = req.body;

    try {
        let message = '';

        switch (type) {
            case 'analyze':
                // Анализ запросов и статистики
                await pool.query('ANALYZE');
                const slowQueries = await pool.query(`
                    SELECT query, calls, mean_time, total_time 
                    FROM pg_stat_statements 
                    ORDER BY mean_time DESC 
                    LIMIT 10
                `).catch(() => ({ rows: [] }));
                message = 'Анализ завершён. Статистика таблиц обновлена.';
                return res.json({ success: true, message, slowQueries: slowQueries.rows });

            case 'reindex':
                // Переиндексация
                await pool.query('REINDEX DATABASE CONCURRENTLY current_database()').catch(async () => {
                    // Если CONCURRENTLY не поддерживается, используем обычный reindex
                    const tables = await pool.query(`
                        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                    `);
                    for (const table of tables.rows) {
                        await pool.query(`REINDEX TABLE ${table.tablename}`);
                    }
                });
                await pool.query('VACUUM ANALYZE');
                message = 'Индексы перестроены, статистика обновлена.';
                break;

            case 'clear_cache':
                // Очистка кэша (сброс статистики)
                await pool.query('SELECT pg_stat_reset()').catch(() => { });
                message = 'Кэш статистики сброшен.';
                break;

            default:
                return res.status(400).json({ error: 'Неизвестный тип оптимизации' });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Очистка старых данных
router.post('/cleanup', authenticate, async (req, res) => {
    const { older_than_days = 90 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - older_than_days);

    try {
        const results = [];

        // Удалить старые логи API
        const apiLogs = await pool.query(
            'DELETE FROM api_logs WHERE created_at < $1 RETURNING id',
            [cutoffDate]
        ).catch(() => ({ rowCount: 0 }));
        results.push(`API логи: ${apiLogs.rowCount}`);

        // Удалить старые логи ошибок
        const errorLogs = await pool.query(
            'DELETE FROM error_logs WHERE created_at < $1 RETURNING id',
            [cutoffDate]
        ).catch(() => ({ rowCount: 0 }));
        results.push(`Логи ошибок: ${errorLogs.rowCount}`);

        // Удалить старые сессии
        const sessions = await pool.query(
            'DELETE FROM user_sessions WHERE last_activity < $1 RETURNING id',
            [cutoffDate]
        ).catch(() => ({ rowCount: 0 }));
        results.push(`Сессии: ${sessions.rowCount}`);

        // Удалить старые записи аудита
        const audit = await pool.query(
            'DELETE FROM audit_log WHERE created_at < $1 RETURNING id',
            [cutoffDate]
        ).catch(() => ({ rowCount: 0 }));
        results.push(`Аудит: ${audit.rowCount}`);

        // VACUUM после очистки
        await pool.query('VACUUM ANALYZE');

        res.json({
            success: true,
            message: `Удалено записей старше ${older_than_days} дней: ${results.join(', ')}`
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
