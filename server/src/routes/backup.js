/**
 * API для управления резервными копиями
 */
import express from 'express';
import backupService from '../services/backup.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/backup
 * Получить список бэкапов (для админ-панели)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const allBackups = backupService.getBackupsList();
        // Преобразуем в плоский массив для UI
        const backups = [];
        for (const [type, items] of Object.entries(allBackups || {})) {
            if (Array.isArray(items)) {
                items.forEach(b => backups.push({
                    id: b.filename || b.id,
                    name: b.filename || b.name,
                    size: b.sizeFormatted || b.size || '—',
                    type: type === 'auto' ? 'auto' : 'manual',
                    created_at: b.created || b.created_at || new Date().toISOString(),
                    path: b.path
                }));
            }
        }
        backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ backups });
    } catch (error) {
        console.error('Ошибка получения бэкапов:', error);
        res.json({ backups: [] });
    }
});

/**
 * POST /api/backup
 * Создать бэкап (alias для /create)
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { type = 'manual' } = req.body;
        const result = await backupService.createBackup(type);
        if (result.success) {
            res.json({ success: true, message: 'Бэкап создан', backup: result });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Ошибка создания бэкапа:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/:id/restore
 * Восстановить из бэкапа по ID
 */
router.post('/:id/restore', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        // Найти путь по ID (filename)
        const allBackups = backupService.getBackupsList();
        let filepath = null;
        for (const items of Object.values(allBackups || {})) {
            if (Array.isArray(items)) {
                const found = items.find(b => (b.filename || b.id) === id);
                if (found) { filepath = found.path; break; }
            }
        }
        if (!filepath) {
            return res.status(404).json({ error: 'Бэкап не найден' });
        }
        const result = await backupService.restoreFromBackup(filepath);
        if (result.success) {
            res.json({ success: true, message: 'Восстановление начато' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Ошибка восстановления:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/backup/:id
 * Удалить бэкап по ID (filename)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const allBackups = backupService.getBackupsList();
        let filepath = null;
        for (const items of Object.values(allBackups || {})) {
            if (Array.isArray(items)) {
                const found = items.find(b => (b.filename || b.id) === id);
                if (found) { filepath = found.path; break; }
            }
        }
        if (!filepath) {
            return res.status(404).json({ error: 'Бэкап не найден' });
        }
        const fs = await import('fs');
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.json({ success: true, message: 'Бэкап удалён' });
    } catch (error) {
        console.error('Ошибка удаления бэкапа:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/backup/status
 * Получить статус и историю бэкапов
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const status = await backupService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Ошибка получения статуса бэкапов:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/backup/list
 * Получить список всех бэкапов
 */
router.get('/list', authenticate, async (req, res) => {
    try {
        const backups = backupService.getBackupsList();
        res.json(backups);
    } catch (error) {
        console.error('Ошибка получения списка бэкапов:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/backup/stats
 * Получить статистику бэкапов
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const stats = backupService.getBackupStats();
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики бэкапов:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/create
 * Создать новый бэкап вручную
 */
router.post('/create', authenticate, async (req, res) => {
    try {
        const { type = 'manual' } = req.body;

        console.log(`📦 Запрос на создание ${type} бэкапа от пользователя ${req.user.username}`);

        const result = await backupService.createBackup(type);

        if (result.success) {
            res.json({
                success: true,
                message: `Бэкап успешно создан`,
                backup: result
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Ошибка создания бэкапа:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/restore
 * Восстановить из бэкапа
 */
router.post('/restore', authenticate, async (req, res) => {
    try {
        const { filepath } = req.body;

        if (!filepath) {
            return res.status(400).json({ error: 'Не указан путь к файлу бэкапа' });
        }

        console.log(`🔄 Запрос на восстановление из бэкапа: ${filepath}`);

        const result = await backupService.restoreFromBackup(filepath);

        if (result.success) {
            res.json({
                success: true,
                message: 'База данных успешно восстановлена'
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Ошибка восстановления:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/cleanup
 * Очистить старые бэкапы вручную
 */
router.post('/cleanup', authenticate, async (req, res) => {
    try {
        console.log(`🧹 Запрос на очистку бэкапов от пользователя ${req.user.username}`);

        const result = await backupService.cleanupAllBackups();

        res.json({
            success: true,
            message: `Очистка завершена`,
            ...result
        });
    } catch (error) {
        console.error('Ошибка очистки бэкапов:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/start-scheduler
 * Запустить планировщик бэкапов
 */
router.post('/start-scheduler', authenticate, async (req, res) => {
    try {
        backupService.startScheduler();
        res.json({
            success: true,
            message: 'Планировщик бэкапов запущен'
        });
    } catch (error) {
        console.error('Ошибка запуска планировщика:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/backup/stop-scheduler
 * Остановить планировщик бэкапов
 */
router.post('/stop-scheduler', authenticate, async (req, res) => {
    try {
        backupService.stopScheduler();
        res.json({
            success: true,
            message: 'Планировщик бэкапов остановлен'
        });
    } catch (error) {
        console.error('Ошибка остановки планировщика:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/backup/download/:type/:filename
 * Скачать файл бэкапа
 */
router.get('/download/:type/:filename', authenticate, (req, res) => {
    try {
        const { type, filename } = req.params;
        const backups = backupService.getBackupsList();

        const backup = backups[type]?.find(b => b.filename === filename);

        if (!backup) {
            return res.status(404).json({ error: 'Файл бэкапа не найден' });
        }

        res.download(backup.path, backup.filename);
    } catch (error) {
        console.error('Ошибка скачивания бэкапа:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
