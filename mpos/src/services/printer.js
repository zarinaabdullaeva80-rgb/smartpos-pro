import { Platform } from 'react-native';
import SettingsService from './settings';

// Dynamic imports for native-only modules
let Print = null;
let Sharing = null;
if (Platform.OS !== 'web') {
    Print = require('expo-print');
    Sharing = require('expo-sharing');
}

/**
 * Сервис печати чеков
 * Использует expo-print для печати через системный диалог
 */
class PrinterService {
    static isConnected = true; // Всегда доступен через expo-print
    static printerType = 'system';
    static printerAddress = '';

    /**
     * Инициализация принтера с настройками
     */
    static async initialize() {
        const settings = await SettingsService.getPrinterSettings();
        this.printerType = settings.type || 'system';
        this.printerAddress = settings.ip || '';
        console.log('[Printer] Initialized:', settings);
    }

    /**
     * Подключиться к принтеру (expo-print всегда доступен)
     */
    static async connect() {
        this.isConnected = true;
        return true;
    }

    /**
     * Отключиться от принтера
     */
    static async disconnect() {
        this.isConnected = false;
        console.log('[Printer] Disconnected');
    }

    /**
     * Напечатать чек продажи
     */
    static async printReceipt(sale, items, shopInfo = {}) {
        try {
            const html = this.formatReceiptHTML(sale, items, shopInfo);
            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                win.document.write(html);
                win.document.close();
                win.print();
            } else {
                await Print.printAsync({ html });
            }
            return { success: true, message: 'Чек напечатан' };
        } catch (error) {
            console.error('[Printer] Print error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Сохранить чек как PDF
     */
    static async saveReceiptAsPDF(sale, items, shopInfo = {}) {
        try {
            const html = this.formatReceiptHTML(sale, items, shopInfo);
            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                win.document.write(html);
                win.document.close();
                win.print();
                return { success: true, message: 'PDF диалог открыт' };
            }
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
            return { success: true, uri, message: 'PDF создан' };
        } catch (error) {
            console.error('[Printer] PDF error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Форматировать чек в HTML для красивой печати
     */
    static formatReceiptHTML(sale, items, shopInfo) {
        const date = new Date().toLocaleString('ru-RU');
        const itemsHtml = items.map((item, index) => `
            <tr>
                <td>${index + 1}. ${item.name}</td>
                <td style="text-align: right;">${item.quantity} x ${this.formatMoney(item.price)}</td>
                <td style="text-align: right; font-weight: bold;">${this.formatMoney(item.price * item.quantity)}</td>
            </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    width: 80mm;
                    margin: 0 auto;
                    padding: 10px;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 10px;
                }
                .shop-name {
                    font-size: 18px;
                    font-weight: bold;
                }
                .receipt-info {
                    margin: 10px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                td {
                    padding: 4px 0;
                    border-bottom: 1px dotted #ccc;
                }
                .totals {
                    border-top: 2px dashed #000;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                .final-total {
                    font-size: 16px;
                    font-weight: bold;
                }
                .footer {
                    text-align: center;
                    border-top: 2px dashed #000;
                    margin-top: 15px;
                    padding-top: 10px;
                }
                .thank-you {
                    font-size: 14px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="shop-name">${shopInfo.name || '1С МАГАЗИН'}</div>
                <div>${shopInfo.address || ''}</div>
                <div>${shopInfo.phone || ''}</div>
            </div>

            <div class="receipt-info">
                <strong>Чек #${sale.documentNumber || sale.id}</strong><br>
                Дата: ${date}<br>
                Кассир: ${sale.cashier_name || 'Администратор'}
            </div>

            <table>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="totals">
                ${sale.discount_amount > 0 ? `
                    <div class="total-row">
                        <span>Подытог:</span>
                        <span>${this.formatMoney(sale.total_amount)}</span>
                    </div>
                    <div class="total-row">
                        <span>Скидка:</span>
                        <span style="color: red;">-${this.formatMoney(sale.discount_amount)}</span>
                    </div>
                ` : ''}
                <div class="total-row final-total">
                    <span>ИТОГО:</span>
                    <span>${this.formatMoney(sale.final_amount)}</span>
                </div>
                <div class="total-row">
                    <span>Оплата:</span>
                    <span>${sale.payment_type === 'cash' ? 'Наличные' : 'Карта'}</span>
                </div>
            </div>

            <div class="footer">
                <div class="thank-you">СПАСИБО ЗА ПОКУПКУ!</div>
                <div>Ждём вас снова!</div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Напечатать Z-отчёт
     */
    static async printZReport(shiftData) {
        try {
            const html = this.formatZReportHTML(shiftData);
            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                win.document.write(html);
                win.document.close();
                win.print();
            } else {
                await Print.printAsync({ html });
            }
            return { success: true, message: 'Z-отчёт напечатан' };
        } catch (error) {
            console.error('[Printer] Z-Report error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Форматировать Z-отчёт в HTML
     */
    static formatZReportHTML(shiftData) {
        const openedAt = shiftData.started_at ? new Date(shiftData.started_at).toLocaleString('ru-RU') : 'N/A';
        const closedAt = new Date().toLocaleString('ru-RU');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    width: 80mm;
                    margin: 0 auto;
                    padding: 10px;
                }
                .header {
                    text-align: center;
                    border-bottom: 3px double #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .title {
                    font-size: 20px;
                    font-weight: bold;
                }
                .subtitle {
                    font-size: 14px;
                }
                .section {
                    margin: 15px 0;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                .row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                .row-label {
                    font-weight: normal;
                }
                .row-value {
                    font-weight: bold;
                }
                .highlight {
                    background-color: #f0f0f0;
                    padding: 5px;
                    font-size: 14px;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">Z-ОТЧЁТ</div>
                <div class="subtitle">ЗАКРЫТИЕ СМЕНЫ</div>
            </div>

            <div class="section">
                <div class="row">
                    <span class="row-label">Смена #:</span>
                    <span class="row-value">${shiftData.id || 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="row-label">Открытие:</span>
                    <span class="row-value">${openedAt}</span>
                </div>
                <div class="row">
                    <span class="row-label">Закрытие:</span>
                    <span class="row-value">${closedAt}</span>
                </div>
            </div>

            <div class="section">
                <div class="row highlight">
                    <span class="row-label">📊 ПРОДАЖИ:</span>
                    <span class="row-value">${shiftData.sales_count || 0} шт.</span>
                </div>
                <div class="row highlight">
                    <span class="row-label">💰 ВЫРУЧКА:</span>
                    <span class="row-value">${this.formatMoney(shiftData.sales_total || shiftData.total_sales || 0)}</span>
                </div>
            </div>

            <div class="section">
                <div class="row">
                    <span class="row-label">Возвратов:</span>
                    <span class="row-value">${shiftData.returns_count || 0} шт.</span>
                </div>
                <div class="row">
                    <span class="row-label">Сумма возвратов:</span>
                    <span class="row-value">${this.formatMoney(shiftData.returns_total || 0)}</span>
                </div>
            </div>

            <div class="section">
                <div class="row">
                    <span class="row-label">Наличные:</span>
                    <span class="row-value">${this.formatMoney(shiftData.cash_total || 0)}</span>
                </div>
                <div class="row">
                    <span class="row-label">Безналичные:</span>
                    <span class="row-value">${this.formatMoney(shiftData.card_total || 0)}</span>
                </div>
            </div>

            <div class="footer">
                <strong>Кассир: ${shiftData.user_name || 'Администратор'}</strong>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Отправить текст на принтер (legacy метод)
     */
    static async print(text) {
        try {
            const html = `<pre style="font-family: 'Courier New', monospace; font-size: 12px;">${text}</pre>`;
            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                win.document.write(html);
                win.document.close();
                win.print();
            } else {
                await Print.printAsync({ html });
            }
            return { success: true, message: 'Напечатано' };
        } catch (error) {
            console.error('[Printer] Print error:', error);
            return { success: false, message: error.message };
        }
    }

    // Вспомогательные функции форматирования
    static formatMoney(amount) {
        return Math.round(amount || 0).toLocaleString('ru-RU') + " so'm";
    }

    static center(text, width) {
        const padding = Math.max(0, Math.floor((width - text.length) / 2));
        return ' '.repeat(padding) + text;
    }

    static rightAlign(text, width) {
        const padding = Math.max(0, width - text.length);
        return ' '.repeat(padding) + text;
    }

    static leftRight(left, right, width) {
        const gap = Math.max(1, width - left.length - right.length);
        return left + ' '.repeat(gap) + right;
    }
}

export default PrinterService;
