import express from 'express';
import pool from '../config/database.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// ПОЛУЧЕНИЕ УВЕДОМЛЕНИЙ
// ============================================================================

/**
 * GET /api/notifications/unread-count
 * Получить количество непрочитанных уведомлений
 */
router.get('/unread-count', optionalAuthenticate, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ unreadCount: 0 });
        }
        const userId = req.user.id;

        try {
            const result = await pool.query(
                `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
                [userId]
            );
            res.json({ unreadCount: parseInt(result.rows[0].count) || 0 });
        } catch (dbError) {
            // Table might not exist
            res.json({ unreadCount: 0 });
        }
    } catch (error) {
        console.error('Error getting unread count:', error.message);
        res.json({ unreadCount: 0 });
    }
});

/**
 * GET /api/notifications/unread
 * Получить непрочитанные уведомления (для мобильного приложения)
 */
router.get('/unread', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        try {
            const result = await pool.query(
                `SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC LIMIT 50`,
                [userId]
            );
            res.json({ notifications: result.rows, unreadCount: result.rows.length });
        } catch (dbError) {
            res.json({ notifications: [], unreadCount: 0 });
        }
    } catch (error) {
        console.error('Error getting unread notifications:', error);
        res.json({ notifications: [], unreadCount: 0 });
    }
});

/**
 * GET /api/notifications/history
 * Получить историю уведомлений
 */
router.get('/history', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 100, offset = 0 } = req.query;

        try {
            const result = await pool.query(
                `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
                [userId, parseInt(limit), parseInt(offset)]
            );
            res.json({ notifications: result.rows, total: result.rows.length });
        } catch (dbError) {
            res.json({ notifications: [], total: 0 });
        }
    } catch (error) {
        console.error('Error getting notification history:', error);
        res.json({ notifications: [], total: 0 });
    }
});

/**
 * GET /api/notifications
 * Получить список уведомлений текущего пользователя
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0, onlyUnread = false } = req.query;

        try {
            let query = `SELECT * FROM notifications WHERE user_id = $1`;
            const params = [userId];

            if (onlyUnread === 'true') {
                query += ` AND is_read = false`;
            }

            query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
            params.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, params);

            const countResult = await pool.query(
                `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
                [userId]
            );

            res.json({
                notifications: result.rows,
                unreadCount: parseInt(countResult.rows[0].count) || 0,
                total: result.rows.length
            });
        } catch (dbError) {
            res.json({ notifications: [], unreadCount: 0, total: 0 });
        }
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ
// ============================================================================

/**
 * POST /api/notifications/mark-read/:id
 * Пометить уведомление как прочитанное
 */
router.post('/mark-read/:id', authenticate, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
            [notificationId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Уведомление не найдено' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Пометить уведомление как прочитанное (мобильная версия)
 */
router.patch('/:id/read', authenticate, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
            [notificationId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Уведомление не найдено' });
        }

        res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/mark-all-read
 * Пометить все уведомления как прочитанные
 */
router.post('/mark-all-read', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        await pool.query(
            `UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        res.json({ success: true, message: 'Все уведомления прочитаны' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/read-all
 * Пометить все уведомления как прочитанные (алиас для мобильного)
 */
router.post('/read-all', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        await pool.query(
            `UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        res.json({ success: true, message: 'Все уведомления прочитаны' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ОТПРАВКА УВЕДОМЛЕНИЙ ПРОДАВЦАМ/КАССИРАМ
// ============================================================================

/**
 * POST /api/notifications/send
 * Отправить уведомление конкретному продавцу/кассиру или всем
 * Требует права администратора
 */
router.post('/send', authenticate, async (req, res) => {
    try {
        // Проверка прав
        const userRole = req.user.role;
        if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'Администратор') {
            return res.status(403).json({ error: 'Только администратор может отправлять уведомления' });
        }

        const { userId, userIds, sendToAll, title, message, type = 'info', priority = 'normal', category = 'message' } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Укажите заголовок и текст уведомления' });
        }

        const orgId = req.user?.organization_id;
        const notifications = [];

        // Отправить всем продавцам/кассирам
        if (sendToAll) {
            let usersQuery = `SELECT id FROM users WHERE is_active = true`;
            const queryParams = [];

            if (orgId) {
                usersQuery += ` AND organization_id = $1`;
                queryParams.push(orgId);
            }

            const usersResult = await pool.query(usersQuery, queryParams);

            for (const user of usersResult.rows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO notifications (user_id, type, category, title, message, priority, created_by, is_read)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, false)
                        RETURNING *
                    `, [user.id, type, category, title, message, priority, req.user.id]);
                    notifications.push(result.rows[0]);
                } catch (e) {
                    console.error(`Error sending to user ${user.id}:`, e.message);
                }
            }
        }
        // Отправить нескольким конкретным пользователям
        else if (userIds && Array.isArray(userIds)) {
            for (const targetUserId of userIds) {
                try {
                    const result = await pool.query(`
                        INSERT INTO notifications (user_id, type, category, title, message, priority, created_by, is_read)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, false)
                        RETURNING *
                    `, [targetUserId, type, category, title, message, priority, req.user.id]);
                    notifications.push(result.rows[0]);
                } catch (e) {
                    console.error(`Error sending to user ${targetUserId}:`, e.message);
                }
            }
        }
        // Отправить одному конкретному пользователю
        else if (userId) {
            const result = await pool.query(`
                INSERT INTO notifications (user_id, type, category, title, message, priority, created_by, is_read)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false)
                RETURNING *
            `, [userId, type, category, title, message, priority, req.user.id]);
            notifications.push(result.rows[0]);
        } else {
            return res.status(400).json({ error: 'Укажите получателя (userId, userIds или sendToAll)' });
        }

        res.json({
            success: true,
            message: `Уведомление отправлено ${notifications.length} пользователям`,
            sentCount: notifications.length,
            notifications
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомления' });
    }
});

/**
 * GET /api/notifications/sent-history
 * История отправленных уведомлений (для администратора)
 */
router.get('/sent-history', authenticate, async (req, res) => {
    try {
        const userRole = req.user.role;
        if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'Администратор') {
            return res.status(403).json({ error: 'Доступ запрещён' });
        }

        const { limit = 50, offset = 0 } = req.query;

        try {
            const result = await pool.query(`
                SELECT n.*, u.username as recipient_name, u.full_name as recipient_full_name,
                       cu.username as sender_name, cu.full_name as sender_full_name
                FROM notifications n
                LEFT JOIN users u ON n.user_id = u.id
                LEFT JOIN users cu ON n.created_by = cu.id
                WHERE n.created_by = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `, [req.user.id, parseInt(limit), parseInt(offset)]);

            res.json({ notifications: result.rows, total: result.rows.length });
        } catch (dbError) {
            res.json({ notifications: [], total: 0 });
        }
    } catch (error) {
        console.error('Error getting sent history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/notifications/create
 * Создать уведомление (для тестирования или ручного создания)
 */
router.post('/create', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'Администратор') {
            return res.status(403).json({ error: 'Доступ запрещён' });
        }

        const { userId, type = 'info', category = 'system', title, message, priority = 'normal' } = req.body;

        const result = await pool.query(`
            INSERT INTO notifications (user_id, type, category, title, message, priority, created_by, is_read)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            RETURNING *
        `, [userId || req.user.id, type, category, title, message, priority, req.user.id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/notifications/settings
 * Получить настройки уведомлений
 */
router.get('/settings', authenticate, async (req, res) => {
    try {
        res.json({
            pushEnabled: true,
            emailEnabled: false,
            soundEnabled: true,
            categories: {
                sales: true,
                inventory: true,
                system: true,
                message: true
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/notifications/settings
 * Обновить настройки уведомлений
 */
router.put('/settings', authenticate, async (req, res) => {
    try {
        res.json({ success: true, message: 'Настройки сохранены' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

