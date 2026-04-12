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
        const userLicenseId = req.user.license_id; // From JWT token

        let query = `
      SELECT p.id, p.code, p.name, p.category_id, p.unit, 
             p.price_purchase, p.price_sale, p.price_retail, 
             p.vat_rate, p.description, p.barcode, p.image_url, 
             p.is_active, p.license_id, p.created_at, p.updated_at,
             pc.name as category_name,
             COALESCE((
               SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                              WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                              ELSE im.quantity END)
               FROM inventory_movements im WHERE im.product_id = p.id
             ), 0) AS quantity
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.is_active = true
    `;
        const params = [];
        let paramCount = 1;

        // Multi-tenant filtering: license holders only see their own products
        if (userLicenseId) {
            query = `
              SELECT p.id, p.code, p.name, p.category_id, p.unit, 
                     p.price_purchase, p.price_sale, p.price_retail, 
                     p.vat_rate, p.description, p.barcode, p.image_url, 
                     p.is_active, p.license_id, p.created_at, p.updated_at,
                     pc.name as category_name,
                     COALESCE((
                       SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                      WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                      ELSE im.quantity END)
                       FROM inventory_movements im WHERE im.product_id = p.id
                     ), 0) AS quantity
              FROM products p
              LEFT JOIN product_categories pc ON p.category_id = pc.id
              WHERE p.is_active = true AND (p.license_id = $${paramCount} OR p.license_id IS NULL)
            `;
            params.push(userLicenseId);
            paramCount++;
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
            query = query.replace('p.is_active = true', 'p.is_active = false');
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
            res.json({ products: result.rows });
        }
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение всех товаров с остатками (MUST be before /:id to prevent Express /:id match)
router.get('/stock/all', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user.license_id;
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

        if (userLicenseId) {
            query += ` AND (p.license_id = $${paramCount} OR p.license_id IS NULL)`;
            params.push(userLicenseId);
            paramCount++;
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
        const userLicenseId = req.user.license_id;
        let query = `SELECT p.*, pc.name as category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.id = $1`;
        const params = [req.params.id];
        if (userLicenseId) {
            query += ' AND p.license_id = $2';
            params.push(userLicenseId);
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

        // Get license_id from authenticated user
        const licenseId = req.user.license_id || null;

        // Check if product with this code already exists
        const existingProduct = await pool.query(
            'SELECT id FROM products WHERE code = $1',
            [code]
        );

        let result;
        let action;

        if (existingProduct.rows.length > 0) {
            // Update existing product
            result = await pool.query(
                `UPDATE products SET 
                    name = $1, category_id = $2, unit = $3, price_purchase = $4, 
                    price_sale = $5, price_retail = $6, vat_rate = $7, 
                    description = $8, barcode = $9, image_url = $10, 
                    license_id = COALESCE($11, license_id),
                    updated_at = CURRENT_TIMESTAMP
                WHERE code = $12
                RETURNING *`,
                [name, categoryId || null, unit || 'шт', pricePurchase || 0, priceSale || 0, priceRetail || 0, vatRate || 20, description || null, barcode || null, imageUrl || null, licenseId, code]
            );
            action = 'UPDATE';
        } else {
            // Create new product
            result = await pool.query(
                `INSERT INTO products (code, name, category_id, unit, price_purchase, price_sale, price_retail, vat_rate, description, barcode, image_url, license_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *`,
                [code, name, categoryId || null, unit || 'шт', pricePurchase || 0, priceSale || 0, priceRetail || 0, vatRate || 20, description || null, barcode || null, imageUrl || null, licenseId]
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
                    'SELECT id FROM warehouses WHERE is_active = true' + (licenseId ? ' AND license_id = $1' : '') + ' LIMIT 1',
                    licenseId ? [licenseId] : []
                );
                if (wh.rows.length > 0) warehouseId = wh.rows[0].id;
            } catch (e) { /* use default */ }

            await pool.query(
                `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, license_id)
                 VALUES ($1, $2, 'receipt', $3, $4, $5)`,
                [productId, warehouseId, initialQuantity, req.user.id, licenseId]
            );
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
            vatRate, description, barcode, imageUrl, isActive
        } = req.body;

        const oldData = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

        const userLicenseId = req.user.license_id;
        let updateQuery = `UPDATE products SET
        code = $1, name = $2, category_id = $3, unit = $4, price_purchase = $5,
        price_sale = $6, price_retail = $7, vat_rate = $8, description = $9,
        barcode = $10, image_url = $11, is_active = $12, updated_at = CURRENT_TIMESTAMP
       WHERE id = $13`;
        const updateParams = [code, name, categoryId || null, unit, pricePurchase, priceSale, priceRetail, vatRate, description, barcode, imageUrl, isActive, id];

        if (userLicenseId) {
            updateQuery += ' AND license_id = $14';
            updateParams.push(userLicenseId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
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

// Удаление товара (мягкое удаление)
router.delete('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        const { id } = req.params;

        const userLicenseId = req.user.license_id;
        let query = 'UPDATE products SET is_active = false WHERE id = $1';
        const params = [id];
        if (userLicenseId) {
            query += ' AND license_id = $2';
            params.push(userLicenseId);
        }
        query += ' RETURNING *';
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        await logAudit(req.user.id, 'DELETE', 'products', id, null, null, req.ip);

        // Emit real-time update (deactivation)
        const io = req.app.get('io');
        if (io) io.emit('product:updated', { id, action: 'DELETE' });

        res.json({ message: 'Товар деактивирован' });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение остатков на складах
router.get('/:id/inventory', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const userLicenseId = req.user.license_id;
        let query = `SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        COALESCE(SUM(im.quantity), 0) as quantity
       FROM warehouses w
       LEFT JOIN inventory_movements im ON w.id = im.warehouse_id AND im.product_id = $1
       WHERE w.is_active = true`;
        const params = [id];
        if (userLicenseId) {
            query += ' AND w.license_id = $2 AND im.license_id = $2';
            params.push(userLicenseId);
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

        const userLicenseId = req.user.license_id;

        // Verify product belongs to user's license
        const product = await pool.query(
            'SELECT id FROM products WHERE id = $1' + (userLicenseId ? ' AND license_id = $2' : ''),
            userLicenseId ? [id, userLicenseId] : [id]
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
                'SELECT id FROM warehouses WHERE is_active = true' + (userLicenseId ? ' AND license_id = $1' : '') + ' LIMIT 1',
                userLicenseId ? [userLicenseId] : []
            );
            whId = wh.rows[0]?.id || 1;
        }

        await pool.query(
            `INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, user_id, license_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, whId, type || 'adjustment', actualQuantity, req.user.id, userLicenseId]
        );

        // Get updated stock
        const stock = await pool.query(
            'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM inventory_movements WHERE product_id = $1' + (userLicenseId ? ' AND license_id = $2' : ''),
            userLicenseId ? [id, userLicenseId] : [id]
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
