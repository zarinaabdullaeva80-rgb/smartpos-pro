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
        merchantId: '6a7c062740e17562c3de2fb3',
        // Формат QR: https://checkout.paycom.uz/{base64} или https://payme.uz/checkout/{merchantId}
        // amount в тийинах (сумма * 100)
    },

    // Click
    click: {
        enabled: true,
        serviceId: '109579',
        merchantId: '63646',
        secretKey: 'fvy6lQSn6o0F',
        // Формат: https://my.click.uz/services/pay?service_id={serviceId}&merchant_id={merchantId}&amount={amount}
    },

    // UZUM Bank
    uzum: {
        enabled: true,
        merchantId: 'DEMO_UZUM_MERCHANT',
        // Формат: https://uzumbank.uz/pay?m={merchantId}&a={amount}&r={orderId}
    },

    // Общие настройки
    settings: {
        currency: 'UZS',
        minAmount: 1000,        // Минимальная сумма (so'm)
        maxAmount: 100000000,   // Максимальная сумма (so'm)
        checkInterval: 3000,    // Интервал проверки статуса (мс)
    },

    // Webhook URL для получения уведомлений об оплате
    webhooks: {
        payme: 'https://smartpos-pro-production-f885.up.railway.app/api/payments/payme',
        click: 'https://smartpos-pro-production-f885.up.railway.app/api/payments/click/prepare',
        uzum: 'https://smartpos-pro-production-f885.up.railway.app/api/payments/uzum/webhook',
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
