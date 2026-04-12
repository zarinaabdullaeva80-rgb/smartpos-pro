/**
 * Конфигурация платёжных систем
 * 
 * ВАЖНО: После регистрации в платёжных системах, 
 * замените DEMO значения на реальные!
 * 
 * Регистрация мерчантов:
 * - Payme: https://merchant.payme.uz
 * - Click: https://merchant.click.uz  
 * - UZUM: https://business.uzum.uz
 */

export const PAYMENT_CONFIG = {
    // Payme
    payme: {
        enabled: true,
        merchantId: 'DEMO_PAYME_MERCHANT', // Замените на реальный Merchant ID
        // Формат QR: https://payme.uz/checkout/{merchantId}?a={amount}&o={orderId}
        // amount в тийинах (сумма * 100)
    },

    // Click
    click: {
        enabled: true,
        serviceId: 'DEMO_SERVICE_ID',     // Замените на реальный Service ID
        merchantId: 'DEMO_MERCHANT_ID',    // Замените на реальный Merchant ID
        secretKey: 'DEMO_SECRET_KEY',      // Секретный ключ (для сервера)
        // Формат: https://my.click.uz/services/pay?service_id={serviceId}&merchant_id={merchantId}&amount={amount}
    },

    // UZUM Bank
    uzum: {
        enabled: true,
        merchantId: 'DEMO_UZUM_MERCHANT',  // Замените на реальный Merchant ID
        // Формат: https://uzumbank.uz/pay?m={merchantId}&a={amount}&r={orderId}
    },

    // Общие настройки
    settings: {
        currency: 'UZS',
        minAmount: 1000,        // Минимальная сумма (so'm)
        maxAmount: 100000000,   // Максимальная сумма (so'm)
        checkInterval: 5000,    // Интервал проверки статуса (мс)
    },

    // Webhook URL для получения уведомлений об оплате
    // Настройте в личном кабинете каждой системы
    webhooks: {
        payme: 'https://your-server.com/api/payments/payme/webhook',
        click: 'https://your-server.com/api/payments/click/webhook',
        uzum: 'https://your-server.com/api/payments/uzum/webhook',
    }
};

/**
 * Инструкция по настройке:
 * 
 * 1. PAYME:
 *    - Зарегистрируйтесь на merchant.payme.uz
 *    - Получите Merchant ID в личном кабинете
 *    - Укажите Webhook URL для уведомлений
 *    - Замените DEMO_PAYME_MERCHANT на ваш ID
 * 
 * 2. CLICK:
 *    - Зарегистрируйтесь на merchant.click.uz
 *    - Получите Service ID и Merchant ID
 *    - Настройте Secret Key для проверки подписи
 *    - Укажите URL для callback
 * 
 * 3. UZUM:
 *    - Зарегистрируйтесь на business.uzum.uz
 *    - Получите Merchant ID
 *    - Настройте API интеграцию
 * 
 * После настройки QR-коды будут вести на реальные страницы оплаты!
 */

export default PAYMENT_CONFIG;
