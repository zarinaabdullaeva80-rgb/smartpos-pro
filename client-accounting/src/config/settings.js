/**
 * Конфигурация десктоп-клиента SmartPOS Pro
 * 
 * Централизованное управление подключением к серверу.
 * Поддерживает 2 режима: own (свой сервер), cloud (облако Railway).
 * 
 * Аналог mobile-pos/src/config/settings.js
 */

// ============================================================
// Константы
// ============================================================

const DEFAULT_SERVER_URL = 'http://127.0.0.1:5000/api';
const DEFAULT_PORT = 5000;

// Центральный сервер лицензирования (Railway cloud)
const LICENSE_SERVER_URL = 'https://smartpos-pro-production.up.railway.app/api';

// Режимы работы (упрощённые: 2 вместо 4)
export const SERVER_MODES = {
    OWN: 'own',        // Свой сервер клиента (локальный + WiFi + мобильный интернет сотрудников)
    CLOUD: 'cloud',    // Облако Railway (+ локальная копия на ПК)
    // Обратная совместимость со старыми значениями
    SERVER: 'own',     // alias → own
    CLIENT: 'own',     // alias → own (WiFi клиент теперь часть "Свой сервер")
    HYBRID: 'own',     // alias → own (гибрид теперь встроен в "Свой сервер")
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
    const saved = localStorage.getItem(STORAGE_KEYS.SERVER_MODE);
    // Миграция старых значений на новые
    if (saved === 'server' || saved === 'client' || saved === 'hybrid') return SERVER_MODES.OWN;
    if (saved === 'cloud') return SERVER_MODES.CLOUD;
    return saved || SERVER_MODES.OWN;
}

/**
 * Установить режим сервера
 */
export function setServerMode(mode) {
    // Принимаем только 'own' и 'cloud'
    const validModes = [SERVER_MODES.OWN, SERVER_MODES.CLOUD];
    if (!validModes.includes(mode)) {
        console.error('[Settings] Invalid server mode:', mode, '— expected own or cloud');
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
/**
 * Получить URL сервера лицензирования
 * Пытаемся стучаться через локальный сервер (прокси), 
 * но если он недоступен — идем напрямую в облако Railway.
 */
export async function getLicenseServerUrl() {
    const customLicenseUrl = localStorage.getItem(STORAGE_KEYS.LICENSE_SERVER_URL);
    if (customLicenseUrl) return customLicenseUrl;

    // Проверяем, доступен ли локальный сервер
    const apiUrl = getApiUrl();
    const isLocalhost = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
    
    // Если мы в режиме клиента или облака, либо локальный сервер на localhost — 
    // пробуем сначала локальный, но держим облако как основной fallback.
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${apiUrl.replace(/\/api\/?$/, '')}/api/health`, { signal: controller.signal });
        if (response.ok) return apiUrl;
    } catch (e) {
        // Локальный сервер недоступен
    }

    // Fallback: напрямую в облако (чтобы активация работала без сервера)
    return LICENSE_SERVER_URL;
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
        
        // Fallback: если localhost не сработал, пробуем 127.0.0.1 (актуально для Windows IPv6)
        if (cleanUrl.includes('localhost')) {
            const fallbackUrl = cleanUrl.replace('localhost', '127.0.0.1');
            return testServerConnection(fallbackUrl);
        }

        return { ok: false, error: `HTTP ${response.status}` };
    } catch (e) {
        // Fallback при сетевой ошибке (Connection Refused и т.д.)
        if (url.includes('localhost')) {
            const fallbackUrl = url.replace('localhost', '127.0.0.1');
            return testServerConnection(fallbackUrl);
        }
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

    // Приоритетные IP адреса (наиболее вероятные для серверов)
    const priorityIps = [
        '192.168.137.1',    // ★ Точка доступа Windows (мобильный хотспот)
        '192.168.1.35',     // Текущий IP сервера (Ethernet)
        '192.168.1.108',    // IP из логов (частый)
        '192.168.1.45',     // Ещё один частый IP
        '127.0.0.1',        // localhost (IPv4)
        'localhost',        // localhost (Hostname)
        '192.168.1.1', '192.168.0.1', '10.0.0.1', // Шлюзы
        '192.168.1.100', '192.168.1.101', '192.168.1.102',
        '192.168.0.100', '192.168.0.101', '192.168.0.102',
        '26.129.223.224',   // Radmin VPN
    ];

    // Генерация дополнительных IP (включая подсеть 137 — Windows hotspot)
    const generateIps = () => {
        const ips = [...priorityIps];
        // Стандартные подсети 0-10
        for (let subnet = 0; subnet <= 10; subnet++) {
            for (let host = 1; host <= 254; host += 5) {
                const ip = `192.168.${subnet}.${host}`;
                if (!ips.includes(ip)) ips.push(ip);
            }
        }
        // Подсеть 137 (Windows Mobile Hotspot)
        for (let host = 1; host <= 254; host += 5) {
            const ip = `192.168.137.${host}`;
            if (!ips.includes(ip)) ips.push(ip);
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
