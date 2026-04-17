import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, setApiUrl, resetApiUrl, getApiUrl } from '../config/settings';
import logger from './logger';
import { OfflineManager } from './offline';
import OfflineCatalogService from './offlineCatalog';
import ErrorReporter from './errorReporter';

// Offline mode flag
let isOfflineMode = false;

// Create axios instance - baseURL will be updated dynamically
const api = axios.create({
    timeout: API_CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true'
    }
});

/**
 * Check if currently in offline mode
 */
export const isOffline = () => isOfflineMode;

/**
 * Helper for offline fallback - similar to frontend
 */
const withOfflineFallback = async (apiCall, fallbackFn, operationName = 'API') => {
    if (isOfflineMode) {
        logger.offline('API', `Using offline fallback for ${operationName}`);
        return { data: await fallbackFn() };
    }
    try {
        const result = await apiCall();
        isOfflineMode = false;
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
            logger.offline('API', `Server unavailable, switching to offline mode for ${operationName}`);
            isOfflineMode = true;
            return { data: await fallbackFn() };
        }
        throw error;
    }
};

/**
 * Update server URL based on license configuration
 * @param {object} serverConfig - Server configuration from login response
 */
export async function updateServerUrl(serverConfig) {
    if (serverConfig && serverConfig.url) {
        setApiUrl(serverConfig.url);
        await AsyncStorage.setItem('server_url', serverConfig.url);
        await AsyncStorage.setItem('server_type', serverConfig.type || 'cloud');
        logger.info('API', `Server URL updated to: ${serverConfig.url}`);
    }
}

/**
 * Restore server URL from storage (on app restart)
 */
export async function restoreServerUrl() {
    const savedUrl = await AsyncStorage.getItem('server_url');
    if (savedUrl) {
        setApiUrl(savedUrl);
        logger.info('API', `Server URL restored: ${savedUrl}`);
    }
}

/**
 * Reset to default cloud server
 */
export async function resetToCloudServer() {
    resetApiUrl();
    await AsyncStorage.removeItem('server_url');
    await AsyncStorage.removeItem('server_type');
    logger.info('API', 'Reset to cloud server');
}

// Request interceptor - добавление токена, динамический baseURL и логирование
api.interceptors.request.use(
    async (config) => {
        // Dynamic baseURL - get current URL on each request
        const currentUrl = getApiUrl();
        config.baseURL = currentUrl;

        // Получаем токен из AsyncStorage
        const token = await AsyncStorage.getItem('token');

        // Логируем статус токена для отладки
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            logger.debug('API', `Token attached to request: ${config.method?.toUpperCase()} ${config.url}`);
        } else {
            // Если токен отсутствует и это не запрос на авторизацию - предупреждаем
            if (!config.url?.includes('/auth/login') && !config.url?.includes('/auth/register')) {
                logger.warn('API', `No token found for request: ${config.method?.toUpperCase()} ${config.url}`);
                console.warn('[API] ⚠️ Token is missing! Check if user is logged in.');
            }
        }

        // Логировать запрос
        logger.apiRequest(config.method?.toUpperCase() || 'UNKNOWN', config.url, config.data);
        logger.debug('API', `Request to: ${currentUrl}${config.url}`);

        return config;
    },
    (error) => {
        logger.error('API', 'Request interceptor error', error);
        return Promise.reject(error);
    }
);

// Response interceptor - логирование ответов и обработка 401
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
    (response) => {
        logger.apiResponse(
            response.config.method.toUpperCase(),
            response.config.url,
            response.status,
            response.data
        );
        return response;
    },
    async (error) => {
        const status = error.response?.status || 0;
        const url = error.config?.url || 'unknown';
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN';

        logger.apiResponse(method, url, status, error.response?.data);

        // Обработка ошибки 401 — попробовать обновить токен
        if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
            const originalRequest = error.config;

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (token) {
                        // Временно установить старый токен для refresh запроса
                        const refreshRes = await api.post('/auth/refresh', {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const newToken = refreshRes.data?.token;
                        if (newToken) {
                            await AsyncStorage.setItem('token', newToken);
                            logger.info('API', 'Token refreshed successfully');
                            // Повторить все запросы из очереди с новым токеном
                            refreshQueue.forEach(cb => cb(newToken));
                            refreshQueue = [];
                            // Повторить оригинальный запрос
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            return api(originalRequest);
                        }
                    }
                } catch (refreshErr) {
                    logger.error('API', 'Token refresh failed, clearing auth');
                    refreshQueue.forEach(cb => cb(null));
                    refreshQueue = [];
                    await AsyncStorage.removeItem('token');
                    await AsyncStorage.removeItem('user');
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Уже обновляем токен — поставить запрос в очередь
                return new Promise((resolve, reject) => {
                    refreshQueue.push((newToken) => {
                        if (newToken) {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            resolve(api(originalRequest));
                        } else {
                            reject(error);
                        }
                    });
                });
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (credentials) => {
        logger.userAction('Login', 'Attempting login', { username: credentials.username });
        return api.post('/auth/login', credentials);
    },
    getCurrentUser: () => api.get('/auth/me'),
    refresh: () => api.post('/auth/refresh'),
};

// Products API with offline fallback
export const productsAPI = {
    getAll: (params) => withOfflineFallback(
        () => api.get('/products', { params }),
        async () => {
            const products = await OfflineManager.getCachedProducts();
            return { products, total: products.length, offline: true };
        },
        'Products.getAll'
    ),
    getById: (id) => withOfflineFallback(
        () => api.get(`/products/${id}`),
        async () => {
            const products = await OfflineManager.getCachedProducts();
            return products.find(p => p.id === id) || null;
        },
        'Products.getById'
    ),
    // Cache products when online
    cacheAll: async () => {
        try {
            const response = await api.get('/products');
            await OfflineManager.cacheProducts(response.data.products || response.data);
            return true;
        } catch (error) {
            logger.error('API', 'Failed to cache products', error);
            return false;
        }
    }
};

// Sales API with offline fallback
export const salesAPI = {
    create: async (data) => {
        logger.userAction('Cart', 'Creating sale', {
            items: data.items.length,
            total: data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        });

        // Try online first, queue if offline
        try {
            if (isOfflineMode) throw new Error('Offline mode');
            const result = await api.post('/sales', data);
            return result;
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response || isOfflineMode) {
                // Queue for later sync
                const offlineId = await OfflineManager.queueSale(data);
                logger.offline('Sales', `Sale queued offline: ${offlineId}`);
                // Уменьшить локальные остатки
                if (data.items && data.items.length > 0) {
                    await OfflineCatalogService.decrementStockBatch(
                        data.items.map(item => ({ product_id: item.product_id || item.id, quantity: item.quantity || 1 }))
                    );
                }
                return {
                    data: {
                        sale: { id: offlineId, ...data, offline: true },
                        message: 'Продажа сохранена офлайн и будет синхронизирована'
                    }
                };
            }
            throw error;
        }
    },
    getAll: (params) => withOfflineFallback(
        () => api.get('/sales', { params }),
        async () => {
            const queue = await OfflineManager.getSalesQueue();
            return { sales: queue, total: queue.length, offline: true };
        },
        'Sales.getAll'
    ),
    getById: (id) => api.get(`/sales/${id}`),
    updateStatus: (id, status) => api.patch(`/sales/${id}/status`, { status }),
    // Sync offline sales
    syncOffline: () => OfflineManager.syncSalesQueue(),
    getPendingCount: () => OfflineManager.getPendingSalesCount()
};

// Reports API
export const reportsAPI = {
    getDashboard: () => api.get('/reports/dashboard')
};

// Categories API
export const categoriesAPI = {
    getAll: () => api.get('/categories')
};

// Shifts API
export const shiftsAPI = {
    open: (openingCash) => api.post('/shifts/open', { opening_cash: openingCash }),
    close: (id, data) => api.post(`/shifts/${id}/close`, data),
    getCurrent: () => api.get('/shifts/current'),
    getAll: () => api.get('/shifts'),
    getStats: (id) => api.get(`/shifts/${id}/stats`)
};

// Customers API
export const customersAPI = {
    getAll: (params) => api.get('/customers', { params }),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getLoyalty: (id) => api.get(`/customers/${id}/loyalty`),
    addPoints: (id, points) => api.post(`/customers/${id}/loyalty/add`, { points }),
};

// Inventory API
export const inventoryAPI = {
    getAll: () => api.get('/inventory'),
    create: (data) => api.post('/inventory', data),
    getById: (id) => api.get(`/inventory/${id}`),
    getMovements: (productId) => api.get(`/inventory/movements/${productId}`),
};

// Returns API
export const returnsAPI = {
    getAll: (params) => api.get('/returns', { params }),
    create: (data) => api.post('/returns', data),
    getById: (id) => api.get(`/returns/${id}`),
    checkSale: (saleId) => api.get(`/returns/check-sale/${saleId}`),
};

// Errors API
export const errorsAPI = {
    report: (data) => api.post('/errors', data),
};

// Loyalty API - Программа лояльности
export const loyaltyAPI = {
    getProgram: () => api.get('/loyalty/program'),
    getSettings: () => api.get('/loyalty/settings'),
    getCustomerPoints: (customerId) => api.get(`/loyalty/customers/${customerId}`),
    addPoints: (customerId, points, reason) => api.post('/loyalty/add-points', { customerId, points, reason }),
    redeemPoints: (customerId, points, saleId) => api.post('/loyalty/redeem', { customerId, points, saleId }),
    getTransactions: (customerId) => api.get(`/loyalty/transactions/${customerId}`),
    checkBalance: (phone) => api.get(`/loyalty/check/${encodeURIComponent(phone)}`),
    getCard: (customerId) => api.get(`/loyalty/card/${customerId}`),
    getBarcode: (customerId) => api.get(`/loyalty/card/${customerId}/barcode`),
    getQR: (customerId) => api.get(`/loyalty/card/${customerId}/qr`),
    scanCard: (cardNumber, qrData) => api.post('/loyalty/scan', { cardNumber, qrData }),
};

// Sync API - Синхронизация с 1С и десктопом
export const syncAPI = {
    getStatus: () => api.get('/sync/status'),
    triggerSync: (type) => api.post('/sync/trigger', { type }),
    getHistory: (params) => api.get('/sync/history', { params }),
    forceSync: () => api.post('/sync/force'),
    getSyncSettings: () => api.get('/sync/settings'),
    // Синхронизация с 1С
    getSync1cSettings: () => api.get('/sync1c/settings'),
    getSync1cLog: (params) => api.get('/sync1c/log', { params }),
    // Дельта-синхронизация — только изменённые данные с момента `since` (ISO string)
    getProductsDelta: (since) => api.get('/sync/products/delta', { params: since ? { since } : {} }),
    getInventoryDelta: (since) => api.get('/sync/inventory/delta', { params: since ? { since } : {} }),
    // Синхронизация чеков между устройствами
    getReceipts: (params) => api.get('/sync/receipts', { params }),
    uploadReceipts: (receipts, deviceId) => api.post('/sync/receipts', { receipts, device_id: deviceId }),
    // Статус подключённых устройств
    getSyncOverview: () => api.get('/sync-status/overview'),
    registerDevice: (deviceInfo) => api.post('/sync-status/register-device', deviceInfo),
};

// Deliveries API - Доставка
export const deliveriesAPI = {
    getAll: (params) => api.get('/deliveries', { params }),
    getById: (id) => api.get(`/deliveries/${id}`),
    create: (data) => api.post('/deliveries', data),
    updateStatus: (id, status) => api.patch(`/deliveries/${id}/status`, { status }),
    getActiveOrders: () => api.get('/deliveries/active'),
    assignCourier: (id, courierId) => api.patch(`/deliveries/${id}/assign`, { courierId }),
};

// Notifications API - Уведомления
export const notificationsAPI = {
    getAll: (params) => api.get('/notifications', { params }),
    getUnread: () => api.get('/notifications/unread'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllAsRead: () => api.post('/notifications/read-all'),
    getSettings: () => api.get('/notifications/settings'),
    updateSettings: (settings) => api.put('/notifications/settings', settings),
    getHistory: (params) => api.get('/notifications/history', { params }),
    send: (data) => api.post('/notifications/send', data),
    getSentHistory: (params) => api.get('/notifications/sent-history', { params }),
};

// Warehouse API - Склады
export const warehouseAPI = {
    getAll: () => api.get('/warehouses'),
    getById: (id) => api.get(`/warehouses/${id}`),
    getStock: (warehouseId) => api.get(`/warehouses/${warehouseId}/stock`),
    transfer: (data) => api.post('/warehouses/transfer', data),
    getMovements: (warehouseId) => api.get(`/warehouses/${warehouseId}/movements`),
};

// Analytics API - Аналитика
export const analyticsAPI = {
    getDashboard: () => api.get('/analytics/dashboard'),
    getSalesStats: (period) => api.get('/analytics/sales', { params: { period } }),
    getTopProducts: (limit = 10) => api.get('/analytics/top-products', { params: { limit } }),
    getHourlySales: (date) => api.get('/analytics/hourly-sales', { params: { date } }),
    getCashierStats: () => api.get('/analytics/cashier-stats'),
};

// Settings API - Настройки
export const settingsAPI = {
    getGeneral: () => api.get('/settings/general'),
    updateGeneral: (settings) => api.put('/settings/general', settings),
    getPrinter: () => api.get('/settings/printer'),
    updatePrinter: (settings) => api.put('/settings/printer', settings),
    getReceipt: () => api.get('/settings/receipt'),
    updateReceipt: (settings) => api.put('/settings/receipt', settings),
};

// Barcode API - Штрих-коды
export const barcodeAPI = {
    lookup: (barcode) => api.get(`/barcode/lookup/${barcode}`),
    generate: (productId) => api.post(`/barcode/generate/${productId}`),
    bulkLookup: (barcodes) => api.post('/barcode/bulk-lookup', { barcodes }),
};

// Health API - Проверка состояния
export const healthAPI = {
    check: () => api.get('/health'),
    detailed: () => api.get('/health/detailed'),
};

// License API - Лицензирование (публичные endpoints, без аутентификации)
export const licenseAPI = {
    /**
     * Резолв лицензионного ключа → URL сервера + данные компании.
     * Вызывается ДО логина, обращается к центральному облачному серверу.
     * @param {string} key - Лицензионный ключ
     * @param {string} cloudUrl - URL облачного сервера (опционально)
     */
    resolve: async (key, cloudUrl) => {
        const baseUrl = cloudUrl || getApiUrl();
        const response = await axios.get(`${baseUrl}/license/resolve`, {
            params: { key },
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        });
        return response;
    },

    /** Проверка состояния целевого сервера */
    checkHealth: async (serverUrl) => {
        const url = serverUrl.endsWith('/api') ? serverUrl : `${serverUrl}/api`;
        const response = await axios.get(`${url}/health`, {
            timeout: 5000,
            headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        return response;
    },
};

export default api;
