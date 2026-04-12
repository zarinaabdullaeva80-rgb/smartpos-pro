import pool from '../config/database.js';
import { sendErrorAlert } from '../services/alerts.js';

export const globalErrorHandler = async (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    const stack = err.stack || '';

    console.error(`[SYSTEM ERROR] ${req.method} ${req.path}:`, err);

    try {
        const userId = req.user?.id || null;
        const ipAddress = req.ip || req.connection?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';
        const url = req.originalUrl || req.url;

        // Вставляем ошибку в базу данных
        const result = await pool.query(`
            INSERT INTO error_logs (type, severity, message, stack_trace, user_id, url, ip_address, user_agent, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            'backend',
            statusCode >= 500 ? 'critical' : 'error',
            message,
            stack,
            userId,
            url,
            ipAddress,
            userAgent,
            JSON.stringify({
                method: req.method,
                params: req.params,
                query: req.query,
                body: req.method !== 'GET' ? req.body : null
            })
        ]);

        // Отправляем алерт для критических ошибок
        if (statusCode >= 500) {
            sendErrorAlert(result.rows[0]).catch(e => console.error('Failed to send error alert:', e.message));
        }

    } catch (loggingError) {
        console.error('CRITICAL: Failed to log error to database:', loggingError.message);
    }

    res.status(statusCode).json({
        error: message,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined
    });
};
