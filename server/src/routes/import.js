import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
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
        // русский → поле в БД
        'наименование': 'name', 'название': 'name', 'товар': 'name', 'name': 'name', 'product': 'name',
        'наименование товара': 'name', 'название товара': 'name', 'продукт': 'name', 'product name': 'name',
        'имя': 'name', 'имя товара': 'name', 'номенклатура': 'name',
        'штрих-код': 'barcode', 'штрихкод': 'barcode', 'barcode': 'barcode', 'ean': 'barcode',
        'штрих код': 'barcode', 'bar code': 'barcode', 'ean13': 'barcode', 'ean-13': 'barcode',
        'код товара': 'code', 'код': 'code', 'артикул': 'code', 'sku': 'code', 'article': 'code',
        'арт': 'code', 'арт.': 'code', 'product code': 'code', 'item code': 'code', 'внутренний код': 'code',
        'категория': 'category', 'группа': 'category', 'category': 'category', 'group': 'category',
        'группа товара': 'category', 'раздел': 'category', 'подгруппа': 'category',
        'единица': 'unit', 'ед. изм.': 'unit', 'ед.изм': 'unit', 'ед.изм.': 'unit', 'unit': 'unit', 'uom': 'unit',
        'единица измерения': 'unit', 'ед': 'unit', 'изм': 'unit', 'мера': 'unit',
        'цена': 'price_sale', 'цена продажи': 'price_sale', 'розничная цена': 'price_sale', 'price': 'price_sale', 'retail price': 'price_sale',
        'цена розница': 'price_sale', 'розница': 'price_sale', 'продажная цена': 'price_sale', 'цена реализации': 'price_sale',
        'sale price': 'price_sale', 'selling price': 'price_sale', 'retail': 'price_sale',
        // Формат «Товары ИКПУ» (экспорт из учётных систем Узбекистана)
        'цена продажи (вкл ндс)': 'price_sale', 'цена продажи (вкл. ндс)': 'price_sale',
        'цена продажи (включая ндс)': 'price_sale', 'цена с ндс': 'price_sale',
        'цена закупа': 'price_purchase', 'цена закупки': 'price_purchase',
        'себестоимость': 'price_purchase', 'закупочная цена': 'price_purchase', 'cost': 'price_purchase',
        'закупка': 'price_purchase', 'входная цена': 'price_purchase',
        'cost price': 'price_purchase', 'buy price': 'price_purchase',
        'остаток': 'quantity', 'количество': 'quantity', 'кол-во': 'quantity', 'qty': 'quantity', 'quantity': 'quantity', 'stock': 'quantity',
        'кол': 'quantity', 'запас': 'quantity', 'наличие': 'quantity', 'остатки': 'quantity', 'in stock': 'quantity',
        'описание': 'description', 'description': 'description', 'примечание': 'description', 'комментарий': 'description',
        'мнн': 'description',  // МНН (международное непатентованное наименование) → описание
        'мин. остаток': 'min_stock', 'минимальный остаток': 'min_stock', 'min stock': 'min_stock', 'мин остаток': 'min_stock',
        'минимальное остаток': 'min_stock',
        // ИКПУ — специфичное поле Узбекистана, сохраняем отдельно (не маппим в code чтобы не нарушать NOT NULL)
        // 'икпу': 'code', — отключено, т.к. ИКПУ бывает пустым
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
 */
function autoMapColumns(fileHeaders, type) {
    const mappingDict = COLUMN_MAPPINGS[type] || {};
    const result = {};

    for (const header of fileHeaders) {
        const normalized = header.toLowerCase().trim();
        if (mappingDict[normalized]) {
            result[header] = mappingDict[normalized];
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
                            const newCat = await client.query(
                                'INSERT INTO product_categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                                [catName]
                            );
                            categoryId = newCat.rows[0].id;
                            categoryMap[catKey] = categoryId;
                        }
                    }

                    // Проверка дубликата по штрих-коду
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

                    if (existingProduct) {
                        // Обновить существующий товар
                        await client.query(`
                            UPDATE products SET
                                name = COALESCE($1, name),
                                code = COALESCE($2, code),
                                category_id = COALESCE($3, category_id),
                                unit = COALESCE($4, unit),
                                price_sale = COALESCE($5, price_sale),
                                price_purchase = COALESCE($6, price_purchase),
                                description = COALESCE($7, description),
                                min_stock = COALESCE($8, min_stock),
                                updated_at = NOW()
                            WHERE id = $9
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
                        updated++;
                    } else {
                        // Вставить новый товар
                        await client.query(`
                            INSERT INTO products (name, barcode, code, category_id, unit, price_sale, price_purchase, description, min_stock, is_active, organization_id, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW())
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
                        imported++;
                    }
                } catch (rowErr) {
                    errors.push({ row: i + 2, error: rowErr.message });
                }
            }
        } else if (type === 'categories') {
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
                        errors.push({ row: i + 2, error: 'Название категории обязательно' });
                        continue;
                    }

                    const result = await client.query(
                        `INSERT INTO product_categories (name, description) 
                         VALUES ($1, $2) 
                         ON CONFLICT (name) DO UPDATE SET description = COALESCE(EXCLUDED.description, product_categories.description)
                         RETURNING (xmax = 0) as is_new`,
                        [mapped.name, mapped.description || '']
                    );
                    if (result.rows[0].is_new) imported++; else updated++;
                } catch (rowErr) {
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
 * Поддерживает формат экспорта из учётных систем Узбекистана (ИКПУ формат)
 */
router.post('/products/auto', authenticate, upload.single('file'), async (req, res) => {
    const client = await pool.connect();
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

        const orgId = req.user?.organization_id;
        const rows = parseFile(req.file.path, req.file.originalname);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Файл пуст или не удалось распознать данные' });
        }

        const fileHeaders = Object.keys(rows[0]);
        const mapping = autoMapColumns(fileHeaders, 'products');

        if (!mapping || Object.keys(mapping).length === 0) {
            return res.status(400).json({
                error: 'Не удалось автоматически определить колонки. Используйте /api/import/preview для ручного маппинга.',
                fileHeaders
            });
        }

        let imported = 0, updated = 0;
        const errors = [];

        // Кэш категорий
        const catResult = await client.query(
            'SELECT id, name FROM product_categories WHERE organization_id = $1 OR organization_id IS NULL',
            [orgId]
        );
        const categoryMap = {};
        catResult.rows.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });

        // Получаем основной склад
        const warehouseRes = await client.query('SELECT id FROM warehouses WHERE organization_id = $1 LIMIT 1', [orgId]);
        const warehouseId = warehouseRes.rows[0]?.id || 1;

        await client.query('BEGIN');

        for (let i = 0; i < rows.length; i++) {
            try {
                await client.query(`SAVEPOINT row_${i}`);
                const row = rows[i];
                const mapped = {};
                for (const [fileCol, dbField] of Object.entries(mapping)) {
                    const val = row[fileCol];
                    if (val !== undefined && val !== '') mapped[dbField] = val;
                }

                if (!mapped.name) continue; // пропускаем пустые строки

                // Категория
                let categoryId = null;
                if (mapped.category) {
                    const catName = String(mapped.category).trim();
                    const catKey = catName.toLowerCase();
                    if (categoryMap[catKey]) {
                        categoryId = categoryMap[catKey];
                    } else {
                        const newCat = await client.query(
                            'INSERT INTO product_categories (name, organization_id) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                            [catName, orgId || null]
                        );
                        categoryId = newCat.rows[0].id;
                        categoryMap[catKey] = categoryId;
                    }
                }

                // Штрихкод
                const barcode = mapped.barcode ? String(mapped.barcode).trim() : null;

                // Дубликат по штрихкоду
                let existingId = null;
                if (barcode) {
                    const dup = await client.query(
                        'SELECT id FROM products WHERE barcode = $1 AND (organization_id = $2 OR organization_id IS NULL)',
                        [barcode, orgId]
                    );
                    if (dup.rows.length > 0) existingId = dup.rows[0].id;
                }

                const priceSale = mapped.price_sale ? parseFloat(String(mapped.price_sale).replace(',', '.')) : 0;
                const pricePurchase = mapped.price_purchase ? parseFloat(String(mapped.price_purchase).replace(',', '.')) : 0;
                const quantity = mapped.quantity ? parseFloat(String(mapped.quantity).replace(',', '.')) : 0;
                const minStock = mapped.min_stock ? parseInt(mapped.min_stock) : 0;
                const unit = mapped.unit ? String(mapped.unit).trim() : 'шт';
                // code — fallback: ИКПУ → штрихкод → сгенерированный
                const code = mapped.code
                    ? String(mapped.code).trim()
                    : (barcode || `IMP-${i + 1}`);

                if (existingId) {
                    await client.query(`
                        UPDATE products SET
                            name = $1, category_id = COALESCE($2, category_id),
                            unit = COALESCE($3, unit), price_sale = $4,
                            price_purchase = $5, code = COALESCE($6, code),
                            min_stock = $7, updated_at = NOW()
                        WHERE id = $8
                    `, [mapped.name, categoryId, unit, priceSale, pricePurchase, code, minStock, existingId]);

                    // Обновить остаток если указан
                    if (quantity > 0) {
                        await client.query(`
                            INSERT INTO stock_balances (product_id, warehouse_id, quantity, available_quantity, organization_id)
                            VALUES ($1, $2, $3, $3, $4)
                            ON CONFLICT (product_id, warehouse_id) DO UPDATE
                            SET quantity = $3, available_quantity = $3, updated_at = NOW()
                        `, [existingId, warehouseId, quantity, orgId]).catch(() => {});
                    }
                    await client.query(`RELEASE SAVEPOINT row_${i}`);
                    updated++;
                } else {
                    const finalBarcode = barcode || await getUniqueBarcode(client);
                    const insertResult = await client.query(`
                        INSERT INTO products (
                            name, barcode, code, category_id, unit,
                            price_sale, price_purchase, min_stock,
                            is_active, organization_id, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW())
                        RETURNING id
                    `, [mapped.name, finalBarcode, code, categoryId, unit, priceSale, pricePurchase, minStock, orgId || null]);

                    const newProductId = insertResult.rows[0].id;

                    // Добавить начальный остаток
                    if (quantity > 0) {
                        await client.query(`
                            INSERT INTO stock_balances (product_id, warehouse_id, quantity, available_quantity, organization_id)
                            VALUES ($1, $2, $3, $3, $4)
                            ON CONFLICT (product_id, warehouse_id) DO UPDATE
                            SET quantity = $3, available_quantity = $3
                        `, [newProductId, warehouseId, quantity, orgId]).catch(() => {});
                    }
                    await client.query(`RELEASE SAVEPOINT row_${i}`);
                    imported++;
                }
            } catch (rowErr) {
                // Откатываем только эту строку — транзакция остаётся активной
                await client.query(`ROLLBACK TO SAVEPOINT row_${i}`).catch(() => {});
                errors.push({ row: i + 2, error: rowErr.message });
            }
        }

        await client.query('COMMIT');

        // Лог
        try {
            await pool.query(`
                INSERT INTO import_logs (type, filename, total_rows, imported, updated, errors, user_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, ['products_auto', req.file.originalname, rows.length, imported, updated, JSON.stringify(errors.slice(0, 100)), req.user?.id || null]);
        } catch (e) { /* ignore log error */ }

        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

        res.json({
            success: true,
            totalRows: rows.length,
            imported,
            updated,
            errorsCount: errors.length,
            errors: errors.slice(0, 20),
            mapping, // показываем какой маппинг был определён
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[Import Auto] Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

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
