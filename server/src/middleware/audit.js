import pool from '../config/database.js';

/**
 * Middleware для автоматического логирования всех изменений данных
 * @param {string} entityType - Тип сущности ('sale', 'product', 'purchase')
 * @param {object} options - Дополнительные опции
 */
export function auditLog(entityType, options = {}) {
    return async (req, res, next) => {
        const startTime = Date.now();
        const originalJson = res.json.bind(res);

        res.json = async function (data) {
            try {
                // Определить действие
                const action = req.method === 'POST' ? 'create'
                    : req.method === 'PUT' || req.method === 'PATCH' ? 'update'
                        : req.method === 'DELETE' ? 'delete'
                            : 'read';

                // Проверить настройки логирования
                const settingsResult = await pool.query(`
                    SELECT enabled, log_creates, log_updates, log_deletes, log_reads
                    FROM audit_settings
                    WHERE entity_type = $1
                `, [entityType]);

                const settings = settingsResult.rows[0] || {
                    enabled: true,
                    log_creates: true,
                    log_updates: true,
                    log_deletes: true,
                    log_reads: false
                };

                // Проверить нужно ли логировать это действие
                const shouldLog = settings.enabled && (
                    (action === 'create' && settings.log_creates) ||
                    (action === 'update' && settings.log_updates) ||
                    (action === 'delete' && settings.log_deletes) ||
                    (action === 'read' && settings.log_reads)
                );

                // Логируем только успешные операции с изменениями (не GET)
                if (shouldLog && res.statusCode >= 200 && res.statusCode < 300) {
                    const duration = Date.now() - startTime;

                    // Извлечь entity_id
                    const entityId = data?.id || req.params.id || data?.insertedId || null;

                    // Подготовить данные для логирования
                    const logData = {
                        userId: req.user?.id || null,
                        username: req.user?.username || 'system',
                        entityType: entityType,
                        entityId: entityId,
                        action: action,
                        oldValues: req.body?._oldValues || null,  // Можно передать в req
                        newValues: action === 'delete' ? null : data,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.get('user-agent'),
                        requestUrl: req.originalUrl,
                        requestMethod: req.method,
                        success: true,
                        durationMs: duration
                    };

                    // Асинхронная запись в лог (не блокируем ответ)
                    pool.query(`
                        INSERT INTO audit_log (
                            user_id, username, entity_type, entity_id, action,
                            old_values, new_values, ip_address, user_agent,
                            request_url, request_method, success, duration_ms
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    `, [
                        logData.userId,
                        logData.username,
                        logData.entityType,
                        logData.entityId,
                        logData.action,
                        JSON.stringify(logData.oldValues),
                        JSON.stringify(logData.newValues),
                        logData.ipAddress,
                        logData.userAgent,
                        logData.requestUrl,
                        logData.requestMethod,
                        logData.success,
                        logData.durationMs
                    ]).catch(err => {
                        console.error('[AUDIT] Ошибка записи в журнал:', err.message);
                    });
                }
            } catch (error) {
                console.error('[AUDIT] Error in audit middleware:', error);
            }

            return originalJson(data);
        };

        next();
    };
}

/**
 * Логирование аутентификации (вход/выход)
 */
export async function logAuth(userId, username, action, success, ipAddress, userAgent, errorMessage = null) {
    try {
        await pool.query(`
            INSERT INTO audit_log (
                user_id, username, entity_type, action,
                success, error_message, ip_address, user_agent
            ) VALUES ($1, $2, 'auth', $3, $4, $5, $6, $7)
        `, [userId, username, action, success, errorMessage, ipAddress, userAgent]);
    } catch (error) {
        console.error('[AUDIT] Ошибка логирования аутентификации:', error);
    }
}

/**
 * Получить историю изменений конкретной сущности
 */
export async function getEntityHistory(entityType, entityId) {
    try {
        const result = await pool.query(`
            SELECT 
                al.*,
                u.full_name as user_full_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.entity_type = $1 AND al.entity_id = $2
            ORDER BY al.created_at DESC
        `, [entityType, entityId]);

        return result.rows;
    } catch (error) {
        console.error('[AUDIT] Ошибка получения истории:', error);
        return [];
    }
}

/**
 * Получить журнал действий пользователя
 */
export async function getUserActivityLog(userId, limit = 100) {
    try {
        const result = await pool.query(`
            SELECT *
            FROM audit_log
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);

        return result.rows;
    } catch (error) {
        console.error('[AUDIT] Ошибка получения действий пользователя:', error);
        return [];
    }
}

export default { auditLog, logAuth, getEntityHistory, getUserActivityLog };
