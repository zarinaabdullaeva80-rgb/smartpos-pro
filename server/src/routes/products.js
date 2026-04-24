import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/products/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены'));
        }
    }
});

const router = express.Router();

/**
 * Helper: get organization_id for multi-tenant filtering
 * Falls back to organization_id for backward compatibility
 */
function getOrgId(req) {
    return req.user?.organization_id || req.organizationId || null;
}

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получение всех товаров
 *     tags: [Продукт]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *         description: ID категории
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поисковый запрос
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Только активные товары
 *     responses:
 *       200:
 *         description: Список товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       401:
 *         description: Не авторизован
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { category, search, active } = req.query;
        const orgId = getOrgId(req);

        let query = `
      SELECT p.id, p.code, p.name, p.category_id, p.unit, 
             p.price_purchase, p.price_sale, p.price_retail, 
             p.vat_rate, p.description, p.barcode, p.image_url, 
             p.is_active, p.organization_id, p.min_stock, p.supplier, p.created_at, p.updated_at,
             pc.name as category_name,
             COALESCE((
               SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                              WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                              ELSE im.quantity END)
               FROM inventory_movements im WHERE im.product_id = p.id
             ), 0) AS quantity
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE (p.is_active = true OR p.is_active IS NULL)
    `;
        const params = [];
        let paramCount = 1;

        // Multi-tenant filtering by organization_id
        if (req.user?.user_type === 'super_admin') {
            // Super-admin can see everything, including orphaned data
            if (orgId) {
                query += ` AND (p.organization_id = $${paramCount} OR p.organization_id IS NULL)`;
                params.push(orgId);
                paramCount++;
            }
        } else if (orgId) {
            // Normal clients strictly see only their own data
            query += ` AND p.organization_id = $${paramCount}`;
            params.push(orgId);
            paramCount++;
        } else {
            // No org ID and not super-admin? See nothing.
            query += ` AND 1=0`;
        }

        if (category) {
            query += ` AND p.category_id = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p.code ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        // active param now only used to show inactive (active=false) — default is always active only
        if (active === 'false') {
            query = query.replace('(p.is_active = true OR p.is_active IS NULL)', 'p.is_active = false');
        }

        query += ' ORDER BY p.created_at DESC';

        // Пагинация (опционально — для обратной совместимости)
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 50;
        
        if (page && page > 0) {
            // Сначала получаем общее количество
            const countQuery = query.replace(/SELECT[\s\S]*?FROM products/, 'SELECT COUNT(*) as total FROM products');
            let totalCount = 0;
            try {
                const countResult = await pool.query(countQuery, params);
                totalCount = parseInt(countResult.rows[0]?.total || 0);
            } catch (e) { /* fallback */ }

            const offset = (page - 1) * limit;
            query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            params.push(limit, offset);

            const result = await pool.query(query, params);
            res.json({ 
                products: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            });
        } else {
            const result = await pool.query(query, params);
            console.log(`[DEBUG] GET /products orgId=${orgId} params=${JSON.stringify(params)} found=${result.rows.length}`);
            res.json({ products: result.rows });
        }
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получение товаров с низкими остатками
router.get('/low-stock', authenticate, async (req, res) => {
    try {
        const orgId = getOrgId(req);
        let query = `
            SELECT p.id, p.code, p.name, p.unit, p.min_stock, p.category_id,
                   p.price_purchase, p.price_sale, p.is_active, p.barcode,
                   pc.name as category_name,
                   COALESCE((
                     SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                    WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                    ELSE im.quantity END)
                     FROM inventory_movements im WHERE im.product_id = p.id
                   ), 0) AS quantity
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE (p.is_active = true OR p.is_active IS NULL)
              AND p.min_stock > 0
        `;
        const params = [];
        let paramCount = 1;

        if (req.user?.user_type !== 'super_admin') {
            if (orgId) {
                query += ` AND p.organization_id = $${paramCount}`;
                params.push(orgId);
                paramCount++;
            } else {
                query += ' AND 1=0';
            }
        }

        query += ' ORDER BY p.name';
        const result = await pool.query(query, params);

        // Filter in JS: only those where quantity < min_stock
        const lowStock = result.rows.filter(p => parseFloat(p.quantity) <= parseFloat(p.min_stock) * 1.2);

        res.json({ products: lowStock, total: lowStock.length });
    } catch (error) {
        console.error('Error fetching low-stock products:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Массовое обновление min_stock
router.post('/bulk-update-min-stock', authenticate, async (req, res) => {
    const { updates } = req.body; // [{id, min_stock}, ...]
    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: 'Массив updates обязателен' });
    }
    const orgId = getOrgId(req);
    let updated = 0;
    for (const { id, min_stock } of updates) {
        try {
            let q = 'UPDATE products SET min_stock = $1 WHERE id = $2';
            const p = [min_stock || 0, id];
            if (orgId) { q += ' AND organization_id = $3'; p.push(orgId); }
            const r = await pool.query(q, p);
            if (r.rowCount > 0) updated++;
        } catch (e) { /* skip */ }
    }
    res.json({ message: `Обновлено ${updated} из ${updates.length}`, updated });
});

// Получение всех товаров с остатками (MUST be before /:id to prevent Express /:id match)
router.get('/stock/all', authenticate, async (req, res) => {
    try {
        const orgId = getOrgId(req);
        const { search, category } = req.query;

        let query = `
            SELECT p.id, p.code, p.name, p.unit, p.price_purchase, p.price_sale, 
                   p.is_active, p.barcode, pc.name as category_name,
                   COALESCE(SUM(im.quantity), 0) as total_stock
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN inventory_movements im ON p.id = im.product_id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (req.user?.user_type === 'super_admin') {
            if (orgId) {
                query += ` AND (p.organization_id = $${paramCount} OR p.organization_id IS NULL)`;
                params.push(orgId);
                paramCount++;
            }
        } else if (orgId) {
            query += ` AND p.organization_id = $${paramCount}`;
            params.push(orgId);
            paramCount++;
        } else {
            query += ` AND 1=0`;
        }

        if (search) {
            query += ` AND (p.name ILIKE $${paramCount} OR p.code ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (category) {
            query += ` AND p.category_id = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        query += ' GROUP BY p.id, p.code, p.name, p.unit, p.price_purchase, p.price_sale, p.is_active, p.barcode, pc.name ORDER BY p.name';

        const result = await pool.query(query, params);
        res.json({ products: result.rows });
    } catch (error) {
        console.error('Ошибка получения остатков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение товара по ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const orgId = getOrgId(req);
        let query = `SELECT p.*, pc.name as category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.id = $1`;
        const params = [req.params.id];
        if (req.user?.user_type === 'super_admin') {
            if (orgId) {
                query += ' AND (p.organization_id = $2 OR p.organization_id IS NULL)';
                params.push(orgId);
            }
        } else if (orgId) {
            query += ' AND p.organization_id = $2';
            params.push(orgId);
        } else {
            query += ' AND 1=0';
        }
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json({ product: result.rows[0] });
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание товара (с upsert - обновляет если код уже существует)
router.post('/', authenticate, authorize('Администратор', 'Продавец'), async (req, res) => {
    try {
        const {
            code, name, categoryId, unit, pricePurchase, priceSale, priceRetail,
            vatRate, description, barcode, imageUrl, quantity
        } = req.body;
        const is_active = req.body.is_active !== undefined ? req.body.is_active : (req.body.isActive !== undefined ? req.body.isActive : true);
        const minStock = req.body.minStock !== undefined ? req.body.minStock : (req.body.min_stock || 0);

        const orgId = getOrgId(req);
        const licenseId = req.user.organization_id || null;

        // Check if product with this code already exists (within org scope)
        let existQuery = 'SELECT id FROM products WHERE code = $1';
        const existParams = [code];
        if (orgId) {
            existQuery += ' AND organization_id = $2';
            existParams.push(orgId);
        }
        const existingProduct = await pool.query(existQuery, existParams);

        let result;
        let action;

        if (existingProduct.rows.length > 0) {
            // Update existing product
            let updateQuery = `UPDATE products SET 
                    name = $1, category_id = $2, unit = $3, price_purchase = $4, 
                    price_sale = $5, price_retail = $6, vat_rate = $7, 
                    description = $8, barcode = $9, image_url = $10, 
                    is_active = $11, min_stock = $12,
                    organization_id = COALESCE($13, organization_id),
                    updated_at = CURRENT_TIMESTAMP
                WHERE code = $14`;
            const updateParams = [name, categoryId || null, unit || 'шт', pricePurchase || 0, priceSale || 0, priceRetail || 0, vatRate || 20, description || null, barcode || null, imageUrl || null, is_active, minStock, licenseId, code];
            if (orgId) {
                updateQuery += ' AND organization_id = $15';
                updateParams.push(orgId);
            }
            updateQuery += ' RETURNING *';
            result = await pool.query(updateQuery, updateParams);
            action = 'UPDATE';
        } else {
            // Create new product
            result = await pool.query(
                `INSERT INTO products (code, name, category_id, unit, price_purchase, price_sale, price_retail, vat_rate, description, barcode, image_url, organization_id, min_stock, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *`,
                [code, name, categoryId || null, unit || 'шт', pricePurchase || 0, priceSale || 0, priceRetail || 0, vatRate || 20, description || null, barcode || null, imageUrl || null, orgId || licenseId || null, minStock, is_active]
            );
            action = 'CREATE';
        }

        // If quantity > 0, create initial stock in inventory_movements
        const initialQuantity = parseInt(quantity) || 0;
        if (initialQuantity > 0 && result.rows[0]) {
            const productId = result.rows[0].id;
            // Get default warehouse
            let warehouseId = 1;
            try {
                const wh = await pool.query(
                    'SELECT id FROM warehouses WHERE is_active = true' + (orgId ? ' AND organization_id = $1' : '') + ' LIMIT 1',
                    orgId ? [orgId] : []
                );
                if (wh.rows.length > 0) warehouseId = wh.rows[0].id;
            } catch (e) { /* use default */ }

            await pool.query(
                `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, organization_id)
                 VALUES ($1, $2, 'receipt', $3, $4, $5)`,
                [productId, warehouseId, initialQuantity, req.user.id, orgId || licenseId || null]
            );

            // Также обновляем stock_balances
            try {
                await pool.query(
                    `INSERT INTO stock_balances (product_id, warehouse_id, quantity, available_quantity, organization_id)
                     VALUES ($1, $2, $3, $3, $4)
                     ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
                       quantity = stock_balances.quantity + $3,
                       available_quantity = stock_balances.available_quantity + $3`,
                    [productId, warehouseId, initialQuantity, orgId || licenseId || null]
                );
            } catch (e) { /* stock_balances может не поддерживать upsert */ }
        }

        await logAudit(req.user.id, action, 'products', result.rows[0].id, null, result.rows[0], req.ip);

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('product:updated', { id: result.rows[0].id, action });

        res.status(action === 'CREATE' ? 201 : 200).json({
            message: action === 'CREATE' ? 'Товар создан' : 'Товар обновлен',
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка создания/обновления товара:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Обновление товара
router.put('/:id', authenticate, authorize('Администратор', 'Продавец'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code, name, categoryId, unit, pricePurchase, priceSale, priceRetail,
            vatRate, description, barcode, imageUrl, quantity, supplier
        } = req.body;
        const is_active = req.body.is_active !== undefined ? req.body.is_active : (req.body.isActive !== undefined ? req.body.isActive : true);
        const minStock = req.body.minStock !== undefined ? req.body.minStock : (req.body.min_stock || 0);

        const oldData = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

        const orgId = getOrgId(req);
        let updateQuery = `UPDATE products SET
        code = $1, name = $2, category_id = $3, unit = $4, price_purchase = $5,
        price_sale = $6, price_retail = $7, vat_rate = $8, description = $9,
        barcode = $10, image_url = $11, is_active = $12, min_stock = $13,
        supplier = $14, updated_at = CURRENT_TIMESTAMP
       WHERE id = $15`;
        const updateParams = [code, name, categoryId || null, unit, pricePurchase, priceSale, priceRetail, vatRate, description, barcode, imageUrl, is_active, minStock, supplier || null, id];

        if (orgId) {
            updateQuery += ' AND organization_id = $16';
            updateParams.push(orgId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Обновление количества через inventory_movements
        const newQuantity = parseInt(quantity);
        if (!isNaN(newQuantity) && newQuantity >= 0) {
            // Получаем текущий остаток
            const currentStockRes = await pool.query(`
                SELECT COALESCE(SUM(
                    CASE WHEN document_type IN ('receipt','adjustment','inventory') THEN quantity
                         WHEN document_type IN ('sale','write_off','transfer_out') THEN -quantity
                         ELSE quantity END
                ), 0) AS total FROM inventory_movements WHERE product_id = $1
            `, [id]);
            const currentQty = parseFloat(currentStockRes.rows[0]?.total || 0);
            const diff = newQuantity - currentQty;

            if (Math.abs(diff) > 0.001) {
                await pool.query(
                    `INSERT INTO inventory_movements (product_id, document_type, quantity, user_id, organization_id, notes, created_at)
                     VALUES ($1, 'adjustment', $2, $3, $4, 'Корректировка из карточки товара', NOW())`,
                    [id, diff, req.user.id, orgId || null]
                );
            }
        }

        await logAudit(req.user.id, 'UPDATE', 'products', id, oldData.rows[0], result.rows[0], req.ip);

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('product:updated', { id, action: 'UPDATE' });

        res.json({ message: 'Товар обновлен', product: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Групповое перемещение товаров в другую категорию
router.post('/bulk-move-category', authenticate, async (req, res) => {
    const { ids, categoryId } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Массив ids обязателен' });
    }

    const orgId = getOrgId(req);
    try {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        let query = `UPDATE products SET category_id = $${ids.length + 1} WHERE id IN (${placeholders})`;
        const params = [...ids, categoryId || null];
        if (orgId) {
            query += ` AND organization_id = $${ids.length + 2}`;
            params.push(orgId);
        }
        const result = await pool.query(query, params);

        const io = req.app.get('io');
        if (io) io.emit('product:updated', { action: 'BULK_MOVE', count: result.rowCount });

        res.json({ message: `Перемещено ${result.rowCount} товар(ов)`, moved: result.rowCount });
    } catch (error) {
        console.error('[BulkMove] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Переключение активности товара (вручную)
router.patch('/:id/toggle-active', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = getOrgId(req);
        let query = 'UPDATE products SET is_active = NOT is_active WHERE id = $1';
        const params = [id];
        if (orgId) {
            query += ' AND organization_id = $2';
            params.push(orgId);
        }
        query += ' RETURNING id, is_active';
        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Товар не найден' });
        res.json({ product: result.rows[0], message: result.rows[0].is_active ? 'Товар активирован' : 'Товар деактивирован' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Вспомогательная функция полного удаления товара ──
// Удаляет ВСЕ связанные записи (9 FK-таблиц) перед удалением товара
async function deleteProductById(productId) {
    const dependentTables = [
        'inventory_movements',
        'sale_items',
        'purchase_items',
        'return_items',
        'inventory_items',
        'inventory_adjustments',
        'inventory_check_items',
        'stock_balances',
        'stock_movements',
        'warehouse_document_items'
    ];

    for (const table of dependentTables) {
        try {
            await pool.query(`DELETE FROM ${table} WHERE product_id = $1`, [productId]);
        } catch (e) {
            console.error(`[deleteProductById] Error in table ${table}:`, e.message);
        }
    }

    // Удаляем сам товар
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
}

// Групповое удаление товаров
router.post('/bulk-delete', authenticate, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Массив ids обязателен' });
    }

    const orgId = getOrgId(req);
    const results = { deleted: 0, failed: 0, errors: [] };

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
            // Проверяем что товар принадлежит организации
            const check = await pool.query(
                'SELECT id FROM products WHERE id = $1' + (orgId ? ' AND (organization_id = $2 OR organization_id IS NULL)' : ''),
                orgId ? [id, orgId] : [id]
            );
            if (check.rows.length === 0) {
                results.failed++;
                results.errors.push({ id, error: 'Не найден' });
                continue;
            }

            await deleteProductById(id);
            results.deleted++;

            // Логируем каждые 100
            if (results.deleted % 100 === 0) {
                console.log(`[BulkDelete] Progress: ${results.deleted}/${ids.length}`);
            }
        } catch (error) {
            console.error(`[BulkDelete] Error deleting product ${id}:`, error.message);
            results.failed++;
            results.errors.push({ id, error: error.message });
        }
    }

    console.log(`[BulkDelete] DONE: deleted=${results.deleted} failed=${results.failed} / total=${ids.length}`);
    try { await logAudit(req.user.id, 'BULK_DELETE', 'products', null, null, { ids, results }, req.ip); } catch(e) {}

    const io = req.app.get('io');
    if (io) io.emit('product:updated', { action: 'BULK_DELETE', count: results.deleted });

    res.json({ message: `Удалено ${results.deleted} из ${ids.length} товаров`, ...results });
});

// Удаление товара (полное удаление)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const orgId = getOrgId(req);
        // Проверяем товар
        const check = await pool.query(
            'SELECT id, name FROM products WHERE id = $1' + (orgId ? ' AND (organization_id = $2 OR organization_id IS NULL)' : ''),
            orgId ? [id, orgId] : [id]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        await deleteProductById(id);

        await logAudit(req.user.id, 'DELETE', 'products', id, null, null, req.ip);

        const io = req.app.get('io');
        if (io) io.emit('product:updated', { id, action: 'DELETE' });

        res.json({ message: 'Товар удалён' });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    }
});

// Получение остатков на складах
router.get('/:id/inventory', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const orgId = getOrgId(req);
        let query = `SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        COALESCE(SUM(im.quantity), 0) as quantity
       FROM warehouses w
       LEFT JOIN inventory_movements im ON w.id = im.warehouse_id AND im.product_id = $1
       WHERE w.is_active = true`;
        const params = [id];
        if (orgId) {
            query += ' AND w.organization_id = $2';
            params.push(orgId);
        }
        query += ' GROUP BY w.id, w.name ORDER BY w.name';

        const result = await pool.query(query, params);

        res.json({ inventory: result.rows });
    } catch (error) {
        console.error('Ошибка получения остатков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузка изображения товара
router.post('/:id/upload-image', authenticate, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const imageUrl = `/uploads/products/${req.file.filename}`;

        const result = await pool.query(
            'UPDATE products SET image_url = $1 WHERE id = $2 RETURNING *',
            [imageUrl, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Emit real-time update
        const io = req.app.get('io');
        if (io) io.emit('product:updated', { id, action: 'IMAGE_UPDATE' });

        res.json({ product: result.rows[0], imageUrl });
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Изменение остатков товара (приход/списание/корректировка)
router.post('/:id/stock', authenticate, authorize('Администратор', 'Продавец'), async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, type, warehouse_id, reason } = req.body;
        // type: 'receipt' (приход), 'writeoff' (списание), 'adjustment' (корректировка)

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Количество должно быть больше 0' });
        }

        const orgId = getOrgId(req);
        const userLicenseId = req.user.organization_id;

        // Verify product belongs to user's organization
        const product = await pool.query(
            'SELECT id FROM products WHERE id = $1' + (orgId ? ' AND organization_id = $2' : ''),
            orgId ? [id, orgId] : [id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        // Determine the actual quantity to insert (negative for writeoff)
        const actualQuantity = type === 'writeoff' ? -Math.abs(quantity) : Math.abs(quantity);

        // Get default warehouse if not specified
        let whId = warehouse_id;
        if (!whId) {
            const wh = await pool.query(
                'SELECT id FROM warehouses WHERE is_active = true' + (orgId ? ' AND organization_id = $1' : '') + ' LIMIT 1',
                orgId ? [orgId] : []
            );
            whId = wh.rows[0]?.id || 1;
        }

        await pool.query(
            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, whId, type || 'adjustment', actualQuantity, req.user.id, orgId || null]
        );

        // Get updated stock
        const stock = await pool.query(
            'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM inventory_movements WHERE product_id = $1' + (orgId ? ' AND organization_id = $2' : ''),
            orgId ? [id, orgId] : [id]
        );

        await logAudit(req.user.id, 'STOCK_' + (type || 'adjustment').toUpperCase(), 'products', id, null, { quantity: actualQuantity, type, reason }, req.ip);

        // Emit real-time inventory update
        const io = req.app.get('io');
        if (io) {
            io.emit('inventory:updated', { 
                product_id: id, 
                stock_quantity: parseFloat(stock.rows[0]?.total_stock || 0) 
            });
        }

        res.json({
            message: type === 'receipt' ? 'Приход оформлен' : type === 'writeoff' ? 'Списание оформлено' : 'Остаток скорректирован',
            total_stock: parseFloat(stock.rows[0]?.total_stock || 0)
        });
    } catch (error) {
        console.error('Ошибка изменения остатков:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
