import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, logAudit } from '../middleware/auth.js';
import { updateStockBalance } from '../utils/stockBalance.js';

const router = express.Router();

// Применяем аутентификацию ко всем маршрутам
router.use(authenticateToken);

// ============================================
// WAREHOUSES
// ============================================

// Получить все склады
router.get('/', async (req, res) => {
    try {
        const userLicenseId = req.user?.license_id;
        let query = 'SELECT * FROM warehouses';
        const params = [];

        if (userLicenseId) {
            query += ' WHERE license_id = $1';
            params.push(userLicenseId);
        }

        query += ' ORDER BY name';
        const result = await pool.query(query, params);
        res.json({ warehouses: result.rows });
    } catch (error) {
        console.error('Ошибка получения складов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить склад по ID
router.get('/:id', async (req, res) => {
    try {
        const userLicenseId = req.user?.license_id;
        let query = 'SELECT * FROM warehouses WHERE id = $1';
        const params = [req.params.id];

        if (userLicenseId) {
            query += ' AND license_id = $2';
            params.push(userLicenseId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Склад не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения склада:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать новый склад
router.post('/', async (req, res) => {
    const { code, name, address, responsible_person, latitude, longitude, phone, email, working_hours, capacity } = req.body;

    try {
        const userLicenseId = req.user?.license_id;
        const result = await pool.query(
            `INSERT INTO warehouses (code, name, address, responsible_person, latitude, longitude, phone, email, working_hours, capacity, license_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING *`,
            [code, name, address, responsible_person, latitude, longitude, phone, email, working_hours, capacity, userLicenseId]
        );

        await logAudit(req.user.id, 'CREATE', 'warehouses', result.rows[0].id, null, result.rows[0], req.ip);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка создания склада:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Склад с таким кодом уже существует' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить склад
router.put('/:id', async (req, res) => {
    const { code, name, address, responsible_person, is_active, latitude, longitude, phone, email, working_hours, capacity } = req.body;

    try {
        const oldResult = await pool.query('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);

        const userLicenseId = req.user?.license_id;
        let updateQuery = `UPDATE warehouses 
             SET code = $1, name = $2, address = $3, responsible_person = $4, is_active = $5, 
                 latitude = $6, longitude = $7, phone = $8, email = $9, working_hours = $10, capacity = $11, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $12`;
        const updateParams = [code, name, address, responsible_person, is_active, latitude, longitude, phone, email, working_hours, capacity, req.params.id];

        if (userLicenseId) {
            updateQuery += ' AND license_id = $13';
            updateParams.push(userLicenseId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Склад не найден' });
        }

        await logAudit(req.user.id, 'UPDATE', 'warehouses', req.params.id, oldResult.rows[0], result.rows[0], req.ip);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка обновления склада:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить склад
router.delete('/:id', async (req, res) => {
    try {
        // Проверяем, есть ли движения по этому складу
        const movementsCheck = await pool.query(
            'SELECT COUNT(*) FROM inventory_movements WHERE warehouse_id = $1',
            [req.params.id]
        );

        if (parseInt(movementsCheck.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Невозможно удалить склад, по которому есть движения товаров'
            });
        }

        const userLicenseId = req.user?.license_id;
        let deleteQuery = 'DELETE FROM warehouses WHERE id = $1';
        const deleteParams = [req.params.id];
        if (userLicenseId) {
            deleteQuery += ' AND license_id = $2';
            deleteParams.push(userLicenseId);
        }
        await pool.query(deleteQuery, deleteParams);
        await logAudit(req.user.id, 'DELETE', 'warehouses', req.params.id, null, null, req.ip);

        res.status(204).send();
    } catch (error) {
        console.error('Ошибка удаления склада:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// INVENTORY & STOCK BALANCE
// ============================================

// Получить текущие остатки по складу
router.get('/:id/inventory', async (req, res) => {
    try {
        const userLicenseId = req.user?.license_id;
        let invQuery = `SELECT 
                p.id,
                p.code,
                p.name,
                p.unit,
                COALESCE(SUM(im.quantity), 0) as quantity,
                COALESCE(AVG(im.cost_price), p.price_purchase) as avg_cost
             FROM products p
             LEFT JOIN inventory_movements im ON im.product_id = p.id AND im.warehouse_id = $1
             WHERE p.is_active = true`;
        const invParams = [req.params.id];

        if (userLicenseId) {
            invQuery += ' AND p.license_id = $2';
            invParams.push(userLicenseId);
        }

        invQuery += ` GROUP BY p.id, p.code, p.name, p.unit, p.price_purchase
             HAVING COALESCE(SUM(im.quantity), 0) > 0
             ORDER BY p.name`;

        const result = await pool.query(invQuery, invParams);

        res.json({ inventory: result.rows });
    } catch (error) {
        console.error('Ошибка получения остатков склада:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить общие остатки по всем складам
router.get('/stock/balance', async (req, res) => {
    const { category_id, search } = req.query;

    try {
        const userLicenseId = req.user?.license_id;
        let query = `
            SELECT 
                p.id,
                p.code,
                p.name,
                p.unit,
                pc.name as category_name,
                w.id as warehouse_id,
                w.name as warehouse_name,
                COALESCE(SUM(im.quantity), 0) as quantity,
                COALESCE(AVG(im.cost_price), p.price_purchase) as avg_cost
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN warehouses w ON w.is_active = true
            LEFT JOIN inventory_movements im ON im.product_id = p.id AND im.warehouse_id = w.id
            WHERE p.is_active = true
        `;

        if (userLicenseId) {
            query += ` AND p.license_id = $1 AND w.license_id = $1`;
        }

        const params = userLicenseId ? [userLicenseId] : [];
        let paramCount = params.length + 1;

        if (category_id) {
            query += ` AND p.category_id = $${paramCount}`;
            params.push(category_id);
            paramCount++;
        }

        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p.code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += `
            GROUP BY p.id, p.code, p.name, p.unit, p.price_purchase, pc.name, w.id, w.name
            ORDER BY p.name, w.name
        `;

        const result = await pool.query(query, params);

        // Группируем результаты по продуктам
        const stockMap = new Map();
        result.rows.forEach(row => {
            if (!stockMap.has(row.id)) {
                stockMap.set(row.id, {
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    unit: row.unit,
                    category_name: row.category_name,
                    total_quantity: 0,
                    avg_cost: row.avg_cost,
                    warehouses: []
                });
            }

            const product = stockMap.get(row.id);
            const qty = parseFloat(row.quantity) || 0;
            product.total_quantity += qty;

            if (row.warehouse_id) {
                product.warehouses.push({
                    warehouse_id: row.warehouse_id,
                    warehouse_name: row.warehouse_name,
                    quantity: qty
                });
            }
        });

        const stock = Array.from(stockMap.values())
            .filter(item => item.total_quantity > 0);

        res.json({ stock });
    } catch (error) {
        console.error('Ошибка получения остатков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// INVENTORY MOVEMENTS
// ============================================

// Получить движения товаров с фильтрацией
router.get('/movements/all', async (req, res) => {
    const { dateFrom, dateTo, warehouse_id, product_id, document_type } = req.query;

    try {
        const userLicenseId = req.user?.license_id;
        let query = `
            SELECT 
                im.*,
                p.code as product_code,
                p.name as product_name,
                p.unit,
                w.name as warehouse_name,
                u.full_name as user_name
            FROM inventory_movements im
            LEFT JOIN products p ON im.product_id = p.id
            LEFT JOIN warehouses w ON im.warehouse_id = w.id
            LEFT JOIN users u ON im.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND im.license_id = $${paramCount}`;
            params.push(userLicenseId);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND im.movement_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND im.movement_date <= $${paramCount}`;
            params.push(dateTo + ' 23:59:59');
            paramCount++;
        }

        if (warehouse_id) {
            query += ` AND im.warehouse_id = $${paramCount}`;
            params.push(warehouse_id);
            paramCount++;
        }

        if (product_id) {
            query += ` AND im.product_id = $${paramCount}`;
            params.push(product_id);
            paramCount++;
        }

        if (document_type) {
            query += ` AND im.document_type = $${paramCount}`;
            params.push(document_type);
            paramCount++;
        }

        query += ' ORDER BY im.movement_date DESC, im.id DESC LIMIT 500';

        const result = await pool.query(query, params);
        res.json({ movements: result.rows });
    } catch (error) {
        console.error('Ошибка получения движений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать ручное движение товара (корректировка)
router.post('/movements', async (req, res) => {
    const { product_id, warehouse_id, quantity, cost_price, reason } = req.body;

    try {
        const userLicenseId = req.user?.license_id;

        // Verify product and warehouse belong to license
        if (userLicenseId) {
            const pCheck = await pool.query('SELECT 1 FROM products WHERE id = $1 AND license_id = $2', [product_id, userLicenseId]);
            if (pCheck.rows.length === 0) throw new Error('Товар не найден в вашей организации');
            const wCheck = await pool.query('SELECT 1 FROM warehouses WHERE id = $1 AND license_id = $2', [warehouse_id, userLicenseId]);
            if (wCheck.rows.length === 0) throw new Error('Склад не найден в вашей организации');
        }

        const result = await pool.query(
            `INSERT INTO inventory_movements 
             (product_id, warehouse_id, document_type, quantity, cost_price, user_id, license_id) 
             VALUES ($1, $2, 'adjustment', $3, $4, $5, $6) 
             RETURNING *`,
            [product_id, warehouse_id, quantity, cost_price, req.user.id, userLicenseId]
        );

        // Обновить stock_balances
        await updateStockBalance(null, product_id, warehouse_id, quantity);

        await logAudit(
            req.user.id,
            'CREATE',
            'inventory_movements',
            result.rows[0].id,
            null,
            { ...result.rows[0], reason },
            req.ip
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка создания движения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить историю движений для конкретного товара
router.get('/movements/product/:productId', async (req, res) => {
    try {
        const userLicenseId = req.user?.license_id;
        let query = `SELECT 
                im.*,
                w.name as warehouse_name,
                u.full_name as user_name
             FROM inventory_movements im
             LEFT JOIN warehouses w ON im.warehouse_id = w.id
             LEFT JOIN users u ON im.user_id = u.id
             WHERE im.product_id = $1`;
        const params = [req.params.productId];

        if (userLicenseId) {
            query += ' AND im.license_id = $2';
            params.push(userLicenseId);
        }

        query += ` ORDER BY im.movement_date DESC, im.id DESC LIMIT 100`;

        const result = await pool.query(query, params);

        res.json({ movements: result.rows });
    } catch (error) {
        console.error('Ошибка получения истории движений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// STOCK TRANSFER
// ============================================

// Получить список перемещений
router.get('/transfers', async (req, res) => {
    const { dateFrom, dateTo, status } = req.query;

    try {
        const userLicenseId = req.user?.license_id;
        let query = `
            SELECT 
                im.id,
                im.movement_date as created_at,
                im.quantity,
                p.name as product_name,
                p.code as product_code,
                w.name as warehouse_name,
                u.full_name as created_by,
                CASE 
                    WHEN im.quantity < 0 THEN 'out'
                    ELSE 'in'
                END as direction
            FROM inventory_movements im
            LEFT JOIN products p ON im.product_id = p.id
            LEFT JOIN warehouses w ON im.warehouse_id = w.id
            LEFT JOIN users u ON im.user_id = u.id
            WHERE im.document_type = 'transfer'
        `;

        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND im.license_id = $${paramCount}`;
            params.push(userLicenseId);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND im.movement_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND im.movement_date <= $${paramCount}`;
            params.push(dateTo + ' 23:59:59');
            paramCount++;
        }

        query += ' ORDER BY im.movement_date DESC, im.id DESC LIMIT 200';

        const result = await pool.query(query, params);

        // Group movements into transfers (pair out/in)
        const transfers = [];
        const processedIds = new Set();

        result.rows.forEach(row => {
            if (processedIds.has(row.id)) return;

            if (row.direction === 'out') {
                // Find matching "in" movement
                const inMovement = result.rows.find(r =>
                    r.direction === 'in' &&
                    r.product_code === row.product_code &&
                    Math.abs(r.quantity) === Math.abs(row.quantity) &&
                    !processedIds.has(r.id) &&
                    r.id !== row.id
                );

                transfers.push({
                    id: row.id,
                    from_warehouse: row.warehouse_name,
                    to_warehouse: inMovement?.warehouse_name || 'Неизвестно',
                    product_name: row.product_name,
                    items_count: Math.abs(row.quantity),
                    total_value: 0,
                    status: 'completed',
                    created_by: row.created_by,
                    created_at: row.created_at
                });

                processedIds.add(row.id);
                if (inMovement) processedIds.add(inMovement.id);
            }
        });

        res.json({ transfers });
    } catch (error) {
        console.error('Ошибка получения перемещений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать перемещение товара между складами
router.post('/transfer', async (req, res) => {
    const { product_id, from_warehouse_id, to_warehouse_id, quantity, notes } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userLicenseId = req.user?.license_id;

        // Verify product and warehouses belong to license
        if (userLicenseId) {
            const pCheck = await client.query('SELECT 1 FROM products WHERE id = $1 AND license_id = $2', [product_id, userLicenseId]);
            if (pCheck.rows.length === 0) throw new Error('Товар не найден в вашей организации');
            const w1Check = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND license_id = $2', [from_warehouse_id, userLicenseId]);
            if (w1Check.rows.length === 0) throw new Error('Склад отправления не найден в вашей организации');
            const w2Check = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND license_id = $2', [to_warehouse_id, userLicenseId]);
            if (w2Check.rows.length === 0) throw new Error('Склад назначения не найден в вашей организации');
        }

        // Проверяем наличие товара на складе отправления
        const stockCheck = await client.query(
            `SELECT COALESCE(SUM(quantity), 0) as available
             FROM inventory_movements
             WHERE product_id = $1 AND warehouse_id = $2`,
            [product_id, from_warehouse_id]
        );

        const available = parseFloat(stockCheck.rows[0].available);

        if (available < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Недостаточно товара на складе. Доступно: ${available}`
            });
        }

        // Списание со склада отправления
        await client.query(
            `INSERT INTO inventory_movements 
             (product_id, warehouse_id, document_type, quantity, user_id, license_id) 
             VALUES ($1, $2, 'transfer', $3, $4, $5)`,
            [product_id, from_warehouse_id, -quantity, req.user.id, userLicenseId]
        );

        // Приход на склад назначения
        await client.query(
            `INSERT INTO inventory_movements 
             (product_id, warehouse_id, document_type, quantity, user_id, license_id) 
             VALUES ($1, $2, 'transfer', $3, $4, $5)`,
            [product_id, to_warehouse_id, quantity, req.user.id, userLicenseId]
        );

        // Обновить stock_balances для обоих складов
        await updateStockBalance(client, product_id, from_warehouse_id, -quantity);
        await updateStockBalance(client, product_id, to_warehouse_id, quantity);

        await logAudit(
            req.user.id,
            'TRANSFER',
            'inventory_movements',
            null,
            null,
            { product_id, from_warehouse_id, to_warehouse_id, quantity, notes },
            req.ip
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Перемещение выполнено успешно'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка перемещения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        client.release();
    }
});

export default router;
