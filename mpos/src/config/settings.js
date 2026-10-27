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

// Проверяем наличие преконфигурированного URL из нативного BuildConfig
// (передаётся через Gradle: ./gradlew assembleRelease -PcloudUrl="https://...")
let BUILD_CLOUD_URL = '';
try {
    const Constants = require('expo-constants').default;
    const nativeCloudUrl = Constants?.expoConfig?.extra?.cloudUrl
        || Constants?.manifest?.extra?.cloudUrl
        || '';
    if (nativeCloudUrl) {
        BUILD_CLOUD_URL = nativeCloudUrl;
        console.log('[Settings] Pre-configured cloud URL from build:', nativeCloudUrl);
    }
} catch (e) {
    // expo-constants not available
}

// Облачный сервер по умолчанию (Railway) — используется как fallback
const DEFAULT_CLOUD_URL = BUILD_CLOUD_URL || 'https://smartpos-pro-production-f885.up.railway.app';

// Default server URL
const DEFAULT_SERVER_URL = `${DEFAULT_CLOUD_URL}/api`;

// Dynamic API URL - can be changed based on license/user configuration
let dynamicApiUrl = null;

// Сохранённый облачный URL клиента (загружается из AsyncStorage)
let savedCloudUrl = null;

// Лицензионные данные (загружаются из AsyncStorage)
let savedLicenseKey = null;
let savedLicenseData = null;

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
        // Загрузить лицензионные данные
        const licKey = await AsyncStorage.getItem('license_key');
        if (licKey) {
            savedLicenseKey = licKey;
            console.log('[Settings] Restored license key:', licKey.substring(0, 8) + '...');
        }
        const licData = await AsyncStorage.getItem('license_data');
        if (licData) {
            savedLicenseData = JSON.parse(licData);
            console.log('[Settings] Restored license data:', savedLicenseData.company_name);
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

// ========================================================
// 🔑 ЛИЦЕНЗИОННЫЙ КЛЮЧ
// ========================================================

/**
 * Сохранить лицензионный ключ и данные лицензии
 */
export async function setLicenseKey(key, licenseData) {
    savedLicenseKey = key;
    savedLicenseData = licenseData;
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('license_key', key);
        if (licenseData) {
            await AsyncStorage.setItem('license_data', JSON.stringify(licenseData));
        }
        // Автоматически установить URL сервера из лицензии
        if (licenseData?.server_url) {
            setApiUrl(licenseData.server_url);
            await AsyncStorage.setItem('server_url', licenseData.server_url);
        }
        console.log('[License] Key saved:', key.substring(0, 8) + '...');
    } catch (e) {
        console.log('[License] Save error:', e.message);
    }
}

/**
 * Получить сохранённый лицензионный ключ
 */
export function getLicenseKey() {
    return savedLicenseKey;
}

/**
 * Получить данные лицензии (company_name, server_url и т.д.)
 */
export function getLicenseData() {
    return savedLicenseData;
}

/**
 * Проверить, есть ли активированная лицензия
 */
export function hasLicense() {
    return !!savedLicenseKey;
}

/**
 * Сбросить лицензию (выход из аккаунта лицензии)
 */
export async function clearLicense() {
    savedLicenseKey = null;
    savedLicenseData = null;
    dynamicApiUrl = null;
    try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.removeItem('license_key');
        await AsyncStorage.removeItem('license_data');
        await AsyncStorage.removeItem('server_url');
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
    } catch (e) { /* ignore */ }
    console.log('[License] Cleared');
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
        '192.168.137.1',   // ★ Точка доступа Windows (мобильный хотспот)
        '192.168.1.35',    // Текущий IP сервера (Ethernet)
        '192.168.1.108',   // IP из десктопного приложения
        '192.168.1.45',    // Ещё один частый IP
        '192.168.1.97',    // Текущий IP сервера
        '26.129.223.224',  // Radmin VPN
        '192.168.1.1', '192.168.0.1', '10.0.0.1', // Шлюзы
        '192.168.1.100', '192.168.1.101', '192.168.1.102',
        '192.168.0.100', '192.168.0.101', '192.168.0.102',
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

    // Шаг 2: Сканирование подсетей
    const scanIps = [];
    // 192.168.137.x (Windows Mobile Hotspot) — полностью
    for (let host = 2; host <= 254; host++) {
        const ip = `192.168.137.${host}`;
        if (!knownServerIps.includes(ip)) scanIps.push(ip);
    }
    // 192.168.1.x полностью (самая частая подсеть)
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
    for (let i = 0; i < scanIps.length; i += 40) {
        const batch = scanIps.slice(i, i + 40);
        const results = await Promise.all(batch.map(checkServer));
        const found = results.find(r => r !== null);
        if (found) return found;
    }

    // Шаг 3: Локальный сервер не найден
    console.log('[AutoDiscover] Локальный сервер не найден');
    return null;
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
export const APP_VERSION = '4.2.3';

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
