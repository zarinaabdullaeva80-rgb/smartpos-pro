// Printer service - hardware modules are optional (not available in cloud environments)
import { createRequire } from 'module';
import { generateBarcode } from './barcode.js';

// Hardware availability flags
let SerialPort = null;
let escpos = null;
let hardwareAvailable = false;

// Try to load hardware modules (only works on local machines with printers)
async function loadHardwareModules() {
    if (hardwareAvailable !== false || SerialPort !== null) return;

    try {
        const serialportModule = await import('serialport');
        SerialPort = serialportModule.SerialPort;

        const escposModule = await import('escpos');
        escpos = escposModule.default;

        // Try to load USB adapter
        try {
            const require = createRequire(import.meta.url);
            escpos.USB = require('escpos-usb');
        } catch (e) {
            console.warn('[PRINTER] escpos-usb not available:', e.message);
            escpos.USB = null;
        }

        hardwareAvailable = true;
        console.log('[PRINTER] Hardware modules loaded successfully');
    } catch (error) {
        console.warn('[PRINTER] Hardware modules not available (running in cloud?):', error.message);
        hardwareAvailable = false;
    }
}

// Check if printer hardware is available
function ensureHardware() {
    if (!hardwareAvailable) {
        throw new Error('Печать недоступна: работа в облачном окружении. Модули serialport/escpos не установлены.');
    }
}

/**
 * Сканирование доступных портов (COM-порты и USB)
 * @returns {Promise<Array>} - Список доступных портов
 */
export async function scanPrinterPorts() {
    await loadHardwareModules();
    ensureHardware();

    try {
        const ports = await SerialPort.list();

        const printerPorts = ports.filter(port => {
            const desc = port.manufacturer?.toLowerCase() || '';
            const pnp = port.pnpId?.toLowerCase() || '';

            return desc.includes('prolific') ||
                desc.includes('ftdi') ||
                desc.includes('usb') ||
                pnp.includes('usb') ||
                port.path.toLowerCase().includes('com');
        });

        const formatted = printerPorts.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            serialNumber: port.serialNumber,
            pnpId: port.pnpId,
            type: port.path.includes('COM') ? 'serial' : 'usb'
        }));

        console.log('[PRINTER] Found ports:', formatted);
        return formatted;
    } catch (error) {
        console.error('[PRINTER] Scan error:', error);
        throw new Error(`Ошибка сканирования портов: ${error.message}`);
    }
}

/**
 * Получить список USB принтеров (ESC/POS)
 * @returns {Promise<Array>} - Список USB принтеров
 */
export async function scanUSBPrinters() {
    await loadHardwareModules();

    if (!hardwareAvailable || !escpos?.USB) {
        console.warn('[PRINTER] USB scanning not available in cloud environment');
        return [];
    }

    try {
        const devices = await escpos.USB.findPrinter();

        const printers = devices.map((device, index) => ({
            id: index,
            vendorId: device.deviceDescriptor.idVendor,
            productId: device.deviceDescriptor.idProduct,
            manufacturer: device.deviceDescriptor.iManufacturer,
            product: device.deviceDescriptor.iProduct,
            type: 'usb-escpos'
        }));

        console.log('[PRINTER] Found USB printers:', printers);
        return printers;
    } catch (error) {
        console.error('[PRINTER] USB scan error:', error);
        return [];
    }
}

/**
 * Печать этикетки товара на термопринтере
 */
export async function printProductLabel(product, printerPath, options = {}) {
    await loadHardwareModules();
    ensureHardware();

    // ... full implementation would go here
    throw new Error('Печать этикеток доступна только на локальном сервере с подключенным принтером');
}

/**
 * Печать этикеток для нескольких товаров
 */
export async function printMultipleLabels(products, printerPath, options = {}) {
    await loadHardwareModules();
    ensureHardware();

    throw new Error('Печать этикеток доступна только на локальном сервере с подключенным принтером');
}

/**
 * Тестовая печать для проверки принтера
 */
export async function testPrint(printerPath) {
    await loadHardwareModules();
    ensureHardware();

    throw new Error('Тестовая печать доступна только на локальном сервере с подключенным принтером');
}

/**
 * Печать чека продажи на термопринтере
 */
export async function printReceipt(sale, printerPath) {
    await loadHardwareModules();
    ensureHardware();

    throw new Error('Печать чеков доступна только на локальном сервере с подключенным принтером');
}

/**
 * Проверка доступности печати
 */
export async function isPrintingAvailable() {
    await loadHardwareModules();
    return hardwareAvailable;
}

export default {
    scanPrinterPorts,
    scanUSBPrinters,
    printProductLabel,
    printMultipleLabels,
    testPrint,
    printReceipt,
    isPrintingAvailable
};
