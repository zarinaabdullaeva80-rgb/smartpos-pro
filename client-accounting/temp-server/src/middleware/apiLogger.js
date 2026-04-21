import pool from '../config/database.js';

// Инициализация таблицы логов API
const initApiLogsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id SERIAL PRIMARY KEY,
                method VARCHAR(10),
                path VARCHAR(500),
                status_code INTEGER,
                response_time INTEGER,
                user_id INTEGER,
                ip_address VARCHAR(50),
                user_agent TEXT,
                request_body JSONB,
                response_body JSONB,
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_api_logs_path ON api_logs(path);
            CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status_code);
        `);
        console.log('✓ Таблица api_logs готова');
    } catch (error) {
        console.error('API logs table error:', error.message);
    }
};
// Lazy init — таблица создаётся при первом использовании, не при импорте
let apiLogsTableReady = false;
const ensureApiLogsTable = async () => {
    if (apiLogsTableReady) return;
    await initApiLogsTable();
    apiLogsTableReady = true;
};

// Middleware для логирования API запросов
export const apiLogger = (options = {}) => {
    const {
        excludePaths = ['/api/health', '/health', '/api/system/metrics'],
        logBody = false,
        logResponse = false
    } = options;

    return async (req, res, next) => {
        // Пропускаем исключённые пути
        if (excludePaths.some(p => req.path.startsWith(p))) {
            return next();
        }

        const startTime = Date.now();

        // Сохраняем оригинальный json метод
        const originalJson = res.json.bind(res);
        let responseBody = null;

        // Перехватываем response
        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };

        // Обработка после завершения запроса
        res.on('finish', async () => {
            try {
                const responseTime = Date.now() - startTime;
                const userId = req.user?.id || null;
                const ipAddress = req.ip || req.connection?.remoteAddress || '';
                const userAgent = req.headers['user-agent'] || '';

                // Логируем только значимые запросы или ошибки
                const shouldLog = res.statusCode >= 400 || responseTime > 1000 || options.logAll;

                if (shouldLog) {
                    await ensureApiLogsTable();
                    await pool.query(`
                        INSERT INTO api_logs (method, path, status_code, response_time, user_id, ip_address, user_agent, request_body, response_body, error)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        req.method,
                        req.path,
                        res.statusCode,
                        responseTime,
                        userId,
                        ipAddress,
                        userAgent,
                        logBody ? JSON.stringify(req.body) : null,
                        logResponse && responseBody ? JSON.stringify(responseBody) : null,
                        res.statusCode >= 400 ? responseBody?.error || responseBody?.message : null
                    ]);
                }
            } catch (error) {
                console.error('API logging error:', error.message);
            }
        });

        next();
    };
};

export default apiLogger;
