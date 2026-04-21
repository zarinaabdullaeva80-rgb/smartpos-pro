/**
 * Scheduler Routes - API для управления планировщиком синхронизации
 */

import express from 'express';
import schedulerService from '../services/scheduler.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

/**
 * GET /api/scheduler/status - Получить статус планировщика
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        const status = schedulerService.getStatus();
        const settings = await schedulerService.getSettings();

        res.json({
            ...status,
            settings: {
                enabled: settings['sync_enabled'] === 'true',
                intervalMinutes: parseInt(settings['sync_interval_minutes']) || 15,
                syncProducts: settings['sync_products'] === 'true',
                syncCategories: settings['sync_categories'] === 'true',
                syncCounterparties: settings['sync_counterparties'] === 'true',
                syncSales: settings['sync_sales'] === 'true',
                direction: settings['sync_direction'] || 'bidirectional'
            }
        });
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/trigger - Принудительный запуск синхронизации
 */
router.post('/trigger', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        // Запускаем асинхронно, не ждём завершения
        schedulerService.triggerNow().catch(err => {
            console.error('Scheduler trigger error:', err);
        });

        res.json({
            success: true,
            message: 'Синхронизация запущена'
        });
    } catch (error) {
        console.error('Error triggering sync:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/reload - Перезагрузить настройки планировщика
 */
router.post('/reload', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        await schedulerService.loadAndStartJobs();

        res.json({
            success: true,
            message: 'Настройки планировщика перезагружены',
            status: schedulerService.getStatus()
        });
    } catch (error) {
        console.error('Error reloading scheduler:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/stop - Остановить планировщик
 */
router.post('/stop', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        schedulerService.stopAllJobs();

        res.json({
            success: true,
            message: 'Планировщик остановлен',
            status: schedulerService.getStatus()
        });
    } catch (error) {
        console.error('Error stopping scheduler:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
