/**
 * Конфигурация мобильного приложения
 * 
 * Централизованное управление настройками приложения.
 * Позволяет легко переключаться между dev и production окружениями.
 */

import { Platform } from 'react-native';
// ========================================================
// 🌐 АДРЕС СЕРВЕРА
// ========================================================
// Облачный сервер по умолчанию (Railway) — используется как fallback
const DEFAULT_CLOUD_URL = 'https://smartpos-pro-production-f885.up.railway.app';

// Default server URL
const DEFAULT_SERVER_URL = `${DEFAULT_CLOUD_URL}/api`;

// Dynamic API URL - can be changed based on license/user configuration
let dynamicApiUrl = null;

// Сохранённый облачный URL клиента (загружается из AsyncStorage)
let savedCloudUrl = null;

/**
 * Инициализировать настройки из AsyncStorage (вызвать при старте App)
 */
export async function initSettings() {
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const saved = await AsyncStorage.getItem('server_url');
        if (saved) {
            dynamicApiUrl = saved;
            console.log('[Settings] Restored server URL:', saved);
        }
        const cloud = await AsyncStorage.getItem('cloud_server_url');
        if (cloud) {
            savedCloudUrl = cloud;
            console.log('[Settings] Restored cloud URL:', cloud);
        }
    } catch (e) {
        console.log('[Settings] Init error:', e.message);
    }
}

/**
 * Set custom API URL (for self-hosted servers)
 * @param {string} url - Custom server URL
 */
export function setApiUrl(url) {
    dynamicApiUrl = url;
    console.log('[API] Server URL changed to:', url);
}

/**
 * Set custom cloud/fallback URL (для клиентов со своим облаком)
 * @param {string} url - Custom cloud URL (without /api)
 */
export async function setCloudUrl(url) {
    const cleanUrl = url.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    savedCloudUrl = cleanUrl;
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('cloud_server_url', cleanUrl);
    } catch (e) { /* ignore */ }
    console.log('[API] Cloud fallback URL set to:', cleanUrl);
}

/**
 * Get cloud fallback URL
 */
export function getCloudUrl() {
    return savedCloudUrl || DEFAULT_CLOUD_URL;
}

/**
 * Reset to default cloud server URL
 */
export function resetApiUrl() {
    dynamicApiUrl = null;
    console.log('[API] Server URL reset to default cloud server');
}

/**
 * Get current API URL
 * @returns {string} Current API URL
 */
export function getApiUrl() {
    return dynamicApiUrl || DEFAULT_SERVER_URL;
}

/**
 * Автоматический поиск сервера в локальной сети.
 * Если сервер не найден локально — возвращает URL туннеля (serveo).
 * @returns {Promise<string>} URL найденного сервера (всегда возвращает что-то)
 */
export async function autoDiscoverServer() {
    // На вебе — использовать текущий хост (мы уже на том же сервере)
    if (Platform.OS === 'web') {
        const origin = window.location.origin;
        console.log('[AutoDiscover/Web] Using current host:', origin);
        return `${origin}/api`;
    }

    console.log('[AutoDiscover] Ищу сервер в локальной сети...');

    const port = 5000;
    const timeout = 1500;

    // Точные IP сервера — проверяем первыми (мгновенно)
    const knownServerIps = [
        '192.168.1.97',    // Текущий IP сервера
        '192.168.1.45',    // Основной WiFi сервер
        '192.168.137.1',   // Точка доступа Windows
        '26.129.223.224',  // Radmin VPN
        '192.168.1.1', '192.168.1.100', '192.168.1.101', '192.168.1.102',
        '192.168.0.1', '192.168.0.100', '192.168.0.101',
        '10.0.0.1', '10.0.0.100',
    ];

    const checkServer = async (ip) => {
        const url = `http://${ip}:${port}/api/health`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                if (data.message === 'OK' || data.status === 'ok' || data.uptime) {
                    console.log(`[AutoDiscover] ✅ Локальный сервер: ${ip}:${port}`);
                    return `http://${ip}:${port}/api`;
                }
            }
        } catch (e) { /* IP не отвечает */ }
        return null;
    };

    // Шаг 1: Параллельная проверка известных IP (быстро)
    const knownResults = await Promise.all(knownServerIps.map(checkServer));
    const knownFound = knownResults.find(r => r !== null);
    if (knownFound) return knownFound;

    // Шаг 2: Сканирование 192.168.1.x полностью (самая частая подсеть)
    const scanIps = [];
    for (let host = 1; host <= 254; host++) {
        const ip = `192.168.1.${host}`;
        if (!knownServerIps.includes(ip)) scanIps.push(ip);
    }
    // Добавляем 192.168.0.x и другие подсети (каждый 3й IP)
    for (let subnet of [0, 2, 3, 4, 5]) {
        for (let host = 1; host <= 254; host += 3) {
            const ip = `192.168.${subnet}.${host}`;
            if (!knownServerIps.includes(ip)) scanIps.push(ip);
        }
    }
    for (let i = 0; i < scanIps.length; i += 30) {
        const batch = scanIps.slice(i, i + 30);
        const results = await Promise.all(batch.map(checkServer));
        const found = results.find(r => r !== null);
        if (found) return found;
    }

    // Шаг 3: Fallback — сохранённый облачный URL (или Railway по умолчанию)
    const cloudUrl = getCloudUrl();
    console.log('[AutoDiscover] Локальный сервер не найден → использую облако:', cloudUrl);
    return `${cloudUrl}/api`;
}


// API конфигурация
export const API_CONFIG = {
    // Dynamic BASE_URL - uses getter to allow runtime changes
    get BASE_URL() {
        return getApiUrl();
    },

    // Default cloud URL (динамический — может быть изменён клиентом)
    get CLOUD_URL() {
        return `${getCloudUrl()}/api`;
    },

    // Альтернативный URL (для локальной разработки)
    LOCAL_URL: 'http://localhost:5000/api',

    // Таймауты
    TIMEOUT: 30000,  // 30 секунд для медленных соединений
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,  // 1 секунда
};

// Offline режим
export const OFFLINE_CONFIG = {
    // Интервал автоматической синхронизации (мс)
    SYNC_INTERVAL: 5000,  // 5 секунд

    // Задержка перед синхронизацией после восстановления сети (мс)
    SYNC_DELAY: 2000,  // 2 секунды

    // Срок хранения синхронизированных продаж (дней)
    RETENTION_DAYS: 7,

    // Максимальный размер кэша товаров
    MAX_PRODUCTS_CACHE: 1000,
};

// Валюта (узбекский сум)
export const CURRENCY_CONFIG = {
    CODE: 'UZS',
    SYMBOL: "so'm",
    NAME: 'Узбекский сум',
    DECIMAL_PLACES: 0,  // UZS без копеек
    THOUSAND_SEPARATOR: ' ',
    DECIMAL_SEPARATOR: '.',
    POSITION: 'after',  // символ после числа: 1 000 so'm
};

// UI конфигурация
export const UI_CONFIG = {
    // Пагинация
    ITEMS_PER_PAGE: 20,

    // Хаптика (вибрация)
    ENABLE_HAPTICS: true,

    // Звуки
    ENABLE_SOUNDS: false,

    // Тема
    DEFAULT_THEME: 'dark',
};

// Сканер штрихкодов
export const SCANNER_CONFIG = {
    // Таймаут сканирования (мс)
    TIMEOUT: 30000,  // 30 секунд

    // Вибрация при сканировании
    VIBRATION_ENABLED: true,

    // Типы поддерживаемых кодов
    BARCODE_TYPES: [
        'ean13',
        'ean8',
        'code128',
        'code39',
        'qr',
    ],
};

// Безопасность
export const SECURITY_CONFIG = {
    // Таймаут сессии (мс)
    SESSION_TIMEOUT: 3600000,  // 1 час

    // Требовать PIN для больших сумм
    REQUIRE_PIN_FOR_LARGE_AMOUNTS: true,

    // Порог для большой суммы (руб)
    LARGE_AMOUNT_THRESHOLD: 50000,

    // Максимальное количество попыток входа
    MAX_LOGIN_ATTEMPTS: 5,
};

// Скидки
export const DISCOUNT_CONFIG = {
    // Максимальная скидка на товар (%)
    MAX_ITEM_DISCOUNT: 50,

    // Максимальная общая скидка (%)
    MAX_SALE_DISCOUNT: 30,

    // Предустановленные скидки (%)
    PRESET_DISCOUNTS: [5, 10, 15, 20],
};

// Уведомления
export const NOTIFICATION_CONFIG = {
    // Показывать уведомления о синхронизации
    SHOW_SYNC_NOTIFICATIONS: true,

    // Показывать уведомления об ошибках
    SHOW_ERROR_NOTIFICATIONS: true,

    // Звук уведомлений
    NOTIFICATION_SOUND: false,
};

// Лог конфигурация
export const LOG_CONFIG = {
    // Уровень логирования: 'debug', 'info', 'warn', 'error'
    LEVEL: 'warn',

    // Логировать в консоль
    CONSOLE_LOGGING: true,

    // Включить логирование API запросов
    LOG_API_REQUESTS: false,

    // Включить логирование offline операций
    LOG_OFFLINE_OPERATIONS: true,
};

// Версия приложения
export const APP_VERSION = '4.0.0';

// Dev mode
export const IS_DEV = false;

// Экспорт всей конфигурации
export default {
    API_CONFIG,
    OFFLINE_CONFIG,
    UI_CONFIG,
    SCANNER_CONFIG,
    SECURITY_CONFIG,
    DISCOUNT_CONFIG,
    NOTIFICATION_CONFIG,
    LOG_CONFIG,
    CURRENCY_CONFIG,
    APP_VERSION,
    IS_DEV,
};
