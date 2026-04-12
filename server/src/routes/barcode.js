import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import {
    generateEAN13,
    generateCode128,
    generateQRCode,
    generateUniqueEAN13,
    validateEAN13,
    saveBarcodeToFile,
    generateProductLabel
} from '../services/barcode.js';
import {
    exportProductsToExcel,
    importProductsFromExcel,
    exportProductTemplate
} from '../services/excel.js';
import {
    scanPrinterPorts,
    scanUSBPrinters,
    printProductLabel,
    printMultipleLabels,
    testPrint
} from '../services/printer.js';

const router = express.Router();

// Настройка multer для загрузки файлов
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Только Excel файлы разрешены'));
        }
    }
});

// ============================================================================
// ШТРИХ-КОДЫ
// ============================================================================

// Генерация штрих-кода для товара
router.post('/barcode/generate', authenticate, checkPermission('products.update'), async (req, res) => {
    try {
        const { productId, type = 'ean13' } = req.body;

        // Получить товар
        const productResult = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = productResult.rows[0];

        // Генерировать штрих-код если его нет
        let barcodeText = product.barcode;
        if (!barcodeText) {
            barcodeText = generateUniqueEAN13(productId);

            // Обновить товар
            await pool.query(
                'UPDATE products SET barcode = $1 WHERE id = $2',
                [barcodeText, productId]
            );
        }

        // Генерировать изображение
        let barcodeImage;
        if (type === 'ean13') {
            barcodeImage = await generateEAN13(barcodeText);
        } else if (type === 'code128') {
            barcodeImage = await generateCode128(barcodeText);
        } else if (type === 'qrcode') {
            barcodeImage = await generateQRCode(barcodeText);
        } else {
            return res.status(400).json({ error: 'Неизвестный тип штрих-кода' });
        }

        // Сохранить файл
        const filename = `barcode_${productId}_${Date.now()}.png`;
        const filepath = await saveBarcodeToFile(barcodeImage, filename);

        res.json({
            success: true,
            barcode: barcodeText,
            type: type,
            imageUrl: `/uploads/barcodes/${filename}`,
            imagePath: filepath
        });
    } catch (error) {
        console.error('Barcode generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Генерация этикетки товара
router.get('/barcode/label/:productId', authenticate, async (req, res) => {
    try {
        const { productId } = req.params;
        const { type = 'ean13' } = req.query;

        const productResult = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = productResult.rows[0];
        const label = await generateProductLabel(product, type);

        res.json(label);
    } catch (error) {
        console.error('Label generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Валидация штрих-кода
router.post('/barcode/validate', authenticate, async (req, res) => {
    try {
        const { barcode, type = 'ean13' } = req.body;

        let isValid = false;
        let message = '';

        if (type === 'ean13') {
            isValid = validateEAN13(barcode);
            message = isValid ? 'EAN-13 код валиден' : 'EAN-13 код невалиден';
        } else {
            message = 'Валидация доступна только для EAN-13';
        }

        res.json({
            barcode,
            type,
            isValid,
            message
        });
    } catch (error) {
        console.error('Barcode validation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// EXCEL ИМПОРТ/ЭКСПОРТ
// ============================================================================

// Экспорт товаров в Excel
router.get('/excel/export', authenticate, checkPermission('products.read'), async (req, res) => {
    try {
        const { categoryId, isActive } = req.query;

        const filters = {};
        if (categoryId) filters.categoryId = categoryId;
        if (isActive !== undefined) filters.isActive = isActive === 'true';

        const buffer = await exportProductsToExcel(filters);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=products_${Date.now()}.xlsx`);
        res.send(buffer);
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Экспорт шаблона для импорта
router.get('/excel/template', authenticate, async (req, res) => {
    try {
        const buffer = await exportProductTemplate();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Импорт товаров из Excel
router.post('/excel/import', authenticate, checkPermission('products.create'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const results = await importProductsFromExcel(req.file.buffer, req.user.id);

        res.json({
            success: true,
            message: 'Импорт завершён',
            results: results
        });
    } catch (error) {
        console.error('Excel import error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ПЕЧАТЬ ЭТИКЕТОК
// ============================================================================

// Сканирование доступных принтеров
router.get('/printer/scan', authenticate, async (req, res) => {
    try {
        const serialPorts = await scanPrinterPorts();
        const usbPrinters = await scanUSBPrinters();

        res.json({
            serialPorts,
            usbPrinters,
            total: serialPorts.length + usbPrinters.length
        });
    } catch (error) {
        console.error('Printer scan error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Тестовая печать
router.post('/printer/test', authenticate, async (req, res) => {
    try {
        const { printerPath } = req.body;

        if (!printerPath) {
            return res.status(400).json({ error: 'Не указан путь к принтеру' });
        }

        await testPrint(printerPath);

        res.json({
            success: true,
            message: 'Тестовая печать выполнена успешно'
        });
    } catch (error) {
        console.error('Test print error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Печать этикетки товара
router.post('/printer/print-label', authenticate, checkPermission('products.read'), async (req, res) => {
    try {
        const { productId, printerPath, copies = 1, barcodeType = 'ean13' } = req.body;

        if (!printerPath) {
            return res.status(400).json({ error: 'Не указан путь к принтеру' });
        }

        // Получить товар
        const productResult = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = productResult.rows[0];

        await printProductLabel(product, printerPath, {
            copies,
            barcodeType
        });

        res.json({
            success: true,
            message: `Напечатано ${copies} этикеток для товара: ${product.name}`
        });
    } catch (error) {
        console.error('Label print error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Печать этикеток для нескольких товаров
router.post('/printer/print-multiple', authenticate, checkPermission('products.read'), async (req, res) => {
    try {
        const { productIds, printerPath, copies = 1, barcodeType = 'ean13' } = req.body;

        if (!printerPath) {
            return res.status(400).json({ error: 'Не указан путь к принтеру' });
        }

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: 'Не указаны товары для печати' });
        }

        // Получить товары
        const productsResult = await pool.query(
            'SELECT * FROM products WHERE id = ANY($1::int[])',
            [productIds]
        );

        const results = await printMultipleLabels(productsResult.rows, printerPath, {
            copies,
            barcodeType
        });

        res.json({
            success: true,
            message: 'Печать завершена',
            results
        });
    } catch (error) {
        console.error('Multiple labels print error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
