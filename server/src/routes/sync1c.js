import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

/**
 * Получить настройки синхронизации
 */
router.get('/settings', authenticate, async (req, res) => {
    try {
        // Убедимся что таблица существует
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL,
                setting_value TEXT,
                description TEXT,
                organization_id INTEGER,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(setting_key, organization_id)
            )
        `);

        // Migration: add organization_id if it doesn't exist
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_settings' AND column_name='organization_id') THEN
                    ALTER TABLE sync_settings ADD COLUMN organization_id INTEGER;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_log' AND column_name='organization_id') THEN
                    ALTER TABLE sync_log ADD COLUMN organization_id INTEGER;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_id_mapping' AND column_name='organization_id') THEN
                    ALTER TABLE external_id_mapping ADD COLUMN organization_id INTEGER;
                END IF;
            END $$;
        `);

        const orgId = req.user.organization_id;
        const result = await pool.query('SELECT * FROM sync_settings WHERE organization_id = $1 ORDER BY setting_key', [orgId]);

        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json(settings);
    } catch (error) {
        console.error('Error fetching sync settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Обновить настройки синхронизации
 */
router.put('/settings', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    try {
        const settings = req.body;

        const orgId = req.user.organization_id;
        for (const [key, value] of Object.entries(settings)) {
            await pool.query(
                `INSERT INTO sync_settings (setting_key, setting_value, organization_id, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (setting_key, organization_id)
                 DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
                [key, value, orgId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating sync settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Проверить подключение к 1С
 */
router.post('/test-connection', authenticate, async (req, res) => {
    try {
        const { '1c_api_url': apiUrl, '1c_username': username, '1c_password': password } = req.body;

        if (!apiUrl) {
            return res.status(400).json({ success: false, message: 'URL 1С не указан' });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (username) {
            headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64');
        }

        try {
            const response = await fetch(apiUrl, { headers, signal: controller.signal });
            clearTimeout(timeout);

            if (response.ok) {
                return res.json({ success: true, message: 'Подключение к 1С успешно установлено', status: response.status });
            } else {
                return res.json({ success: false, message: `1С ответил с кодом: ${response.status}`, status: response.status });
            }
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                return res.json({ success: false, message: 'Таймаут подключения (10 сек). Проверьте URL и доступность сервера.' });
            }
            return res.json({ success: false, message: `Ошибка подключения: ${fetchError.message}` });
        }
    } catch (error) {
        console.error('Error testing 1C connection:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


/**
 * Получить историю синхронизации
 */
router.get('/log', authenticate, async (req, res) => {
    try {
        const { limit = 20, offset = 0, sync_type, status, date_from, date_to } = req.query;

        // Убедимся что таблица sync_log существует
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
                details JSONB
            )
        `);

        let query = `
            SELECT 
                id, sync_type, direction, status, 
                records_total, records_success, records_error,
                error_message, started_at, finished_at, duration_ms
            FROM sync_log
            WHERE organization_id = $1
        `;
        const params = [req.user.organization_id];
        let paramIndex = 2;

        if (sync_type) {
            query += ` AND sync_type = $${paramIndex++}`;
            params.push(sync_type);
        }
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (date_from) {
            query += ` AND started_at >= $${paramIndex++}`;
            params.push(date_from);
        }
        if (date_to) {
            query += ` AND started_at <= $${paramIndex++}`;
            params.push(date_to);
        }

        query += ` ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Получить общее количество
        const countQuery = `SELECT COUNT(*) FROM sync_log WHERE 1=1`;
        const countResult = await pool.query(countQuery);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sync log:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ИМПОРТ: Получить товары из нашей системы (для 1С)
 */
router.get('/export/products', authenticate, async (req, res) => {
    try {
        const { date_from, limit = 1000 } = req.query;

        let query = `
            SELECT 
                p.id,
                p.name,
                p.barcode,
                p.code,
                p.unit,
                p.price_sale,
                p.price_purchase,
                pc.name as category_name,
                p.created_at,
                p.updated_at,
                eim.external_id as external_id_1c
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN external_id_mapping eim ON eim.entity_type = 'products' 
                AND eim.internal_id = p.id AND eim.external_system = '1C'
            WHERE p.organization_id = $1
        `;

        const params = [req.user.organization_id];
        if (date_from) {
            params.push(date_from);
            query += ` AND p.updated_at >= $${params.length}`;
        }

        query += ` ORDER BY p.updated_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json({
            timestamp: new Date().toISOString(),
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ЭКСПОРТ: Принять товары из 1С
 */
router.post('/import/products', authenticate, checkPermission('products.write'), async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { products } = req.body;
        let success = 0, errors = 0;
        const errorDetails = [];

        const logId = await client.query(
            `INSERT INTO sync_log (sync_type, direction, status, records_total) 
             VALUES ('products', 'import', 'processing', $1) RETURNING id`,
            [products.length]
        );

        for (const product of products) {
            try {
                const { external_id, name, barcode, article, unit, price, cost_price, category_name } = product;

                // Проверить, существует ли товар с таким external_id (в рамках организации)
                const existing = await client.query(
                    `SELECT p.id FROM products p
                     JOIN external_id_mapping eim ON eim.internal_id = p.id
                     WHERE eim.entity_type = 'products' AND eim.external_id = $1 AND eim.external_system = '1C'
                     AND eim.organization_id = $2`,
                    [external_id, req.user.organization_id]
                );

                let productId;

                if (existing.rows.length > 0) {
                    // Обновить
                    productId = existing.rows[0].id;
                    await client.query(
                        `UPDATE products SET name = $1, barcode = $2, code = $3, 
                         unit = $4, price_sale = $5, price_purchase = $6, updated_at = NOW()
                         WHERE id = $7`,
                        [name, barcode, article, unit, price, cost_price, productId]
                    );
                } else {
                    // Создать
                    const result = await client.query(
                        `INSERT INTO products (name, barcode, code, unit, price_sale, price_purchase, is_active, organization_id)
                         VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
                        [name, barcode, article, unit, price, cost_price, req.user.organization_id]
                    );
                    productId = result.rows[0].id;

                    // Сохранить маппинг
                    await client.query(
                        `INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id)
                         VALUES ('products', $1, $2, '1C', $3)
                         ON CONFLICT (entity_type, internal_id, external_system, organization_id) 
                         DO UPDATE SET external_id = $2, updated_at = NOW()`,
                        [productId, external_id, req.user.organization_id]
                    );
                }

                success++;
            } catch (err) {
                errors++;
                errorDetails.push({
                    product: product.external_id,
                    error: err.message
                });
            }
        }

        await client.query(
            `UPDATE sync_log SET status = $1, records_success = $2, records_error = $3,
             error_message = $4, finished_at = NOW(), 
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
             organization_id = $5
             WHERE id = $6`,
            [
                errors > 0 ? 'partial' : 'success',
                success,
                errors,
                errors > 0 ? JSON.stringify(errorDetails) : null,
                req.user.organization_id,
                logId.rows[0].id
            ]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            imported: success,
            errors: errors,
            errorDetails: errors > 0 ? errorDetails : undefined
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error importing products:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * ЭКСПОРТ: Принять продажи из системы (отправить в 1С)
 */
router.get('/export/sales', authenticate, async (req, res) => {
    try {
        const { date_from, date_to, limit = 1000 } = req.query;

        let query = `
            SELECT 
                s.id,
                s.document_number,
                s.document_date,
                s.total_amount,
                s.status,
                c.name as customer_name,
                eim_customer.external_id as customer_external_id,
                s.created_at,
                (
                    SELECT json_agg(json_build_object(
                        'product_id', si.product_id,
                        'product_external_id', eim_product.external_id,
                        'product_name', p.name,
                        'quantity', si.quantity,
                        'price', si.price,
                        'amount', si.quantity * si.price
                    ))
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    LEFT JOIN external_id_mapping eim_product ON eim_product.entity_type = 'products' 
                        AND eim_product.internal_id = si.product_id AND eim_product.external_system = '1C'
                    WHERE si.sale_id = s.id
                ) as items,
                eim_sale.external_id as external_id_1c
            FROM sales s
            LEFT JOIN counterparties c ON s.customer_id = c.id
            LEFT JOIN external_id_mapping eim_customer ON eim_customer.entity_type = 'counterparties' 
                AND eim_customer.internal_id = s.customer_id AND eim_customer.external_system = '1C'
            LEFT JOIN external_id_mapping eim_sale ON eim_sale.entity_type = 'sales' 
                AND eim_sale.internal_id = s.id AND eim_sale.external_system = '1C'
             WHERE s.status = 'confirmed' AND s.organization_id = $1
        `;

        const params = [req.user.organization_id];
        if (date_from) {
            params.push(date_from);
            query += ` AND s.document_date >= $${params.length}`;
        }
        if (date_to) {
            params.push(date_to);
            query += ` AND s.document_date <= $${params.length}`;
        }

        query += ` ORDER BY s.document_date DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json({
            timestamp: new Date().toISOString(),
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error exporting sales:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * История синхронизации
 */
router.get('/log', authenticate, async (req, res) => {
    try {
        const { limit = 100, sync_type, status } = req.query;

        let query = 'SELECT * FROM sync_log WHERE 1=1';
        const params = [];

        if (sync_type) {
            params.push(sync_type);
            query += ` AND sync_type = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sync log:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Очередь синхронизации
 */
router.get('/queue', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM sync_queue
            WHERE status IN ('pending', 'processing')
            ORDER BY priority DESC, created_at
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sync queue:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ЭКСПОРТ: Категории для 1С
 */
router.get('/export/categories', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.description,
                c.parent_id,
                parent.name as parent_name,
                c.created_at,
                c.updated_at,
                eim.external_id as external_id_1c
            FROM product_categories c
            LEFT JOIN product_categories parent ON c.parent_id = parent.id
            LEFT JOIN external_id_mapping eim ON eim.entity_type = 'categories' 
                AND eim.internal_id = c.id AND eim.external_system = '1C'
            WHERE c.organization_id = $1
            ORDER BY c.parent_id NULLS FIRST, c.name
        `, [req.user.organization_id]);

        res.json({
            timestamp: new Date().toISOString(),
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error('Error exporting categories:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ИМПОРТ: Принять категории из 1С
 */
router.post('/import/categories', authenticate, checkPermission('products.write'), async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
        const { categories } = req.body;

        if (!Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ error: 'Массив categories обязателен' });
        }

        await client.query('BEGIN');

        let imported = 0;
        let updated = 0;
        let errors = [];

        // Сначала импортируем родительские категории (без parent_external_id)
        const rootCategories = categories.filter(c => !c.parent_external_id);
        const childCategories = categories.filter(c => c.parent_external_id);

        // Импорт родительских категорий
        for (const cat of rootCategories) {
            try {
                // Проверяем существует ли категория по external_id (в рамках организации)
                const existingMapping = await client.query(
                    'SELECT internal_id FROM external_id_mapping WHERE entity_type = $1 AND external_id = $2 AND external_system = $3 AND organization_id = $4',
                    ['categories', cat.external_id, '1C', req.user.organization_id]
                );

                if (existingMapping.rows.length > 0) {
                    // Обновляем существующую
                    await client.query(
                        'UPDATE product_categories SET name = $1, description = $2, updated_at = NOW() WHERE id = $3',
                        [cat.name, cat.description || '', existingMapping.rows[0].internal_id]
                    );
                    updated++;
                } else {
                    // Создаём новую
                    const insertResult = await client.query(
                        'INSERT INTO product_categories (name, description, organization_id) VALUES ($1, $2, $3) RETURNING id',
                        [cat.name, cat.description || '', req.user.organization_id]
                    );

                    // Создаём маппинг
                    await client.query(
                        'INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id) VALUES ($1, $2, $3, $4, $5)',
                        ['categories', insertResult.rows[0].id, cat.external_id, '1C', req.user.organization_id]
                    );
                    imported++;
                }
            } catch (err) {
                errors.push({ external_id: cat.external_id, error: err.message });
            }
        }

        // Импорт дочерних категорий
        for (const cat of childCategories) {
            try {
                // Находим parent_id через маппинг
                const parentMapping = await client.query(
                    'SELECT internal_id FROM external_id_mapping WHERE entity_type = $1 AND external_id = $2 AND external_system = $3',
                    ['categories', cat.parent_external_id, '1C']
                );

                const parentId = parentMapping.rows.length > 0 ? parentMapping.rows[0].internal_id : null;

                // Проверяем существует ли категория
                const existingMapping = await client.query(
                    'SELECT internal_id FROM external_id_mapping WHERE entity_type = $1 AND external_id = $2 AND external_system = $3',
                    ['categories', cat.external_id, '1C']
                );

                if (existingMapping.rows.length > 0) {
                    await client.query(
                        'UPDATE product_categories SET name = $1, description = $2, parent_id = $3, updated_at = NOW() WHERE id = $4',
                        [cat.name, cat.description || '', parentId, existingMapping.rows[0].internal_id]
                    );
                    updated++;
                } else {
                    const insertResult = await client.query(
                        'INSERT INTO product_categories (name, description, parent_id, organization_id) VALUES ($1, $2, $3, $4) RETURNING id',
                        [cat.name, cat.description || '', parentId, req.user.organization_id]
                    );

                    await client.query(
                        'INSERT INTO external_id_mapping (entity_type, internal_id, external_id, external_system, organization_id) VALUES ($1, $2, $3, $4, $5)',
                        ['categories', insertResult.rows[0].id, cat.external_id, '1C', req.user.organization_id]
                    );
                    imported++;
                }
            } catch (err) {
                errors.push({ external_id: cat.external_id, error: err.message });
            }
        }

        // Логируем синхронизацию
        await client.query(`
            INSERT INTO sync_log (sync_type, direction, status, records_total, records_success, records_error, started_at, finished_at, duration_ms, organization_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
        `, ['categories', 'import', errors.length > 0 ? 'partial' : 'success', categories.length, imported + updated, errors.length, new Date(startTime), Date.now() - startTime, req.user.organization_id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            imported,
            updated,
            errors: errors.length,
            errorDetails: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error importing categories:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * Тестирование подключения к 1С
 */
router.post('/test-connection', authenticate, checkPermission('admin.settings'), async (req, res) => {
    try {
        const { url, username, password } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL обязателен' });
        }

        // Попытка подключения к 1С
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64'),
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                res.json({
                    success: true,
                    message: 'Подключение к 1С успешно установлено',
                    status: response.status
                });
            } else if (response.status === 401) {
                res.status(401).json({
                    success: false,
                    error: 'Неверные учётные данные (логин/пароль)'
                });
            } else {
                res.status(response.status).json({
                    success: false,
                    error: `Ошибка подключения: HTTP ${response.status}`
                });
            }
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                res.status(408).json({ success: false, error: 'Таймаут подключения (10 сек)' });
            } else {
                res.status(500).json({ success: false, error: `Ошибка сети: ${fetchError.message}` });
            }
        }
    } catch (error) {
        console.error('Error testing 1C connection:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Полная синхронизация (все объекты)
 */
router.post('/sync/full', authenticate, checkPermission('admin.settings'), auditLog, async (req, res) => {
    const client = await pool.connect();
    const startTime = Date.now();

    try {
        const { direction = 'bidirectional' } = req.body;

        // Создаём задачу в очереди
        const queueResult = await client.query(`
            INSERT INTO sync_queue (sync_type, priority, status, created_by, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
        `, ['full', 10, 'pending', req.user?.id || null]);

        const queueId = queueResult.rows[0].id;

        // Асинхронно запускаем синхронизацию (в реальном приложении это был бы фоновый процесс)
        setImmediate(async () => {
            try {
                await client.query('UPDATE sync_queue SET status = $1, started_at = NOW() WHERE id = $2', ['processing', queueId]);

                // Здесь была бы логика синхронизации с реальным 1С
                // Для демонстрации просто ждём 2 секунды
                await new Promise(resolve => setTimeout(resolve, 2000));

                await client.query('UPDATE sync_queue SET status = $1, completed_at = NOW() WHERE id = $2', ['completed', queueId]);

                // Логируем
                await pool.query(`
                    INSERT INTO sync_log (sync_type, direction, status, records_total, records_success, started_at, finished_at, duration_ms, organization_id)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
                `, ['full', direction, 'success', 0, 0, new Date(startTime), Date.now() - startTime, req.user.organization_id]);
            } catch (err) {
                await client.query('UPDATE sync_queue SET status = $1, error_message = $2, completed_at = NOW() WHERE id = $3', ['failed', err.message, queueId]);
            }
        });

        res.json({
            success: true,
            message: 'Полная синхронизация запущена',
            queue_id: queueId
        });
    } catch (error) {
        console.error('Error starting full sync:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

export default router;
