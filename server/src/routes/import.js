import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { updateStockBalance } from '../utils/stockBalance.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

const router = express.Router();

/**
 * Генерация уникального EAN-13 штрихкода
 * Префикс 200 = внутренние товары (не конфликтует с реальными EAN)
 */
function generateEAN13() {
    // 200 + 9 случайных цифр + контрольная цифра
    const prefix = '200';
    let digits = prefix;
    for (let i = 0; i < 9; i++) {
        digits += Math.floor(Math.random() * 10);
    }
    // Подсчёт контрольной цифры EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
}

async function getUniqueBarcode(client) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const barcode = generateEAN13();
        const exists = await client.query('SELECT id FROM products WHERE barcode = $1', [barcode]);
        if (exists.rows.length === 0) return barcode;
    }
    // Фоллбэк: timestamp-based
    return '200' + Date.now().toString().slice(-10);
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'smartpos-imports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls', '.csv', '.json'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Поддерживаемые форматы: .xlsx, .xls, .csv, .json'));
        }
    }
});

// Стандартные маппинги колонок для автоопределения
const COLUMN_MAPPINGS = {
    products: {
        // ── Наименование ──
        'наименование': 'name', 'название': 'name', 'товар': 'name', 'name': 'name', 'product': 'name',
        'наименование товара': 'name', 'название товара': 'name', 'продукт': 'name', 'product name': 'name',
        'имя': 'name', 'имя товара': 'name', 'номенклатура': 'name',

        // ── Штрих-код ──
        'штрих-код': 'barcode', 'штрихкод': 'barcode', 'barcode': 'barcode', 'ean': 'barcode',
        'штрих код': 'barcode', 'bar code': 'barcode', 'ean13': 'barcode', 'ean-13': 'barcode',

        // ── Код/Артикул ──
        'код товара': 'code', 'код': 'code', 'артикул': 'code', 'sku': 'code', 'article': 'code',
        'арт': 'code', 'арт.': 'code', 'product code': 'code', 'item code': 'code', 'внутренний код': 'code',
        'икпу': 'code',

        // ── Категория ──
        'категория': 'category', 'группа': 'category', 'category': 'category', 'group': 'category',
        'группа товара': 'category', 'раздел': 'category', 'подгруппа': 'category',

        // ── Единица измерения ──
        'единица': 'unit', 'ед. изм.': 'unit', 'ед.изм': 'unit', 'ед.изм.': 'unit', 'unit': 'unit', 'uom': 'unit',
        'единица измерения': 'unit', 'ед': 'unit', 'изм': 'unit', 'мера': 'unit',
        'код единицы измерения': 'unit', 'код ед измерения': 'unit', 'код ед изм': 'unit',

        // ── Цена продажи ──
        'цена': 'price_sale', 'цена продажи': 'price_sale', 'розничная цена': 'price_sale', 'price': 'price_sale', 'retail price': 'price_sale',
        'цена розница': 'price_sale', 'розница': 'price_sale', 'продажная цена': 'price_sale', 'цена реализации': 'price_sale',
        'sale price': 'price_sale', 'selling price': 'price_sale', 'retail': 'price_sale',
        'цена продажи (вкл ндс)': 'price_sale', 'цена продажи (вкл. ндс)': 'price_sale',
        'цена продажи (включая ндс)': 'price_sale', 'цена с ндс': 'price_sale',

        // ── Цена закупки ──
        'цена закупа': 'price_purchase', 'цена закупки': 'price_purchase',
        'себестоимость': 'price_purchase', 'закупочная цена': 'price_purchase', 'cost': 'price_purchase',
        'закупка': 'price_purchase', 'входная цена': 'price_purchase',
        'cost price': 'price_purchase', 'buy price': 'price_purchase',

        // ── Оптовая цена ──
        'оптовая цена': 'price_retail', 'оптовая': 'price_retail', 'wholesale price': 'price_retail',
        'опт': 'price_retail', 'wholesale': 'price_retail',

        // ── Количество / Остаток ──
        'остаток': 'quantity', 'количество': 'quantity', 'кол-во': 'quantity', 'qty': 'quantity', 'quantity': 'quantity', 'stock': 'quantity',
        'кол': 'quantity', 'запас': 'quantity', 'наличие': 'quantity', 'остатки': 'quantity', 'in stock': 'quantity',
        // Варианты с скобками и пояснениями
        'количество (остатки)': 'quantity', 'кол-во (остатки)': 'quantity',
        'остаток на складе': 'quantity', 'остаток (шт)': 'quantity',
        'quantity (stock)': 'quantity', 'stock quantity': 'quantity', 'available': 'quantity',

        // ── Описание ──
        'описание': 'description', 'description': 'description', 'примечание': 'description', 'комментарий': 'description',
        'мнн': 'description',

        // ── Мин. остаток ──
        'мин. остаток': 'min_stock', 'минимальный остаток': 'min_stock', 'min stock': 'min_stock', 'мин остаток': 'min_stock',
        'минимальное остаток': 'min_stock', 'минимальный': 'min_stock',

        // ── Макс. остаток ──
        'максимальный остаток': 'max_stock', 'макс. остаток': 'max_stock', 'макс остаток': 'max_stock',
        'max stock': 'max_stock', 'максимальный': 'max_stock',

        // ── Ставка НДС ──
        'ставка ндс': 'vat_rate', 'ндс': 'vat_rate', 'vat': 'vat_rate', 'налог': 'vat_rate',
        'ндс %': 'vat_rate', 'vat rate': 'vat_rate', 'tax rate': 'vat_rate',

        // ── Производитель ──
        'производитель': 'manufacturer', 'manufacturer': 'manufacturer', 'brand': 'manufacturer',
        'бренд': 'manufacturer', 'торговая марка': 'manufacturer',

        // ── Страна ──
        'страна': 'country', 'country': 'country', 'страна производства': 'country',
        'страна происхождения': 'country', 'origin': 'country',

        // ── ID (внешний) ──
        'id': 'external_id', 'внешний id': 'external_id', 'external id': 'external_id',
        'internal id': 'external_id', 'код в системе': 'external_id',

        // ── Маркировка ──
        'маркировка(да/нет)': 'is_marked', 'маркировка': 'is_marked', 'marking': 'is_marked',

        // ── Тип товара ──
        'тип товара(перепродажа,собств. производство,услуга)': 'product_type', 'тип товара': 'product_type',
        'тип': 'product_type', 'product type': 'product_type', 'type': 'product_type',

        // ── Весовой ──
        'весовой(да/нет)': 'is_weight', 'весовой': 'is_weight', 'weight': 'is_weight',

        // ── Рецептурный ──
        'рецептурный(да/нет)': 'is_prescription', 'рецептурный': 'is_prescription',

        // ── По-штучно ──
        'продавать по-штучно(да/нет)': 'sell_by_piece', 'продавать по-штучно': 'sell_by_piece',
        'по-штучно': 'sell_by_piece', 'штучный': 'sell_by_piece',

        // ── Комиссионный ──
        'комиссионный(да/нет)': 'is_commission', 'комиссионный': 'is_commission',

        // ── Код PLU ──
        'код plu': 'plu_code', 'plu': 'plu_code', 'plu code': 'plu_code',

        // ── Цена в валюте ──
        'цена указана в валюте? (да/нет)': 'price_in_currency', 'цена в валюте': 'price_in_currency',

        // ── Минимальная сумма для опта ──
        'минимальная сумма для опта': 'min_wholesale_amount',

        // ── Серия / Срок годности / АТС ──
        'номер серии': 'serial_number', 'серия': 'serial_number', 'serial': 'serial_number',
        'срок годности(dd/mm/yyyy)': 'expiry_date', 'срок годности': 'expiry_date', 'expiry': 'expiry_date',
        'атс': 'atc_code', 'atc': 'atc_code',

        // ── Кол-во в упаковке ──
        'кол-во в упаковке': 'pack_quantity', 'количество в упаковке': 'pack_quantity', 'pack size': 'pack_quantity',
    },
    categories: {
        'название': 'name', 'наименование': 'name', 'категория': 'name', 'name': 'name',
        'описание': 'description', 'description': 'description',
        'родительская категория': 'parent', 'parent': 'parent',
    },
    customers: {
        'имя': 'name', 'название': 'name', 'наименование': 'name', 'клиент': 'name', 'name': 'name', 'customer': 'name',
        'телефон': 'phone', 'phone': 'phone', 'тел': 'phone', 'мобильный': 'phone',
        'email': 'email', 'почта': 'email', 'эл. почта': 'email',
        'адрес': 'address', 'address': 'address',
        'инн': 'inn', 'inn': 'inn', 'tin': 'inn',
        'примечание': 'notes', 'комментарий': 'notes', 'notes': 'notes',
    }
};

// Доступные поля и их описания
const FIELD_DESCRIPTIONS = {
    products: {
        name: { label: 'Наименование', required: true },
        barcode: { label: 'Штрих-код', required: false },
        code: { label: 'Артикул', required: false },
        category: { label: 'Категория', required: false },
        unit: { label: 'Единица измерения', required: false },
        price_sale: { label: 'Цена продажи', required: false },
        price_purchase: { label: 'Закупочная цена', required: false },
        quantity: { label: 'Остаток', required: false },
        description: { label: 'Описание', required: false },
        min_stock: { label: 'Мин. остаток', required: false },
    },
    categories: {
        name: { label: 'Название', required: true },
        description: { label: 'Описание', required: false },
        parent: { label: 'Родительская категория', required: false },
    },
    customers: {
        name: { label: 'Имя / Название', required: true },
        phone: { label: 'Телефон', required: false },
        email: { label: 'E-mail', required: false },
        address: { label: 'Адрес', required: false },
        inn: { label: 'ИНН', required: false },
        notes: { label: 'Примечание', required: false },
    }
};

/**
 * Парсинг загруженного файла в массив объектов
 */
function parseFile(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    if (ext === '.json') {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [data];
    }

    // Excel / CSV
    const workbook = XLSX.readFile(filePath, { type: 'file', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rows;
}

/**
 * Автоматический маппинг колонок файла на поля БД
 * 1) Точное совпадение
 * 2) Заголовок CONTAINS ключевое слово (для "\u041aоличество (Остатки)" и т.п.)
 * 3) Ключевое слово CONTAINS заголовок
 */
function autoMapColumns(fileHeaders, type) {
    const mappingDict = COLUMN_MAPPINGS[type] || {};
    const result = {};
    const mappingKeys = Object.keys(mappingDict);

    for (const header of fileHeaders) {
        const normalized = header.toLowerCase().trim();

        // Шаг 1: Точное совпадение
        if (mappingDict[normalized]) {
            result[header] = mappingDict[normalized];
            continue;
        }

        // Шаг 2: заголовок содержит ключ (напр., "Количество (Остатки)" → содержит "количество")
        let matched = false;
        for (const key of mappingKeys) {
            if (normalized.includes(key)) {
                result[header] = mappingDict[key];
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Шаг 3: ключ содержит заголовок (напр., "название" → заголовок "назв"не применяется, но шорткие ключи могут)
        for (const key of mappingKeys) {
            if (key.length >= 4 && normalized.startsWith(key)) {
                result[header] = mappingDict[key];
                break;
            }
        }
    }

    return result;
}

/**
 * GET /api/import/fields/:type - Получить доступные поля для маппинга
 */
router.get('/fields/:type', authenticate, (req, res) => {
    const { type } = req.params;
    const fields = FIELD_DESCRIPTIONS[type];
    if (!fields) {
        return res.status(400).json({ error: `Неизвестный тип данных: ${type}. Поддерживаются: products, categories, customers` });
    }
    res.json({ type, fields });
});

/**
 * POST /api/import/preview - Предпросмотр файла (парсинг + автомаппинг, без записи в БД)
 */
router.post('/preview', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const { type } = req.body; // products, categories, customers
        if (!type || !FIELD_DESCRIPTIONS[type]) {
            return res.status(400).json({ error: 'Укажите тип данных: products, categories, customers' });
        }

        const rows = parseFile(req.file.path, req.file.originalname);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Файл пуст или не удалось распознать данные' });
        }

        // Заголовки из первой строки
        const fileHeaders = Object.keys(rows[0]);

        // Автомаппинг
        const suggestedMapping = autoMapColumns(fileHeaders, type);

        // Превью первых 10 строк
        const previewRows = rows.slice(0, 10);

        // Очистка временного файла
        // НЕ удаляем — он понадобится для импорта. Сохраняем путь.

        res.json({
            success: true,
            totalRows: rows.length,
            fileHeaders,
            suggestedMapping,
            availableFields: FIELD_DESCRIPTIONS[type],
            previewRows,
            filePath: req.file.path, // для последующего импорта
            fileName: req.file.originalname,
        });

    } catch (error) {
        console.error('[Import] Preview error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/import/execute - Выполнить импорт данных из файла
 */
router.post('/execute', authenticate, upload.single('file'), async (req, res) => {
    const client = await pool.connect();
    try {
        const orgId = req.user?.organization_id;
        const { type, mapping: mappingStr, filePath: existingFilePath } = req.body;
        const mapping = typeof mappingStr === 'string' ? JSON.parse(mappingStr) : mappingStr;

        if (!type || !FIELD_DESCRIPTIONS[type]) {
            return res.status(400).json({ error: 'Укажите тип данных: products, categories, customers' });
        }

        if (!mapping || Object.keys(mapping).length === 0) {
            return res.status(400).json({ error: 'Маппинг колонок не указан' });
        }

        // Определить файл: загруженный сейчас или ранее (preview)
        let filePath, fileName;
        if (req.file) {
            filePath = req.file.path;
            fileName = req.file.originalname;
        } else if (existingFilePath && fs.existsSync(existingFilePath)) {
            filePath = existingFilePath;
            fileName = path.basename(existingFilePath);
        } else {
            return res.status(400).json({ error: 'Файл не найден. Загрузите файл заново.' });
        }

        const rows = parseFile(filePath, fileName);
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Файл пуст' });
        }

        // Маппинг: { fileColumn -> dbField }
        // Инвертировать если нужно
        const columnToField = {};
        for (const [fileCol, dbField] of Object.entries(mapping)) {
            columnToField[fileCol] = dbField;
        }

        let imported = 0;
        let updated = 0;
        let errors = [];

        await client.query('BEGIN');

        if (type === 'products') {
            // Кэш категорий
            const catResult = await client.query('SELECT id, name FROM product_categories');
            const categoryMap = {};
            catResult.rows.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });
            
            // Найти основной склад
            const whResult = await client.query('SELECT id FROM warehouses WHERE organization_id = $1 OR organization_id IS NULL ORDER BY is_active DESC, id ASC LIMIT 1', [orgId || null]);
            const primaryWarehouseId = whResult.rows.length > 0 ? whResult.rows[0].id : null;

            for (let i = 0; i < rows.length; i++) {
                try {
                    await client.query(`SAVEPOINT row_${i}`);
                    const row = rows[i];
                    const mapped = {};
                    for (const [fileCol, dbField] of Object.entries(columnToField)) {
                        if (row[fileCol] !== undefined && row[fileCol] !== '') {
                            mapped[dbField] = row[fileCol];
                        }
                    }

                    if (!mapped.name) {
                        errors.push({ row: i + 2, error: 'Наименование обязательно' });
                        continue;
                    }

                    // Найти или создать категорию
                    let categoryId = null;
                    if (mapped.category) {
                        const catName = String(mapped.category).trim();
                        const catKey = catName.toLowerCase();
                        if (categoryMap[catKey]) {
                            categoryId = categoryMap[catKey];
                        } else {
                            // SELECT+INSERT вместо ON CONFLICT (name нет UNIQUE constraint)
                            const existCat = await client.query(
                                'SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1) AND (organization_id = $2 OR organization_id IS NULL)',
                                [catName, orgId || null]
                            );
                            if (existCat.rows.length > 0) {
                                categoryId = existCat.rows[0].id;
                            } else {
                                const catCode = 'CAT-' + catName.replace(/[^a-zA-Z0-9а-яА-Я]/g, '').substring(0, 20).toUpperCase() + '-' + Date.now().toString(36);
                                const newCat = await client.query(
                                    'INSERT INTO product_categories (name, code, organization_id) VALUES ($1, $2, $3) RETURNING id',
                                    [catName, catCode, orgId || null]
                                );
                                categoryId = newCat.rows[0].id;
                            }
                            categoryMap[catKey] = categoryId;
                        }
                    }

                    // Проверка дубликата по штрих-коду ИЛИ коду
                    let existingProduct = null;
                    if (mapped.barcode) {
                        const dupParams = [String(mapped.barcode)];
                        let dupQuery = 'SELECT id FROM products WHERE barcode = $1';
                        if (orgId) {
                            dupParams.push(orgId);
                            dupQuery += ` AND organization_id = $${dupParams.length}`;
                        }
                        const dup = await client.query(dupQuery, dupParams);
                        if (dup.rows.length > 0) existingProduct = dup.rows[0];
                    }
                    // Если не нашли по штрихкоду — ищем по коду
                    if (!existingProduct && mapped.code) {
                        const codeParams = [String(mapped.code).trim()];
                        let codeQuery = 'SELECT id FROM products WHERE code = $1';
                        if (orgId) {
                            codeParams.push(orgId);
                            codeQuery += ` AND (organization_id = $${codeParams.length} OR organization_id IS NULL)`;
                        }
                        const codeDup = await client.query(codeQuery, codeParams);
                        if (codeDup.rows.length > 0) existingProduct = codeDup.rows[0];
                    }

                    if (existingProduct) {
                        // Обновить существующий товар
                        const updateRes = await client.query(`
                            UPDATE products SET
                                name = COALESCE($1, name),
                                code = COALESCE($2, code),
                                category_id = COALESCE($3, category_id),
                                unit = COALESCE($4, unit),
                                price_sale = COALESCE($5, price_sale),
                                price_purchase = COALESCE($6, price_purchase),
                                description = COALESCE($7, description),
                                min_stock = COALESCE($8, min_stock),
                                is_active = true,
                                updated_at = NOW()
                            WHERE id = $9
                            RETURNING id
                        `, [
                            mapped.name || null,
                            mapped.code || null,
                            categoryId,
                            mapped.unit || null,
                            mapped.price_sale ? parseFloat(mapped.price_sale) : null,
                            mapped.price_purchase ? parseFloat(mapped.price_purchase) : null,
                            mapped.description || null,
                            mapped.min_stock ? parseInt(mapped.min_stock) : null,
                            existingProduct.id
                        ]);
                        const productId = updateRes.rows[0].id;
                        
                        // Обработка количества (если указано)
                        const qty = parseFloat(mapped.quantity);
                        if (!isNaN(qty) && qty > 0 && primaryWarehouseId) {
                            // Проверяем текущий остаток, прежде чем добавлять
                            const currentStock = await client.query('SELECT quantity FROM stock_balances WHERE product_id = $1 AND warehouse_id = $2', [productId, primaryWarehouseId]);
                            if (currentStock.rows.length === 0 || parseFloat(currentStock.rows[0].quantity) === 0) {
                                await client.query(`
                                    INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, cost_price, user_id, organization_id, movement_date)
                                    VALUES ($1, $2, 'receipt', $3, $4, $5, $6, NOW())
                                `, [productId, primaryWarehouseId, qty, mapped.price_purchase ? parseFloat(mapped.price_purchase) : 0, req.user.id, orgId || null]);
                                await updateStockBalance(client, productId, primaryWarehouseId, qty);
                            }
                        }

                        await client.query(`RELEASE SAVEPOINT row_${i}`);
                        updated++;
                    } else {
                        // Вставить новый товар
                        const insertRes = await client.query(`
                            INSERT INTO products (name, barcode, code, category_id, unit, price_sale, price_purchase, description, min_stock, is_active, organization_id, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW())
                            RETURNING id
                        `, [
                            mapped.name,
                            mapped.barcode || await getUniqueBarcode(client),
                            mapped.code || null,
                            categoryId,
                            mapped.unit || 'шт',
                            mapped.price_sale ? parseFloat(mapped.price_sale) : 0,
                            mapped.price_purchase ? parseFloat(mapped.price_purchase) : 0,
                            mapped.description || '',
                            mapped.min_stock ? parseInt(mapped.min_stock) : 0,
                            orgId || null,
                        ]);
                        const productId = insertRes.rows[0].id;

                        // Обработка начального количества
                        const qty = parseFloat(mapped.quantity);
                        if (!isNaN(qty) && qty > 0 && primaryWarehouseId) {
                            await client.query(`
                                INSERT INTO inventory_movements (product_id, warehouse_id, document_type, quantity, cost_price, user_id, organization_id, movement_date)
                                VALUES ($1, $2, 'receipt', $3, $4, $5, $6, NOW())
                            `, [productId, primaryWarehouseId, qty, mapped.price_purchase ? parseFloat(mapped.price_purchase) : 0, req.user.id, orgId || null]);
                            await updateStockBalance(client, productId, primaryWarehouseId, qty);
                        }

                        await client.query(`RELEASE SAVEPOINT row_${i}`);
                        imported++;
                    }
                } catch (rowErr) {
                    await client.query(`ROLLBACK TO SAVEPOINT row_${i}`).catch(() => {});
                    errors.push({ row: i + 2, error: rowErr.message });
                    if (errors.length <= 5) console.error(`[Import] Row ${i+2} error:`, rowErr.message);
                }
            }
        } else if (type === 'categories') {
            for (let i = 0; i < rows.length; i++) {
                try {
                    await client.query(`SAVEPOINT cat_${i}`);
                    const row = rows[i];
                    const mapped = {};
                    for (const [fileCol, dbField] of Object.entries(columnToField)) {
                        if (row[fileCol] !== undefined && row[fileCol] !== '') {
                            mapped[dbField] = row[fileCol];
                        }
                    }
                    if (!mapped.name) {
                        errors.push({ row: i + 2, error: 'Название категории обязательно' });
                        await client.query(`RELEASE SAVEPOINT cat_${i}`);
                        continue;
                    }

                    // SELECT+INSERT вместо ON CONFLICT (name нет UNIQUE constraint)
                    const existCat = await client.query(
                        'SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1) AND (organization_id = $2 OR organization_id IS NULL)',
                        [mapped.name, orgId || null]
                    );
                    if (existCat.rows.length > 0) {
                        // Обновить описание если есть
                        if (mapped.description) {
                            await client.query(
                                'UPDATE product_categories SET description = $1 WHERE id = $2',
                                [mapped.description, existCat.rows[0].id]
                            );
                        }
                        updated++;
                    } else {
                        const catCode = mapped.code || ('CAT-' + String(mapped.name).replace(/[^a-zA-Z0-9а-яА-Я]/g, '').substring(0, 20).toUpperCase() + '-' + Date.now().toString(36));
                        await client.query(
                            'INSERT INTO product_categories (name, code, description, organization_id) VALUES ($1, $2, $3, $4)',
                            [mapped.name, catCode, mapped.description || '', orgId || null]
                        );
                        imported++;
                    }
                    await client.query(`RELEASE SAVEPOINT cat_${i}`);
                } catch (rowErr) {
                    await client.query(`ROLLBACK TO SAVEPOINT cat_${i}`).catch(() => {});
                    errors.push({ row: i + 2, error: rowErr.message });
                }
            }
        } else if (type === 'customers') {
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const mapped = {};
                    for (const [fileCol, dbField] of Object.entries(columnToField)) {
                        if (row[fileCol] !== undefined && row[fileCol] !== '') {
                            mapped[dbField] = row[fileCol];
                        }
                    }
                    if (!mapped.name) {
                        errors.push({ row: i + 2, error: 'Имя клиента обязательно' });
                        continue;
                    }

                    // Проверка по телефону
                    let existing = null;
                    if (mapped.phone) {
                        const dup = await client.query('SELECT id FROM counterparties WHERE phone = $1', [mapped.phone]);
                        if (dup.rows.length > 0) existing = dup.rows[0];
                    }

                    if (existing) {
                        await client.query(`
                            UPDATE counterparties SET
                                name = COALESCE($1, name),
                                email = COALESCE($2, email),
                                address = COALESCE($3, address),
                                inn = COALESCE($4, inn),
                                notes = COALESCE($5, notes),
                                updated_at = NOW()
                            WHERE id = $6
                        `, [mapped.name, mapped.email || null, mapped.address || null, mapped.inn || null, mapped.notes || null, existing.id]);
                        updated++;
                    } else {
                        await client.query(`
                            INSERT INTO counterparties (name, phone, email, address, inn, notes, type, organization_id, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, 'customer', $7, NOW())
                        `, [mapped.name, mapped.phone || null, mapped.email || null, mapped.address || null, mapped.inn || null, mapped.notes || '', orgId || null]);
                        imported++;
                    }
                } catch (rowErr) {
                    errors.push({ row: i + 2, error: rowErr.message });
                }
            }
        }

        await client.query('COMMIT');

        // Записать в лог импортов
        try {
            await pool.query(`
                INSERT INTO import_logs (type, filename, total_rows, imported, updated, errors, user_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [type, fileName, rows.length, imported, updated, JSON.stringify(errors.slice(0, 100)), req.user?.id || null]);
        } catch (logErr) {
            console.warn('[Import] Could not log import:', logErr.message);
        }

        // Удалить временный файл
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

        res.json({
            success: true,
            totalRows: rows.length,
            imported,
            updated,
            errorsCount: errors.length,
            errors: errors.slice(0, 50), // Максимум 50 ошибок в ответе
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Import] Execute error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

/**
 * GET /api/import/template/:type - Скачать шаблон Excel для заполнения
 */
router.get('/template/:type', authenticate, (req, res) => {
    const { type } = req.params;
    const fields = FIELD_DESCRIPTIONS[type];
    if (!fields) {
        return res.status(400).json({ error: `Неизвестный тип: ${type}` });
    }

    const wb = XLSX.utils.book_new();

    // Создать заголовки из полей
    const headers = Object.entries(fields).map(([key, info]) => info.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Примеры данных
    const examples = {
        products: [['Молоко 3.2%', '4607004890123', 'MLK-001', 'Молочные продукты', 'шт', '15000', '12000', '50', 'Молоко пастеризованное', '10']],
        categories: [['Молочные продукты', 'Молоко, кефир, сметана', '']],
        customers: [['Иванов Иван', '+998901234567', 'ivanov@mail.ru', 'ул. Навои 1', '123456789', 'Постоянный клиент']],
    };

    if (examples[type]) {
        XLSX.utils.sheet_add_aoa(ws, examples[type], { origin: 'A2' });
    }

    // Ширина колонок
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));

    XLSX.utils.book_append_sheet(wb, ws, type === 'products' ? 'Товары' : type === 'categories' ? 'Категории' : 'Клиенты');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const fileNames = { products: 'шаблон_товары', categories: 'шаблон_категории', customers: 'шаблон_клиенты' };
    res.setHeader('Content-Disposition', `attachment; filename="${fileNames[type] || 'template'}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

/**
 * GET /api/import/logs - История импортов
 */
router.get('/logs', authenticate, async (req, res) => {
    try {
        // Сначала проверим и создадим таблицу если нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS import_logs (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                filename VARCHAR(500),
                total_rows INTEGER DEFAULT 0,
                imported INTEGER DEFAULT 0,
                updated INTEGER DEFAULT 0,
                errors JSONB DEFAULT '[]',
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        const result = await pool.query(`
            SELECT il.*, u.full_name as user_name
            FROM import_logs il
            LEFT JOIN users u ON il.user_id = u.id
            ORDER BY il.created_at DESC
            LIMIT 50
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('[Import] Logs error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/import/products/auto - Быстрый импорт товаров с автомаппингом
 * V4: Полностью автономная обработка — БЕЗ транзакций.
 * Каждая строка → отдельный pool.query (независимый коннект из пула).
 * Исправлено: колонка `price` (NOT NULL) теперь всегда заполняется.
 */
router.post('/products/auto', authenticate, upload.single('file'), async (req, res) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[Import V4] REQUEST', new Date().toISOString());
    console.log('[Import V4] User:', req.user?.username, '| OrgID:', req.user?.organization_id);
    console.log('[Import V4] File:', req.file?.originalname, '| Size:', req.file?.size, 'bytes');
    console.log('═══════════════════════════════════════════════════════');

    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

        const orgId = req.user?.organization_id || null;
        const rows = parseFile(req.file.path, req.file.originalname);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Файл пуст или не удалось распознать данные' });
        }

        const fileHeaders = Object.keys(rows[0]);
        const mapping = autoMapColumns(fileHeaders, 'products');
        console.log('[Import V4] Total rows:', rows.length);
        console.log('[Import V4] File headers:', fileHeaders.join(', '));
        console.log('[Import V4] Auto mapping:', JSON.stringify(mapping));

        if (!mapping || Object.keys(mapping).length === 0) {
            return res.status(400).json({
                error: 'Не удалось автоматически определить колонки. Проверьте заголовки файла.',
                fileHeaders
            });
        }

        // Проверяем, есть ли маппинг для name
        const hasNameMapping = Object.values(mapping).includes('name');
        if (!hasNameMapping) {
            return res.status(400).json({
                error: 'Колонка "Наименование" не найдена в файле. Убедитесь что заголовок содержит "Название", "Наименование" или "Товар".',
                fileHeaders,
                mapping
            });
        }

        let imported = 0, updated = 0, skipped = 0;
        const errors = [];

        // ═══════════════════════════════════════════
        // ЭТАП 0: Загрузка справочников (pool.query — без транзакций)
        // ═══════════════════════════════════════════
        let categoryMap = {};
        try {
            const catResult = await pool.query(
                'SELECT id, name FROM product_categories WHERE organization_id = $1 OR organization_id IS NULL',
                [orgId]
            );
            catResult.rows.forEach(c => { categoryMap[c.name.toLowerCase().trim()] = c.id; });
            console.log('[Import V4] Loaded', Object.keys(categoryMap).length, 'categories');
        } catch (e) {
            console.error('[Import V4] Failed to load categories:', e.message);
        }

        let warehouseId = null;
        try {
            const wRes = await pool.query(
                'SELECT id FROM warehouses WHERE organization_id = $1 OR organization_id IS NULL ORDER BY id LIMIT 1',
                [orgId]
            );
            if (wRes.rows.length > 0) warehouseId = wRes.rows[0].id;
            console.log('[Import V4] Warehouse ID:', warehouseId);
        } catch (e) {
            console.log('[Import V4] No warehouse found, stock won\'t be set');
        }

        // ═══════════════════════════════════════════
        // ЭТАП 1: Предварительное создание категорий
        // ═══════════════════════════════════════════
        const categoryFileCol = Object.entries(mapping).find(([, v]) => v === 'category')?.[0];
        if (categoryFileCol) {
            const uniqueCats = new Set();
            for (const row of rows) {
                const catVal = row[categoryFileCol];
                if (catVal && String(catVal).trim()) uniqueCats.add(String(catVal).trim());
            }
            console.log('[Import V4] Unique categories in file:', uniqueCats.size);

            for (const catName of uniqueCats) {
                const catKey = catName.toLowerCase().trim();
                if (categoryMap[catKey]) continue;

                try {
                    const existCat = await pool.query(
                        'SELECT id FROM product_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (organization_id = $2 OR organization_id IS NULL)',
                        [catName, orgId]
                    );
                    if (existCat.rows.length > 0) {
                        categoryMap[catKey] = existCat.rows[0].id;
                    } else {
                        const catCode = 'CAT-' + catName.replace(/[^a-zA-Z0-9а-яА-Я]/g, '').substring(0, 20).toUpperCase() + '-' + Date.now().toString(36);
                        const newCat = await pool.query(
                            'INSERT INTO product_categories (name, code, organization_id) VALUES ($1, $2, $3) RETURNING id',
                            [catName, catCode, orgId]
                        );
                        categoryMap[catKey] = newCat.rows[0].id;
                        console.log('[Import V4] Category created:', catName, '→ id:', newCat.rows[0].id);
                    }
                } catch (catErr) {
                    console.error('[Import V4] Category error "' + catName + '":', catErr.message);
                }
            }
        }

        // ═══════════════════════════════════════════
        // ЭТАП 2: Импорт товаров (каждая строка — автономный pool.query)
        // ═══════════════════════════════════════════
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                // Маппинг строки
                const mapped = {};
                for (const [fileCol, dbField] of Object.entries(mapping)) {
                    const val = row[fileCol];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        mapped[dbField] = String(val).trim();
                    }
                }

                if (!mapped.name) {
                    skipped++;
                    continue; // пропускаем строки без имени
                }

                // Категория из кэша
                let categoryId = null;
                if (mapped.category) {
                    categoryId = categoryMap[mapped.category.toLowerCase().trim()] || null;
                }

                // Парсинг числовых значений с защитой от NaN
                const parseNum = (val) => {
                    if (!val) return 0;
                    const n = parseFloat(String(val).replace(/[^\d.,\-]/g, '').replace(',', '.'));
                    return isNaN(n) ? 0 : n;
                };

                // Парсинг Да/Нет → boolean
                const parseBool = (val) => {
                    if (!val) return false;
                    const v = String(val).trim().toLowerCase();
                    return v === 'да' || v === 'yes' || v === 'true' || v === '1';
                };

                const barcode = mapped.barcode ? String(mapped.barcode).replace(/\s/g, '') : null;
                const priceSale = parseNum(mapped.price_sale);
                const pricePurchase = parseNum(mapped.price_purchase);
                const priceRetail = parseNum(mapped.price_retail); // оптовая цена
                const priceMain = priceSale || pricePurchase || 0; // для NOT NULL колонки `price`
                const quantity = parseNum(mapped.quantity);
                const minStock = parseNum(mapped.min_stock);
                const maxStock = parseNum(mapped.max_stock);
                const vatRate = mapped.vat_rate ? parseInt(String(mapped.vat_rate).replace(/[^\d]/g, '')) || 0 : 0;
                const unit = mapped.unit || 'шт';

                // Собираем description из нескольких полей
                const descParts = [];
                if (mapped.description) descParts.push(mapped.description);
                if (mapped.manufacturer) descParts.push('Производитель: ' + mapped.manufacturer);
                if (mapped.country) descParts.push('Страна: ' + mapped.country);
                if (mapped.product_type) descParts.push('Тип: ' + mapped.product_type);
                if (mapped.serial_number) descParts.push('Серия: ' + mapped.serial_number);
                if (mapped.atc_code) descParts.push('АТС: ' + mapped.atc_code);
                if (mapped.pack_quantity) descParts.push('В упаковке: ' + mapped.pack_quantity);
                const description = descParts.join('; ');

                // Генерация уникального кода (если не задан)
                let code = mapped.code || barcode || null;

                // ── Поиск дубликата ──
                let existingId = null;

                // 1) По barcode
                if (barcode && !existingId) {
                    try {
                        const dup = await pool.query(
                            'SELECT id FROM products WHERE barcode = $1 AND (organization_id = $2 OR organization_id IS NULL)',
                            [barcode, orgId]
                        );
                        if (dup.rows.length > 0) existingId = dup.rows[0].id;
                    } catch (e) { /* ignore lookup error */ }
                }

                // 2) По code
                if (!existingId && code) {
                    try {
                        const dup = await pool.query(
                            'SELECT id FROM products WHERE code = $1 AND (organization_id = $2 OR organization_id IS NULL)',
                            [code, orgId]
                        );
                        if (dup.rows.length > 0) existingId = dup.rows[0].id;
                    } catch (e) { /* ignore lookup error */ }
                }

                // 3) По name (последний шанс найти дубликат)
                if (!existingId) {
                    try {
                        const dup = await pool.query(
                            'SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (organization_id = $2 OR organization_id IS NULL)',
                            [mapped.name, orgId]
                        );
                        if (dup.rows.length > 0) existingId = dup.rows[0].id;
                    } catch (e) { /* ignore lookup error */ }
                }

                if (existingId) {
                    // ── UPDATE существующего товара: ТОЛЬКО обновляем остаток ──
                    // Данные товара (цена, название, категория) не перезаписываем

                    if (quantity > 0) {
                        // Считаем текущий остаток
                        const currentStock = await pool.query(
                            `SELECT COALESCE(SUM(
                                CASE WHEN document_type IN ('receipt','adjustment','inventory') THEN quantity
                                     WHEN document_type IN ('sale','write_off','transfer_out') THEN -quantity
                                     ELSE quantity END
                            ), 0) AS total FROM inventory_movements WHERE product_id = $1`,
                            [existingId]
                        );
                        const currentQty = parseFloat(currentStock.rows[0]?.total || 0);
                        const diff = quantity - currentQty;

                        if (Math.abs(diff) > 0.001) {
                            // Без warehouse_id — избегаем FK ошибки (как в sync.js)
                            await pool.query(
                                `INSERT INTO inventory_movements
                                 (product_id, document_type, quantity, organization_id, notes, created_at)
                                 VALUES ($1, 'adjustment', $2, $3, 'Импорт из Excel', NOW())`,
                                [existingId, diff, orgId]
                            );
                            console.log(`[Import V4] Stock adjusted: product_id=${existingId} qty=${currentQty} -> ${quantity} (diff=${diff})`);
                        }
                    }

                    // Помечаем товар как активный если он был деактивирован
                    await pool.query('UPDATE products SET is_active = true, updated_at = NOW() WHERE id = $1', [existingId]);
                    updated++;
                } else {
                    // ── INSERT нового товара ──
                    const finalBarcode = barcode || await getUniqueBarcodeFromPool();
                    if (!code) {
                        code = 'IMP-' + Date.now().toString(36) + '-' + i;
                    }

                    // Проверим нет ли конфликта по code (UNIQUE constraint)
                    try {
                        const codeCheck = await pool.query('SELECT id FROM products WHERE code = $1', [code]);
                        if (codeCheck.rows.length > 0) {
                            code = code + '-' + Date.now().toString(36).slice(-4);
                        }
                    } catch (e) { /* ignore */ }

                    const insertResult = await pool.query(`
                        INSERT INTO products (
                            name, barcode, code, category_id, unit,
                            price, price_sale, price_purchase, price_retail,
                            min_stock, max_stock, vat_rate, description,
                            is_active, organization_id, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, NOW())
                        RETURNING id
                    `, [
                        mapped.name, finalBarcode, code, categoryId, unit,
                        priceMain, priceSale, pricePurchase, priceRetail,
                        minStock, maxStock, vatRate, description,
                        orgId
                    ]);

                    const newProductId = insertResult.rows[0].id;

                    // Добавить начальный остаток — без warehouse_id (избегаем FK ошибки)
                    if (quantity > 0) {
                        await pool.query(
                            `INSERT INTO inventory_movements
                             (product_id, document_type, quantity, organization_id, notes, created_at)
                             VALUES ($1, 'receipt', $2, $3, 'Импорт из Excel', NOW())`,
                            [newProductId, quantity, orgId]
                        );
                        console.log(`[Import V4] Stock receipt: product_id=${newProductId} qty=${quantity}`);
                    }
                    imported++;
                }

                // Прогресс каждые 500 строк
                if ((i + 1) % 500 === 0) {
                    console.log(`[Import V4] Progress: ${i + 1}/${rows.length} (imported=${imported} updated=${updated} errors=${errors.length})`);
                }

            } catch (rowErr) {
                errors.push({ row: i + 2, error: rowErr.message });
                if (errors.length <= 20) {
                    console.error(`[Import V4] Row ${i + 2} ERROR:`, rowErr.message);
                }
            }
        }

        // ═══════════════════════════════════════════
        // ЭТАП 3: Логирование и ответ
        // ═══════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════');
        console.log(`[Import V4] DONE: imported=${imported} updated=${updated} skipped=${skipped} errors=${errors.length} / total=${rows.length}`);
        console.log('═══════════════════════════════════════════════════════');

        try {
            await pool.query(`
                INSERT INTO import_logs (type, filename, total_rows, imported, updated, errors, user_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, ['products_auto', req.file.originalname, rows.length, imported, updated, JSON.stringify(errors.slice(0, 100)), req.user?.id || null]);
        } catch (e) {
            console.error('[Import V4] Failed to write import log:', e.message);
        }

        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

        res.json({
            success: true,
            totalRows: rows.length,
            imported,
            updated,
            skipped,
            errorsCount: errors.length,
            errors: errors.slice(0, 50),
            mapping,
        });

    } catch (error) {
        console.error('[Import V4] FATAL error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Утилита: уникальный штрихкод БЕЗ client (через pool)
async function getUniqueBarcodeFromPool() {
    for (let attempt = 0; attempt < 10; attempt++) {
        const barcode = generateEAN13();
        try {
            const exists = await pool.query('SELECT id FROM products WHERE barcode = $1', [barcode]);
            if (exists.rows.length === 0) return barcode;
        } catch (e) { /* ignore */ }
    }
    return '200' + Date.now().toString().slice(-10);
}

/**
 * GET /api/import/export/:type - Экспорт данных в Excel/CSV/JSON
 */
router.get('/export/:type', authenticate, async (req, res) => {
    try {
        const { type } = req.params;
        const { format = 'xlsx' } = req.query; // xlsx, csv, json

        let rows, headers, sheetName;

        if (type === 'products') {
            const orgId = req.user?.organization_id;
            const prodParams = [];
            let prodFilter = 'WHERE p.is_active = true';
            if (orgId) {
                prodParams.push(orgId);
                prodFilter += ` AND p.organization_id = $${prodParams.length}`;
            }
            const result = await pool.query(`
                SELECT p.name, p.barcode, p.code, 
                       COALESCE(pc.name, '') as category,
                       p.unit, p.price_sale, p.price_purchase, 
                       COALESCE((
                           SELECT SUM(
                               CASE 
                                   WHEN im.document_type IN ('sale', 'write_off', 'return_supplier') THEN -im.quantity
                                   ELSE im.quantity 
                               END
                           ) FROM inventory_movements im WHERE im.product_id = p.id
                       ), 0) as quantity,
                       p.description, p.min_stock
                FROM products p
                LEFT JOIN product_categories pc ON p.category_id = pc.id
                ${prodFilter}
                ORDER BY p.name
            `, prodParams);
            rows = result.rows;
            headers = ['Наименование', 'Штрих-код', 'Артикул', 'Категория', 'Ед. изм.', 'Цена продажи', 'Закупочная цена', 'Остаток', 'Описание', 'Мин. остаток'];
            sheetName = 'Товары';
        } else if (type === 'categories') {
            const result = await pool.query(`
                SELECT name, COALESCE(description, '') as description
                FROM product_categories
                ORDER BY name
            `);
            rows = result.rows;
            headers = ['Название', 'Описание'];
            sheetName = 'Категории';
        } else if (type === 'customers') {
            const result = await pool.query(`
                SELECT name, phone, email, address, inn, notes
                FROM counterparties
                WHERE type = 'customer'
                ORDER BY name
            `);
            rows = result.rows;
            headers = ['Имя / Название', 'Телефон', 'E-mail', 'Адрес', 'ИНН', 'Примечание'];
            sheetName = 'Клиенты';
        } else if (type === 'sales') {
            const result = await pool.query(`
                SELECT s.receipt_number, s.created_at, u.full_name as cashier,
                       s.total_amount, s.discount_amount, s.final_amount,
                       s.payment_method, s.status
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.status != 'draft'
                ORDER BY s.created_at DESC
                LIMIT 10000
            `);
            rows = result.rows;
            headers = ['№ чека', 'Дата', 'Кассир', 'Сумма', 'Скидка', 'Итого', 'Способ оплаты', 'Статус'];
            sheetName = 'Продажи';
        } else {
            return res.status(400).json({ error: `Неизвестный тип: ${type}. Поддерживаются: products, categories, customers, sales` });
        }

        // JSON формат
        if (format === 'json') {
            res.setHeader('Content-Disposition', `attachment; filename="${type}_export.json"`);
            res.setHeader('Content-Type', 'application/json');
            return res.json(rows);
        }

        // Excel / CSV
        const wb = XLSX.utils.book_new();
        const data = [headers, ...rows.map(r => Object.values(r))];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 5, 15) }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send('\uFEFF' + csv); // BOM for Excel
        }

        // Default: xlsx
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('[Export] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
