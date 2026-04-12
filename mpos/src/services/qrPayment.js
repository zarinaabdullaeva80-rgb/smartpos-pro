/**
 * Сервис QR-оплаты для Узбекистана
 * Поддерживает: Payme, Click, UZUM
 */

// Форматы QR-кодов для платёжных систем
const QR_FORMATS = {
    PAYME: {
        name: 'Payme',
        color: '#00CCCC',
        icon: '💳',
        // Формат: payme://pay?merchant=ID&amount=SUM&account[field]=value
        generateUrl: (merchantId, amount, orderId) => {
            return `https://payme.uz/checkout/${merchantId}?a=${amount * 100}&o=${orderId}`;
        }
    },
    CLICK: {
        name: 'Click',
        color: '#00A2E8',
        icon: '📱',
        // Формат: click://pay?service_id=ID&merchant_id=ID&amount=SUM
        generateUrl: (serviceId, merchantId, amount, orderId) => {
            return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount}&transaction_param=${orderId}`;
        }
    },
    UZUM: {
        name: 'UZUM',
        color: '#7B2D8E',
        icon: '🟣',
        // UZUM Bank QR
        generateUrl: (merchantId, amount, orderId) => {
            return `https://uzumbank.uz/pay?m=${merchantId}&a=${amount}&r=${orderId}`;
        }
    }
};

class QRPaymentService {
    static merchantConfig = {
        payme: { merchantId: null, enabled: false },
        click: { serviceId: null, merchantId: null, enabled: false },
        uzum: { merchantId: null, enabled: false },
    };

    /**
     * Настроить merchant данные
     */
    static configure(config) {
        if (config.payme) {
            this.merchantConfig.payme = { ...this.merchantConfig.payme, ...config.payme };
        }
        if (config.click) {
            this.merchantConfig.click = { ...this.merchantConfig.click, ...config.click };
        }
        if (config.uzum) {
            this.merchantConfig.uzum = { ...this.merchantConfig.uzum, ...config.uzum };
        }
    }

    /**
     * Получить список доступных платёжных систем
     */
    static getAvailableSystems() {
        const systems = [];

        if (this.merchantConfig.payme.enabled) {
            systems.push({ id: 'payme', ...QR_FORMATS.PAYME });
        }
        if (this.merchantConfig.click.enabled) {
            systems.push({ id: 'click', ...QR_FORMATS.CLICK });
        }
        if (this.merchantConfig.uzum.enabled) {
            systems.push({ id: 'uzum', ...QR_FORMATS.UZUM });
        }

        // Если ничего не настроено - возвращаем все для демо
        if (systems.length === 0) {
            return [
                { id: 'payme', ...QR_FORMATS.PAYME },
                { id: 'click', ...QR_FORMATS.CLICK },
                { id: 'uzum', ...QR_FORMATS.UZUM },
            ];
        }

        return systems;
    }

    /**
     * Сгенерировать данные для QR-кода
     */
    static generateQRData(system, amount, orderId) {
        const config = this.merchantConfig[system];

        switch (system) {
            case 'payme':
                return {
                    url: QR_FORMATS.PAYME.generateUrl(
                        config.merchantId || 'DEMO_MERCHANT',
                        amount,
                        orderId
                    ),
                    displayAmount: amount,
                    system: QR_FORMATS.PAYME
                };

            case 'click':
                return {
                    url: QR_FORMATS.CLICK.generateUrl(
                        config.serviceId || 'DEMO_SERVICE',
                        config.merchantId || 'DEMO_MERCHANT',
                        amount,
                        orderId
                    ),
                    displayAmount: amount,
                    system: QR_FORMATS.CLICK
                };

            case 'uzum':
                return {
                    url: QR_FORMATS.UZUM.generateUrl(
                        config.merchantId || 'DEMO_MERCHANT',
                        amount,
                        orderId
                    ),
                    displayAmount: amount,
                    system: QR_FORMATS.UZUM
                };

            default:
                throw new Error(`Unknown payment system: ${system}`);
        }
    }

    /**
     * Создать универсальный QR для выбора системы
     */
    static generateUniversalQR(amount, orderId) {
        // Простая ссылка на страницу выбора оплаты
        return {
            url: `https://pay.example.com/invoice/${orderId}?amount=${amount}`,
            displayAmount: amount,
            systems: this.getAvailableSystems()
        };
    }

    /**
     * Проверить статус платежа (заглушка)
     */
    static async checkPaymentStatus(orderId, system) {
        // В реальном приложении здесь будет запрос к API платёжной системы
        console.log(`[QRPayment] Checking status for order ${orderId} via ${system}`);

        // Симуляция проверки
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: 'pending', // pending, paid, failed, expired
                    orderId,
                    system,
                    checkedAt: new Date().toISOString()
                });
            }, 1000);
        });
    }

    /**
     * Форматировать сумму для отображения
     */
    static formatAmount(amount) {
        return Math.round(amount).toLocaleString('ru-RU') + " so'm";
    }
}

export default QRPaymentService;
export { QR_FORMATS };
