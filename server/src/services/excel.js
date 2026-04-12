import ExcelJS from 'exceljs';
import pool from '../config/database.js';

/**
 * Экспорт товаров в Excel
 * @param {object} filters - Фильтры для выборки товаров
 * @returns {Promise<Buffer>} - Excel файл
 */
export async function exportProductsToExcel(filters = {}) {
    try {
        // Получить товары из БД
        let query = `
            SELECT 
                p.id,
                p.name,
                p.barcode,
                p.code,
                p.price_sale,
                p.price_purchase,
                COALESCE(SUM(im.quantity), 0) as stock_quantity,
                p.unit,
                p.vat_rate,
                p.description,
                pc.name as category_name,
                p.is_active,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN inventory_movements im ON p.id = im.product_id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (filters.categoryId) {
            query += ` AND p.category_id = $${paramIndex++}`;
            params.push(filters.categoryId);
        }

        if (filters.isActive !== undefined) {
            query += ` AND p.is_active = $${paramIndex++}`;
            params.push(filters.isActive);
        }

        query += ' GROUP BY p.id, pc.name ORDER BY p.id';

        const result = await pool.query(query, params);
        const products = result.rows;

        // Создать Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Товары');

        // Определить колонки
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Наименование', key: 'name', width: 40 },
            { header: 'Штрих-код', key: 'barcode', width: 15 },
            { header: 'Код', key: 'code', width: 15 },
            { header: 'Категория', key: 'category_name', width: 20 },
            { header: 'Цена продажи', key: 'price_sale', width: 15 },
            { header: 'Цена закупки', key: 'price_purchase', width: 15 },
            { header: 'Остаток', key: 'stock_quantity', width: 12 },
            { header: 'Единица', key: 'unit', width: 10 },
            { header: 'НДС %', key: 'vat_rate', width: 10 },
            { header: 'Описание', key: 'description', width: 30 },
            { header: 'Активен', key: 'is_active', width: 10 },
        ];

        // Стилизация заголовка
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Добавить данные
        products.forEach(product => {
            worksheet.addRow({
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                code: product.code,
                category_name: product.category_name,
                price_sale: parseFloat(product.price_sale),
                price_purchase: parseFloat(product.price_purchase),
                stock_quantity: parseFloat(product.stock_quantity),
                unit: product.unit,
                vat_rate: product.vat_rate,
                description: product.description,
                is_active: product.is_active ? 'Да' : 'Нет'
            });
        });

        // Форматирование числовых колонок
        worksheet.getColumn('price_sale').numFmt = '#,##0.00 ₽';
        worksheet.getColumn('price_purchase').numFmt = '#,##0.00 ₽';

        // Добавить автофильтр
        worksheet.autoFilter = {
            from: 'A1',
            to: 'L1'
        };

        // Сгенерировать буфер
        const buffer = await workbook.xlsx.writeBuffer();

        return buffer;
    } catch (error) {
        console.error('[EXCEL] Export error:', error);
        throw new Error(`Ошибка экспорта в Excel: ${error.message}`);
    }
}

/**
 * Импорт товаров из Excel
 * @param {Buffer} fileBuffer - Буфер Excel файла
 * @param {number} userId - ID пользователя для логирования
 * @returns {Promise<object>} - Результаты импорта
 */
export async function importProductsFromExcel(fileBuffer, userId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);

        const worksheet = workbook.getWorksheet('Товары') || workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('Лист "Товары" не найден в файле');
        }

        const results = {
            total: 0,
            created: 0,
            updated: 0,
            errors: []
        };

        // Пропустить строку заголовка
        const rows = worksheet.getRows(2, worksheet.rowCount - 1);

        for (const row of rows) {
            if (!row.values || row.values.length < 2) continue;

            results.total++;

            try {
                const productData = {
                    id: row.getCell(1).value,
                    name: row.getCell(2).value,
                    barcode: row.getCell(3).value,
                    sku: row.getCell(4).value,
                    categoryName: row.getCell(5).value,
                    price: parseFloat(row.getCell(6).value) || 0,
                    purchasePrice: parseFloat(row.getCell(7).value) || 0,
                    quantity: parseInt(row.getCell(8).value) || 0,
                    unit: row.getCell(9).value || 'шт',
                    vatRate: parseFloat(row.getCell(10).value) || 20,
                    description: row.getCell(11).value,
                    isActive: row.getCell(12).value === 'Да'
                };

                // Валидация обязательных полей
                if (!productData.name) {
                    results.errors.push({
                        row: row.number,
                        error: 'Отсутствует наименование товара'
                    });
                    continue;
                }

                // Найти category_id по названию категории
                let categoryId = null;
                if (productData.categoryName) {
                    const catResult = await client.query(
                        'SELECT id FROM product_categories WHERE name = $1 LIMIT 1',
                        [productData.categoryName]
                    );
                    categoryId = catResult.rows[0]?.id || null;
                }

                // Проверить существует ли товар
                if (productData.id) {
                    const existingProduct = await client.query(
                        'SELECT id FROM products WHERE id = $1',
                        [productData.id]
                    );

                    if (existingProduct.rows.length > 0) {
                        // Обновить существующий товар
                        await client.query(`
                            UPDATE products 
                            SET name = $1, barcode = $2, code = $3, category_id = $4,
                                price_sale = $5, price_purchase = $6, unit = $7,
                                vat_rate = $8, description = $9, is_active = $10,
                                updated_at = NOW()
                            WHERE id = $11
                        `, [
                            productData.name,
                            productData.barcode,
                            productData.sku,
                            categoryId,
                            productData.price,
                            productData.purchasePrice,
                            productData.unit,
                            productData.vatRate,
                            productData.description,
                            productData.isActive,
                            productData.id
                        ]);

                        results.updated++;
                    } else {
                        // Создать новый товар с указанным ID
                        await client.query(`
                            INSERT INTO products (
                                id, name, barcode, code, category_id, price_sale, price_purchase,
                                unit, vat_rate, description, is_active
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        `, [
                            productData.id,
                            productData.name,
                            productData.barcode,
                            productData.sku,
                            categoryId,
                            productData.price,
                            productData.purchasePrice,
                            productData.unit,
                            productData.vatRate,
                            productData.description,
                            productData.isActive
                        ]);

                        results.created++;
                    }
                } else {
                    // Создать новый товар без ID
                    await client.query(`
                        INSERT INTO products (
                            name, barcode, code, category_id, price_sale, price_purchase,
                            unit, vat_rate, description, is_active
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        productData.name,
                        productData.barcode,
                        productData.sku,
                        categoryId,
                        productData.price,
                        productData.purchasePrice,
                        productData.unit,
                        productData.vatRate,
                        productData.description,
                        productData.isActive
                    ]);

                    results.created++;
                }
            } catch (rowError) {
                results.errors.push({
                    row: row.number,
                    error: rowError.message
                });
            }
        }

        await client.query('COMMIT');

        console.log('[EXCEL] Import completed:', results);

        return results;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[EXCEL] Import error:', error);
        throw new Error(`Ошибка импорта из Excel: ${error.message}`);
    } finally {
        client.release();
    }
}

/**
 * Экспорт шаблона для импорта товаров
 * @returns {Promise<Buffer>} - Excel файл шаблона
 */
export async function exportProductTemplate() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Товары');

        // Определить колонки
        worksheet.columns = [
            { header: 'ID (оставить пустым для нового)', key: 'id', width: 25 },
            { header: 'Наименование *', key: 'name', width: 40 },
            { header: 'Штрих-код', key: 'barcode', width: 15 },
            { header: 'Артикул', key: 'sku', width: 15 },
            { header: 'Категория', key: 'category', width: 20 },
            { header: 'Цена продажи *', key: 'price', width: 15 },
            { header: 'Цена закупки', key: 'purchase_price', width: 15 },
            { header: 'Количество', key: 'quantity', width: 12 },
            { header: 'Единица', key: 'unit', width: 10 },
            { header: 'НДС %', key: 'vat_rate', width: 10 },
            { header: 'Описание', key: 'description', width: 30 },
            { header: 'Активен (Да/Нет)', key: 'is_active', width: 15 },
        ];

        // Стилизация заголовка
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Добавить примеры данных
        worksheet.addRow({
            id: '',
            name: 'Пример товара',
            barcode: '4601234567890',
            sku: 'SKU-001',
            category: 'Электроника',
            price: 1500.00,
            purchase_price: 1000.00,
            quantity: 10,
            unit: 'шт',
            vat_rate: 20,
            description: 'Описание товара',
            is_active: 'Да'
        });

        // Добавить инструкции
        const instructionsSheet = workbook.addWorksheet('Инструкция');
        instructionsSheet.columns = [
            { width: 80 }
        ];

        instructionsSheet.addRow(['ИНСТРУКЦИЯ ПО ИМПОРТУ ТОВАРОВ']);
        instructionsSheet.addRow(['']);
        instructionsSheet.addRow(['1. Заполните данные товаров на листе "Товары"']);
        instructionsSheet.addRow(['2. Поля отмеченные * обязательны для заполнения']);
        instructionsSheet.addRow(['3. ID: оставьте пустым для создания нового товара, укажите для обновления существующего']);
        instructionsSheet.addRow(['4. Категория: укажите точное название существующей категории']);
        instructionsSheet.addRow(['5. Активен: используйте "Да" или "Нет"']);
        instructionsSheet.addRow(['6. Сохраните файл и загрузите через интерфейс системы']);

        instructionsSheet.getRow(1).font = { bold: true, size: 14 };

        const buffer = await workbook.xlsx.writeBuffer();

        return buffer;
    } catch (error) {
        console.error('[EXCEL] Template export error:', error);
        throw new Error(`Ошибка создания шаблона: ${error.message}`);
    }
}

export default {
    exportProductsToExcel,
    importProductsFromExcel,
    exportProductTemplate
};
