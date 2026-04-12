import api from './api';
import * as Linking from 'expo-linking';

/**
 * Сервис электронных чеков (упрощённая версия)
 * Отправка чеков через мессенджеры
 */
class ElectronicReceiptService {

    /**
     * Форматировать чек в текст
     */
    static formatReceiptText(sale) {
        const items = sale.items || [];
        const date = new Date(sale.created_at || Date.now()).toLocaleString('ru-RU');

        let text = '═══════════════════\n';
        text += '     SMARTPOS PRO\n';
        text += '═══════════════════\n\n';
        text += `Чек #${sale.id || 'N/A'}\n`;
        text += `Дата: ${date}\n\n`;
        text += '───────────────────\n';

        items.forEach(item => {
            const total = (item.price_sale || item.price) * item.quantity;
            text += `${item.name || item.product_name}\n`;
            text += `  ${item.quantity} x ${Math.round(item.price_sale || item.price)} = ${Math.round(total)} so'm\n`;
        });

        text += '───────────────────\n';

        if (sale.discount_amount > 0) {
            text += `Скидка: -${Math.round(sale.discount_amount)} so'm\n`;
        }

        text += `\nИТОГО: ${Math.round(sale.final_amount || sale.total_amount)} so'm\n`;
        text += `Оплата: ${this.getPaymentTypeName(sale.payment_type)}\n\n`;
        text += '═══════════════════\n';
        text += '  Спасибо за покупку!\n';
        text += '═══════════════════\n';

        return text;
    }

    /**
     * Получить название типа оплаты
     */
    static getPaymentTypeName(type) {
        const types = {
            cash: 'Наличные',
            card: 'Банковская карта',
            qr: 'QR-оплата',
            transfer: 'Перевод',
        };
        return types[type] || type || 'Не указано';
    }

    /**
     * Отправить по SMS (открывает приложение SMS)
     */
    static async sendSMS(phone, sale) {
        try {
            const message = this.formatReceiptText(sale);
            const cleanPhone = phone.replace(/[^0-9+]/g, '');
            const url = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return { success: true, method: 'sms' };
            } else {
                throw new Error('SMS недоступно');
            }
        } catch (error) {
            console.error('[Receipt] SMS error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Отправить по Email (открывает почтовый клиент)
     */
    static async sendEmail(email, sale) {
        try {
            const subject = encodeURIComponent(`Чек #${sale.id || 'N/A'} - SmartPOS Pro`);
            const body = encodeURIComponent(this.formatReceiptText(sale));
            const url = `mailto:${email}?subject=${subject}&body=${body}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return { success: true, method: 'email' };
            } else {
                throw new Error('Email недоступно');
            }
        } catch (error) {
            console.error('[Receipt] Email error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Открыть WhatsApp с текстом чека
     */
    static async openWhatsApp(phone, sale) {
        try {
            const text = encodeURIComponent(this.formatReceiptText(sale));
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const url = `whatsapp://send?phone=${cleanPhone}&text=${text}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return { success: true, method: 'whatsapp' };
            } else {
                // Попробовать веб-версию
                const webUrl = `https://wa.me/${cleanPhone}?text=${text}`;
                await Linking.openURL(webUrl);
                return { success: true, method: 'whatsapp' };
            }
        } catch (error) {
            console.error('[Receipt] WhatsApp error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Открыть Telegram
     */
    static async openTelegram(username, sale) {
        try {
            const text = encodeURIComponent(this.formatReceiptText(sale));
            const cleanUsername = username.replace('@', '');
            const url = `https://t.me/${cleanUsername}?text=${text}`;

            await Linking.openURL(url);
            return { success: true, method: 'telegram' };
        } catch (error) {
            console.error('[Receipt] Telegram error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default ElectronicReceiptService;
