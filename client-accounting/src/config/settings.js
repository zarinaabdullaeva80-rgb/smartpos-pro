/**
 * Конфигурация десктоп-клиента SmartPOS Pro
 * 
 * Централизованное управление подключением к серверу.
 * Поддерживает 3 режима: server (свой), client (WiFi), cloud (облако).
 * 
 * Аналог mobile-pos/src/config/settings.js
 */

// ============================================================
// Константы
// ============================================================

const DEFAULT_SERVER_URL = 'http://localhost:5000/api';
const DEFAULT_PORT = 5000;

// Центральный сервер лицензирования (Railway cloud)
const LICENSE_SERVER_URL = 'https://smartpos-pro-production.up.railway.app/api';

// Режимы работы
export const SERVER_MODES = {
    SERVER: 'server',  // Electron запускает встроенный сервер
    CLIENT: 'client',  // Подключение к серверу в WiFi сети
    CLOUD: 'cloud',    // Подключение к облачному серверу
    HYBRID: 'hybrid',  // Локальный сервер + синхронизация с облаком
};

// Ключи localStorage
const STORAGE_KEYS = {
    SERVER_MODE: 'server_mode',
    SERVER_URL: 'server_url',
    LICENSE_SERVER_URL: 'license_server_url',
    DEVICE_ID: 'device_id',
    DEVICE_NAME: 'device_name',
};

// ============================================================
// Динамический URL
// ============================================================

let dynamicApiUrl = null;

/**
 * Получить текущий режим сервера
 */
export function getServerMode() {
    return localStorage.getItem(STORAGE_KEYS.SERVER_MODE) || SERVER_MODES.SERVER;
}

/**
 * Установить режим сервера
 */
export function setServerMode(mode) {
    if (!Object.values(SERVER_MODES).includes(mode)) {
        console.error('[Settings] Invalid server mode:', mode);
        return;
    }
    localStorage.setItem(STORAGE_KEYS.SERVER_MODE, mode);
    console.log('[Settings] Server mode set to:', mode);
}

/**
 * Получить API URL (приоритет: dynamic → localStorage → env → localhost)
 * Используется для работы с данными (продажи, товары и т.д.)
 */
export function getApiUrl() {
    if (dynamicApiUrl) return dynamicApiUrl;
    if (window.CUSTOM_API_URL) return window.CUSTOM_API_URL;
    const savedUrl = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (savedUrl) return savedUrl;
    return import.meta.env.VITE_API_URL || DEFAULT_SERVER_URL;
}

/**
 * Получить URL сервера лицензирования
 * Все запросы лицензирования идут через локальный сервер,
 * который проксирует их на центральный облачный сервер Railway.
 * Это обходит проблемы CORS.
 */
export function getLicenseServerUrl() {
    const customLicenseUrl = localStorage.getItem(STORAGE_KEYS.LICENSE_SERVER_URL);
    if (customLicenseUrl) return customLicenseUrl;

    // Используем текущий API URL (localhost) — сервер сам проксирует на Railway
    return getApiUrl();
}

/**
 * Установить URL сервера лицензирования (если клиент хочет указать свой)
 */
export function setLicenseServerUrl(url) {
    const cleanUrl = url.replace(/\/+$/, '');
    const apiUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
    localStorage.setItem(STORAGE_KEYS.LICENSE_SERVER_URL, apiUrl);
    console.log('[Settings] License server URL set to:', apiUrl);
}

/**
 * Получить Socket.IO URL
 */
export function getSocketUrl() {
    const apiUrl = getApiUrl();
    return apiUrl.replace('/api', '');
}

/**
 * Установить API URL
 */
export function setApiUrl(url) {
    const cleanUrl = url.replace(/\/+$/, '');
    const apiUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
    dynamicApiUrl = apiUrl;
    window.CUSTOM_API_URL = apiUrl;
    localStorage.setItem(STORAGE_KEYS.SERVER_URL, apiUrl);
    console.log('[Settings] API URL set to:', apiUrl);
}

/**
 * Сбросить URL к значению по умолчанию
 */
export function resetApiUrl() {
    dynamicApiUrl = null;
    window.CUSTOM_API_URL = null;
    localStorage.removeItem(STORAGE_KEYS.SERVER_URL);
    console.log('[Settings] API URL reset to default');
}

// ============================================================
// Автопоиск сервера в WiFi сети
// ============================================================

/**
 * Проверить подключение к серверу
 * @param {string} url - URL для проверки (без /api/health)
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
export async function testServerConnection(url) {
    try {
        const cleanUrl = url.replace(/\/+$/, '').replace(/\/api\/?$/, '');
        const testUrl = `${cleanUrl}/api/health`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(testUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return { ok: true, data };
        }
        return { ok: false, error: `HTTP ${response.status}` };
    } catch (e) {
        return { ok: false, error: e.name === 'AbortError' ? 'Таймаут подключения' : e.message };
    }
}

/**
 * Автоматический поиск сервера в локальной WiFi сети
 * Сканирует IP адреса на порт 5000
 * @param {function} onProgress - callback(scanned, total) для прогресса
 * @returns {Promise<string|null>} URL найденного сервера или null
 */
export async function autoDiscoverServer(onProgress = null) {
    console.log('[AutoDiscover] Начинаю поиск сервера в локальной сети...');

    // Приоритетные IP адреса
    const priorityIps = [
        '192.168.1.45',     // Основной сервер
        '26.129.223.224',   // Radmin VPN
        '192.168.1.1', '192.168.1.2', '192.168.1.100', '192.168.1.101', '192.168.1.102',
        '192.168.0.1', '192.168.0.2', '192.168.0.100', '192.168.0.101', '192.168.0.102',
        '10.0.0.1', '10.0.0.2', '10.0.0.100',
        '172.16.0.1', '172.16.0.2',
    ];

    // Генерация дополнительных IP
    const generateIps = () => {
        const ips = [...priorityIps];
        for (let subnet = 0; subnet <= 10; subnet++) {
            for (let host = 1; host <= 254; host += 10) {
                const ip = `192.168.${subnet}.${host}`;
                if (!ips.includes(ip)) ips.push(ip);
            }
        }
        return ips;
    };

    const allIps = generateIps();
    const port = DEFAULT_PORT;
    const timeout = 1500;
    let scanned = 0;

    // Проверка одного IP
    const checkServer = async (ip) => {
        const url = `http://${ip}:${port}/api/health`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.message === 'OK' || data.status === 'ok') {
                    console.log(`[AutoDiscover] ✅ Сервер найден: ${ip}:${port}`);
                    return `http://${ip}:${port}/api`;
                }
            }
        } catch (e) {
            // Тихий пропуск
        }
        scanned++;
        if (onProgress) onProgress(scanned, allIps.length);
        return null;
    };

    // 1) Приоритетные IP — последовательно
    for (const ip of priorityIps) {
        const result = await checkServer(ip);
        if (result) return result;
    }

    // 2) Остальные — параллельно по 20
    const remainingIps = allIps.filter(ip => !priorityIps.includes(ip));
    for (let i = 0; i < remainingIps.length; i += 20) {
        const batch = remainingIps.slice(i, i + 20);
        const results = await Promise.all(batch.map(checkServer));
        const found = results.find(r => r !== null);
        if (found) return found;
    }

    console.log('[AutoDiscover] ❌ Сервер не найден в локальной сети');
    return null;
}

// ============================================================
// Регистрация устройства
// ============================================================

/**
 * Получить или сгенерировать ID устройства
 */
export function getDeviceId() {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
        id = `desktop-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
}

/**
 * Получить имя устройства
 */
export function getDeviceName() {
    return localStorage.getItem(STORAGE_KEYS.DEVICE_NAME) ||
        `Десктоп ${navigator.userAgent.includes('Windows') ? 'Windows' : 'PC'}`;
}

/**
 * Регистрация устройства на сервере
 */
export async function registerDevice(token) {
    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/sync-status/register-device`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                device_id: getDeviceId(),
                device_type: 'desktop',
                device_name: getDeviceName(),
                app_version: import.meta.env.VITE_APP_VERSION || '3.0.0',
                os_info: navigator.userAgent,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[Settings] Device registered:', data);
            return data;
        }
    } catch (e) {
        console.log('[Settings] Device registration failed (non-critical):', e.message);
    }
    return null;
}

/**
 * Отправить пинг серверу
 */
export async function sendPing(token) {
    try {
        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/sync-status/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ device_id: getDeviceId() }),
        });
    } catch (e) {
        // Тихий пропуск — пинг некритичен
    }
}

// ============================================================
// API конфигурация
// ============================================================

export const API_CONFIG = {
    get BASE_URL() {
        return getApiUrl();
    },
    get LICENSE_URL() {
        return getLicenseServerUrl();
    },
    DEFAULT_URL: DEFAULT_SERVER_URL,
    LICENSE_URL_DEFAULT: LICENSE_SERVER_URL,
    TIMEOUT: 15000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    HEALTH_CHECK_INTERVAL: 30000,  // 30 сек
    PING_INTERVAL: 60000,          // 60 сек
};

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '4.0.0';
