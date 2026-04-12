import bwipjs from 'bwip-js';
import fs from 'fs';
import path from 'path';

/**
 * Генерация штрих-кода
 * @param {string} text - Текст/номер для кодирования
 * @param {string} type - Тип штрих-кода ('ean13', 'code128', 'qrcode')
 * @param {object} options - Дополнительные опции
 * @returns {Promise<Buffer>} - PNG изображение штрих-кода
 */
export async function generateBarcode(text, type = 'code128', options = {}) {
    try {
        const defaultOptions = {
            bcid: type,           // Barcode type
            text: text,           // Text to encode
            scale: 3,             // 3x scaling factor
            height: 10,           // Bar height, in millimeters
            includetext: true,    // Show human-readable text
            textxalign: 'center', // Text alignment
        };

        const barcodeOptions = { ...defaultOptions, ...options };

        // Генерация штрих-кода
        const png = await bwipjs.toBuffer(barcodeOptions);

        return png;
    } catch (error) {
        console.error('[BARCODE] Generation error:', error);
        throw new Error(`Ошибка генерации штрих-кода: ${error.message}`);
    }
}

/**
 * Генерация EAN-13 штрих-кода (для розничной торговли)
 * @param {string} productCode - 12-значный код товара
 * @returns {Promise<Buffer>} - PNG изображение
 */
export async function generateEAN13(productCode) {
    // EAN-13 требует 12 цифр + контрольная сумма (автоматически)
    if (!/^\d{12,13}$/.test(productCode)) {
        throw new Error('EAN-13 требует 12-13 цифр');
    }

    return await generateBarcode(productCode, 'ean13', {
        height: 12,
        textsize: 10
    });
}

/**
 * Генерация Code-128 штрих-кода (универсальный)
 * @param {string} text - Текст для кодирования
 * @returns {Promise<Buffer>} - PNG изображение
 */
export async function generateCode128(text) {
    return await generateBarcode(text, 'code128', {
        height: 15,
        textsize: 12
    });
}

/**
 * Генерация QR-кода
 * @param {string} text - Текст/URL для кодирования
 * @returns {Promise<Buffer>} - PNG изображение
 */
export async function generateQRCode(text) {
    return await generateBarcode(text, 'qrcode', {
        scale: 3,
        eclevel: 'M'  // Error correction level
    });
}

/**
 * Сохранить штрих-код в файл
 * @param {Buffer} barcodeBuffer - Буфер изображения
 * @param {string} filename - Имя файла
 * @param {string} directory - Директория для сохранения
 * @returns {Promise<string>} - Путь к сохранённому файлу
 */
export async function saveBarcodeToFile(barcodeBuffer, filename, directory = 'uploads/barcodes') {
    try {
        // Создать директорию если не существует
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const filepath = path.join(directory, filename);

        await fs.promises.writeFile(filepath, barcodeBuffer);

        return filepath;
    } catch (error) {
        console.error('[BARCODE] Save error:', error);
        throw new Error(`Ошибка сохранения штрих-кода: ${error.message}`);
    }
}

/**
 * Генерация уникального EAN-13 кода для нового товара
 * @param {number} productId - ID товара
 * @param {string} prefix - Префикс (код страны/компании, 3-7 цифр)
 * @returns {string} - 13-значный EAN-13 код
 */
export function generateUniqueEAN13(productId, prefix = '460') {
    // 460 - код для России
    // Формат: [prefix][productId дополненный нулями][контрольная сумма]

    const prefixLength = prefix.length;
    const productIdStr = String(productId).padStart(12 - prefixLength - 1, '0');
    const codeWithoutChecksum = prefix + productIdStr;

    // Вычислить контрольную сумму EAN-13
    const checksum = calculateEAN13Checksum(codeWithoutChecksum);

    return codeWithoutChecksum + checksum;
}

/**
 * Вычисление контрольной суммы EAN-13
 * @param {string} code - 12-значный код без контрольной суммы
 * @returns {string} - Контрольная цифра
 */
function calculateEAN13Checksum(code) {
    const digits = code.split('').map(Number);

    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        // Нечётные позиции умножаем на 1, чётные на 3 (с конца)
        const weight = (i % 2 === 0) ? 1 : 3;
        sum += digits[i] * weight;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return String(checksum);
}

/**
 * Валидация EAN-13 кода
 * @param {string} ean13 - EAN-13 код для проверки
 * @returns {boolean} - true если код валиден
 */
export function validateEAN13(ean13) {
    if (!/^\d{13}$/.test(ean13)) {
        return false;
    }

    const codeWithoutChecksum = ean13.slice(0, 12);
    const providedChecksum = ean13[12];
    const calculatedChecksum = calculateEAN13Checksum(codeWithoutChecksum);

    return providedChecksum === calculatedChecksum;
}

/**
 * Генерация этикетки товара (штрих-код + информация)
 * @param {object} product - Данные товара
 * @param {string} barcodeType - Тип штрих-кода
 * @returns {Promise<object>} - Данные для печати
 */
export async function generateProductLabel(product, barcodeType = 'ean13') {
    try {
        let barcode;
        const barcodeText = product.barcode || generateUniqueEAN13(product.id);

        if (barcodeType === 'ean13') {
            barcode = await generateEAN13(barcodeText);
        } else if (barcodeType === 'code128') {
            barcode = await generateCode128(barcodeText);
        } else if (barcodeType === 'qrcode') {
            barcode = await generateQRCode(barcodeText);
        } else {
            throw new Error(`Неизвестный тип штрих-кода: ${barcodeType}`);
        }

        return {
            barcode: barcode.toString('base64'),
            barcodeText: barcodeText,
            productName: product.name,
            productPrice: product.price,
            productId: product.id
        };
    } catch (error) {
        console.error('[BARCODE] Label generation error:', error);
        throw error;
    }
}

export default {
    generateBarcode,
    generateEAN13,
    generateCode128,
    generateQRCode,
    saveBarcodeToFile,
    generateUniqueEAN13,
    validateEAN13,
    generateProductLabel
};
