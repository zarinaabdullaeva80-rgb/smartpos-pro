import axios from 'axios';
import { io } from 'socket.io-client';
import * as ls from './localStorageService';
import { getApiUrl, getSocketUrl, registerDevice, sendPing, getDeviceId, API_CONFIG } from '../config/settings';

// Динамические URL — обновляются из config/settings.js
let API_URL = getApiUrl();
let SOCKET_URL = getSocketUrl();

// Периодический пинг для отслеживания статуса устройства
let pingInterval = null;
const startDevicePing = () => {
    if (pingInterval) return;
    pingInterval = setInterval(() => {
        const token = localStorage.getItem('token');
        if (token) sendPing(token);
    }, API_CONFIG.PING_INTERVAL);
};
const stopDevicePing = () => {
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
};

// Флаг офлайн-режима
let isOfflineMode = false;
let healthCheckInterval = null;

// Проверка доступности сервера
const checkServerAvailability = async () => {
    try {
        await axios.get(API_URL.replace('/api', '/health'), { timeout: 3000 });
        const wasOffline = isOfflineMode;
        isOfflineMode = false;
        if (wasOffline) {
            console.log('[API] Server is back online!');
            // Trigger sync when coming back online
            try {
                const { syncPendingChanges } = await import('./syncService');
                syncPendingChanges();
            } catch (e) {
                console.log('[API] Sync service not available');
            }
        }
        return true;
    } catch {
        if (!isOfflineMode) {
            console.warn('[API] Server unavailable, switching to offline mode');
        }
        isOfflineMode = true;
        return false;
    }
};

// Периодическая проверка сервера (каждые 30 секунд)
const startHealthCheck = () => {
    if (healthCheckInterval) return;
    healthCheckInterval = setInterval(() => {
        checkServerAvailability();
    }, 30000);
};

const stopHealthCheck = () => {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
};

// Инициализация при загрузке
checkServerAvailability();
startHealthCheck();


// Axios instance
const api = axios.create({
    baseURL: API_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

// Request interceptor — динамический baseURL + auth token
api.interceptors.request.use(
    (config) => {
        // Обновляем baseURL на каждом запросе (для динамического переключения серверов)
        config.baseURL = getApiUrl();
        API_URL = getApiUrl();
        SOCKET_URL = getSocketUrl();

        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => {
        // Production: не логируем каждый запрос (безопасность + производительность)
        if (import.meta.env.DEV) {
            console.log(`[API] ${response.config.method.toUpperCase()} ${response.config.url}`);
        }
        isOfflineMode = false;
        return response;
    },
    (error) => {
        console.error('[API ERROR]', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message
        });

        // Переключение в офлайн при ошибке соединения
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
            isOfflineMode = true;
            console.warn('[API] Connection failed, using offline mode');
        }

        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            // Только редиректим если мы НЕ на странице логина, чтобы избежать бесконечного релоада
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        // Отправляем ошибку на сервер для логирования
        if (error.config?.url !== '/errors' && !isOfflineMode) {
            errorsAPI.report({
                type: 'frontend_api',
                severity: error.response?.status >= 500 ? 'critical' : 'error',
                message: error.message,
                url: error.config?.url,
                component: 'AxiosInterceptor',
                metadata: {
                    status: error.response?.status,
                    method: error.config?.method,
                    data: error.response?.data
                }
            }).catch(() => { }); // Игнорируем ошибки самого логера
        }

        return Promise.reject(error);
    }
);

// Socket.io connection
let socket = null;

export const connectSocket = () => {
    if (!socket && !isOfflineMode) {
        socket = io(SOCKET_URL);
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

// Хелпер для работы с fallback
const withFallback = async (apiCall, fallbackFn) => {
    if (isOfflineMode) {
        console.log('[API] Using offline fallback');
        return { data: fallbackFn() };
    }
    try {
        return await apiCall();
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
            console.log('[API] Server error, using offline fallback');
            isOfflineMode = true;
            return { data: fallbackFn() };
        }
        throw error;
    }
};

// Auth API with offline fallback
export const authAPI = {
    login: async (credentials) => {
        try {
            const response = await api.post('/auth/login', credentials);
            // Регистрация устройства и запуск пинга после успешного логина
            if (response.data?.token) {
                registerDevice(response.data.token).catch(() => { });
                startDevicePing();
            }
            return response;
        } catch (error) {
            // Сервер недоступен — вход невозможен без подключения
            if (isOfflineMode || error.code === 'ERR_NETWORK' || !error.response) {
                throw { response: { data: { error: 'Сервер недоступен. Проверьте подключение к серверу.' } } };
            }
            throw error;
        }
    },
    register: (userData) => api.post('/auth/register', userData),
    getCurrentUser: async () => {
        try {
            return await api.get('/auth/me');
        } catch {
            const userData = localStorage.getItem('user');
            if (userData) {
                return { data: JSON.parse(userData) };
            }
            throw new Error('Не удалось получить данные пользователя');
        }
    }
};

// Errors API
export const errorsAPI = {
    report: (errorData) => api.post('/errors', errorData),
    getAll: (params) => api.get('/errors', { params }),
    getStats: (params) => api.get('/errors/stats', { params }),
    resolve: (id) => api.put(`/errors/${id}/resolve`),
    delete: (id) => api.delete(`/errors/${id}`)
};

// Products API with offline fallback
export const productsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/products', { params }),
        () => {
            const products = params?.search
                ? ls.searchItems('products', params.search, ['name', 'code', 'barcode'])
                : ls.getItems('products');
            return { products, total: products.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/products/${id}`),
        () => ls.getItemById('products', id)
    ),
    create: (data) => withFallback(
        () => {
            console.log('[productsAPI.create] Trying server request with data:', data);
            return api.post('/products', data);
        },
        () => {
            console.log('[productsAPI.create] Using OFFLINE fallback with data:', data);
            const product = ls.addItemWithSync('products', {
                ...data,
                code: data.code || ls.generateProductCode(),
                barcode: data.barcode || ls.generateBarcode(),
                is_active: true,
                vat_rate: data.vatRate || 12,
                price_purchase: data.pricePurchase || 0,
                price_sale: data.priceSale || 0,
                price_retail: data.priceRetail || 0
            });
            console.log('[productsAPI.create] Product saved to localStorage:', product);
            return { product, message: 'Товар создан (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/products/${id}`, data),
        () => {
            const product = ls.updateItemWithSync('products', id, {
                ...data,
                vat_rate: data.vatRate,
                price_purchase: data.pricePurchase,
                price_sale: data.priceSale,
                price_retail: data.priceRetail
            });
            return { product, message: 'Товар обновлён (офлайн)' };
        }
    ),
    delete: (id) => withFallback(
        () => api.delete(`/products/${id}`),
        () => {
            ls.deleteItemWithSync('products', id);
            return { message: 'Товар удалён (офлайн)' };
        }
    ),
    getInventory: (id) => withFallback(
        () => api.get(`/products/${id}/inventory`),
        () => ({ quantity: 0, warehouse: 'Основной склад' })
    ),
    updateStock: (id, data) => api.post(`/products/${id}/stock`, data),
    getAllStock: (params) => withFallback(
        () => api.get('/products/stock/all', { params }),
        () => ({ products: [] })
    )
};

// Sales API with offline fallback
export const salesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/sales', { params }),
        () => {
            const sales = ls.getItems('sales');
            return { sales, total: sales.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/sales/${id}`),
        () => ls.getItemById('sales', id)
    ),
    create: (data) => withFallback(
        () => api.post('/sales', data),
        () => {
            const salesCount = ls.getItems('sales').length;
            const sale = ls.addItemWithSync('sales', {
                ...data,
                number: `SAL-2026-${String(salesCount + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                status: 'completed'
            });
            return { sale, message: 'Продажа создана (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/sales/${id}`, data),
        () => ({ sale: ls.updateItem('sales', id, data) })
    ),
    confirm: (id) => withFallback(
        () => api.post(`/sales/${id}/confirm`),
        () => ({ sale: ls.updateItem('sales', id, { status: 'completed' }) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/sales/${id}`),
        () => {
            ls.deleteItem('sales', id);
            return { message: 'Продажа удалена' };
        }
    )
};

// Purchases API with offline fallback
export const purchasesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/purchases', { params }),
        () => {
            const purchases = ls.getItems('purchases');
            return { purchases, total: purchases.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/purchases/${id}`),
        () => ls.getItemById('purchases', id)
    ),
    create: (data) => withFallback(
        () => api.post('/purchases', data),
        () => {
            const count = ls.getItems('purchases').length;
            const purchase = ls.addItem('purchases', {
                ...data,
                number: `PUR-2026-${String(count + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                status: 'draft'
            });
            return { purchase, message: 'Закупка создана (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/purchases/${id}`, data),
        () => ({ purchase: ls.updateItem('purchases', id, data) })
    ),
    confirm: (id) => withFallback(
        () => api.post(`/purchases/${id}/confirm`),
        () => ({ purchase: ls.updateItem('purchases', id, { status: 'confirmed' }) })
    ),
    cancel: (id) => withFallback(
        () => api.post(`/purchases/${id}/cancel`),
        () => ({ purchase: ls.updateItem('purchases', id, { status: 'cancelled' }) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/purchases/${id}`),
        () => {
            ls.deleteItem('purchases', id);
            return { message: 'Закупка удалена' };
        }
    )
};

// Counterparties API with offline fallback
export const counterpartiesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/counterparties', { params }),
        () => {
            let counterparties = ls.getItems('counterparties');
            if (params?.type) {
                counterparties = counterparties.filter(c => c.type === params.type);
            }
            if (params?.search) {
                counterparties = counterparties.filter(c =>
                    c.name.toLowerCase().includes(params.search.toLowerCase())
                );
            }
            return { counterparties, total: counterparties.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/counterparties/${id}`),
        () => ls.getItemById('counterparties', id)
    ),
    getHistory: (id, params) => withFallback(
        () => api.get(`/counterparties/${id}/history`, { params }),
        () => ({ history: [], total: 0 })
    ),
    getBalance: (id) => withFallback(
        () => api.get(`/counterparties/${id}/balance`),
        () => {
            const cp = ls.getItemById('counterparties', id);
            return { balance: cp?.balance || 0 };
        }
    ),
    getStats: (id) => withFallback(
        () => api.get(`/counterparties/${id}/stats`),
        () => ({ orders: 0, total: 0, lastOrder: null })
    ),
    create: (data) => withFallback(
        () => api.post('/counterparties', data),
        () => {
            const counterparty = ls.addItemWithSync('counterparties', {
                ...data,
                balance: 0,
                is_active: true
            });
            return { counterparty, message: 'Контрагент создан (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/counterparties/${id}`, data),
        () => ({ counterparty: ls.updateItem('counterparties', id, data) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/counterparties/${id}`),
        () => {
            ls.deleteItem('counterparties', id);
            return { message: 'Контрагент удалён' };
        }
    )
};

// Warehouses API with offline fallback
export const warehousesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/warehouses', { params }),
        () => {
            const warehouses = ls.getItems('warehouses');
            return { warehouses, total: warehouses.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/warehouses/${id}`),
        () => ls.getItemById('warehouses', id)
    ),
    create: (data) => withFallback(
        () => api.post('/warehouses', data),
        () => {
            const count = ls.getItems('warehouses').length;
            const warehouse = ls.addItemWithSync('warehouses', {
                ...data,
                code: data.code || `WH-${String(count + 1).padStart(3, '0')}`,
                is_active: true,
                is_default: count === 0
            });
            return { warehouse, message: 'Склад создан (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/warehouses/${id}`, data),
        () => ({ warehouse: ls.updateItem('warehouses', id, data) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/warehouses/${id}`),
        () => {
            ls.deleteItem('warehouses', id);
            return { message: 'Склад удалён' };
        }
    ),
    getStock: (params) => withFallback(
        () => api.get('/warehouses/stock/balance', { params }),
        () => ({ stock: [] })
    ),
    getMovements: (params) => withFallback(
        () => api.get('/warehouses/movements/all', { params }),
        () => ({ movements: ls.getItems('movements'), total: 0 })
    ),
    createMovement: (data) => withFallback(
        () => api.post('/warehouses/movements', data),
        () => {
            const movement = ls.addItem('movements', {
                ...data,
                date: new Date().toISOString()
            });
            return { movement };
        }
    ),
    transfer: (data) => withFallback(
        () => api.post('/warehouses/transfer', data),
        () => {
            const transfer = ls.addItem('transfers', data);
            return { transfer, message: 'Перемещение создано (офлайн)' };
        }
    ),
    getTransfers: (params) => withFallback(
        () => api.get('/warehouses/transfers', { params }),
        () => {
            const transfers = ls.getItems('transfers') || [];
            return { transfers, total: transfers.length };
        }
    ),
    createTransfer: (data) => withFallback(
        () => api.post('/warehouses/transfers', data),
        () => {
            const warehouses = ls.getItems('warehouses');
            const transfer = ls.addItem('transfers', {
                ...data,
                from_warehouse: warehouses.find(w => w.id == data.from_warehouse_id)?.name || 'Склад',
                to_warehouse: warehouses.find(w => w.id == data.to_warehouse_id)?.name || 'Склад',
                status: 'pending',
                created_at: new Date().toISOString()
            });
            return { transfer, message: 'Перемещение создано (офлайн)' };
        }
    )
};

// Finance API with offline fallback
export const financeAPI = {
    getAccounts: () => withFallback(
        () => api.get('/finance/accounts'),
        () => {
            const accounts = ls.getItems('accounts');
            return { accounts };
        }
    ),
    createAccount: (data) => withFallback(
        () => api.post('/finance/accounts', data),
        () => {
            const account = ls.addItemWithSync('accounts', {
                ...data,
                balance: data.balance || 0,
                is_active: true
            });
            return { account, message: 'Счёт создан (офлайн)' };
        }
    ),
    updateAccount: (id, data) => withFallback(
        () => api.put(`/finance/accounts/${id}`, data),
        () => ({ account: ls.updateItem('accounts', id, data) })
    ),
    deleteAccount: (id) => withFallback(
        () => api.delete(`/finance/accounts/${id}`),
        () => {
            ls.deleteItem('accounts', id);
            return { message: 'Счёт удалён' };
        }
    ),
    getPayments: (params) => withFallback(
        () => api.get('/finance/payments', { params }),
        () => ({ payments: ls.getItems('payments'), total: 0 })
    ),
    createPayment: (data) => withFallback(
        () => api.post('/finance/payments', data),
        () => {
            const payment = ls.addItem('payments', {
                ...data,
                date: new Date().toISOString().split('T')[0],
                status: 'pending'
            });
            return { payment };
        }
    ),
    getTransactions: (params) => withFallback(
        () => api.get('/finance/transactions', { params }),
        () => {
            // Генерируем автоматический отчёт приходов/расходов
            const sales = ls.getItems('sales');
            const purchases = ls.getItems('purchases');
            const transactions = [
                ...sales.map(s => ({
                    id: 'inc_' + s.id,
                    date: s.date,
                    type: 'income',
                    description: `Продажа ${s.number}`,
                    amount: s.total,
                    counterparty: s.customer_name
                })),
                ...purchases.map(p => ({
                    id: 'exp_' + p.id,
                    date: p.date,
                    type: 'expense',
                    description: `Закупка ${p.number}`,
                    amount: p.total,
                    counterparty: p.supplier_name
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));
            return { transactions, total: transactions.length };
        }
    ),
    confirmPayment: (id) => api.post(`/finance/payments/${id}/confirm`),
    deletePayment: (id) => api.delete(`/finance/payments/${id}`),
};


// Invoices API with offline fallback
export const invoicesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/invoices', { params }),
        () => {
            const invoices = ls.getItems('invoices');
            return { invoices, total: invoices.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/invoices/${id}`),
        () => ls.getItemById('invoices', id)
    ),
    create: (data) => withFallback(
        () => api.post('/invoices', data),
        () => {
            const count = ls.getItems('invoices').length;
            const invoice = ls.addItem('invoices', {
                ...data,
                number: `INV-2026-${String(count + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                status: 'draft'
            });
            return { invoice, message: 'Счёт-фактура создана (офлайн)' };
        }
    ),
    createFromSale: (saleId) => withFallback(
        () => api.post(`/invoices/from-sale/${saleId}`),
        () => {
            const sale = ls.getItemById('sales', saleId);
            if (!sale) throw new Error('Продажа не найдена');
            const count = ls.getItems('invoices').length;
            const invoice = ls.addItem('invoices', {
                number: `INV-2026-${String(count + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                sale_id: saleId,
                customer: sale.customer_name,
                total: sale.total,
                status: 'draft'
            });
            return { invoice };
        }
    ),
    delete: (id) => withFallback(
        () => api.delete(`/invoices/${id}`),
        () => {
            ls.deleteItem('invoices', id);
            return { message: 'Счёт-фактура удалена' };
        }
    )
};

// Reports API with offline fallback
export const reportsAPI = {
    getSalesAnalytics: (params) => withFallback(
        () => api.get('/reports/sales-analytics', { params }),
        () => {
            const sales = ls.getItems('sales') || [];
            const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);
            // Return analytics as array for chart data
            return { analytics: [], total, count: sales.length, average: sales.length ? total / sales.length : 0 };
        }
    ),
    getTopProducts: (params) => withFallback(
        () => api.get('/reports/top-products', { params }),
        () => ({ topProducts: (ls.getItems('products') || []).slice(0, 10) })
    ),
    getInventoryBalances: (params) => withFallback(
        () => api.get('/reports/inventory-balances', { params }),
        () => ({ balances: [] })
    ),
    getFinancialSummary: (params) => withFallback(
        () => api.get('/reports/financial-summary', { params }),
        () => {
            const sales = ls.getItems('sales') || [];
            const purchases = ls.getItems('purchases') || [];
            const income = sales.reduce((sum, s) => sum + (s.total || 0), 0);
            const expense = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
            return { financial: { income, expense, profit: income - expense } };
        }
    ),
    getDashboard: () => withFallback(
        () => api.get('/reports/dashboard'),
        () => {
            const sales = ls.getItems('sales') || [];
            const products = ls.getItems('products') || [];
            const counterparties = ls.getItems('counterparties') || [];
            const today = new Date().toISOString().split('T')[0];
            return {
                dashboard: {
                    sales_today: sales.filter(s => s.date === today).length,
                    total_products: products.length,
                    total_counterparties: counterparties.length,
                    revenue_today: sales.filter(s => s.date === today).reduce((sum, s) => sum + (s.total || 0), 0),
                    low_stock_count: 0,
                    active_users: 1
                }
            };
        }
    )
};

// Configurations API
export const configurationsAPI = {
    getAll: () => api.get('/configurations'),
    getByCategory: () => api.get('/configurations/by-category'),
    getById: (id) => api.get(`/configurations/${id}`),
    getModules: (id) => api.get(`/configurations/${id}/modules`),
    getUserConfiguration: () => api.get('/configurations/user/current'),
    getUserModules: () => api.get('/configurations/user/modules'),
    selectConfiguration: (configurationId) => api.post('/configurations/user/select', { configurationId })
};

// Categories API with offline fallback
export const categoriesAPI = {
    getAll: () => withFallback(
        () => api.get('/categories'),
        () => {
            const categories = ls.getItems('categories');
            return { categories, total: categories.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/categories/${id}`),
        () => ls.getItemById('categories', id)
    ),
    create: (data) => withFallback(
        () => api.post('/categories', data),
        () => {
            const category = ls.addItemWithSync('categories', { ...data, is_active: true });
            return { category, message: 'Категория создана (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/categories/${id}`, data),
        () => ({ category: ls.updateItemWithSync('categories', id, data) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/categories/${id}`),
        () => {
            ls.deleteItemWithSync('categories', id);
            return { message: 'Категория удалена (офлайн)' };
        }
    )
};

// Employees API with offline fallback
export const employeesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/employees', { params }),
        () => {
            const employees = ls.getItems('employees');
            return { employees, total: employees.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/employees/${id}`),
        () => ls.getItemById('employees', id)
    ),
    create: (data) => withFallback(
        () => api.post('/employees', data),
        () => {
            const employee = ls.addItemWithSync('employees', {
                ...data,
                is_active: true,
                hire_date: new Date().toISOString().split('T')[0]
            });
            return { employee, message: 'Сотрудник создан (офлайн)' };
        }
    ),
    update: (id, data) => withFallback(
        () => api.put(`/employees/${id}`, data),
        () => ({ employee: ls.updateItemWithSync('employees', id, data) })
    ),
    delete: (id) => withFallback(
        () => api.delete(`/employees/${id}`),
        () => {
            ls.deleteItemWithSync('employees', id);
            return { message: 'Сотрудник удалён (офлайн)' };
        }
    ),
    getPayroll: (params) => withFallback(
        () => api.get('/employees/payroll', { params }),
        () => ({ payroll: ls.getItems('payroll'), total: 0 })
    ),
    resetPassword: (id) => api.post(`/employees/${id}/reset-password`),
    massCalculatePayroll: (data) => api.post('/employees/payroll/mass-calculate', data),
    payPayroll: (id, data) => api.post(`/employees/payroll/${id}/pay`, data)
};

// Inventory API with offline fallback
export const inventoryAPI = {
    getAll: (params) => withFallback(
        () => api.get('/warehouses/inventories', { params }),
        () => {
            const inventories = ls.getItems('inventories');
            return { inventories, total: inventories.length };
        }
    ),
    getById: (id) => withFallback(
        () => api.get(`/warehouses/inventories/${id}`),
        () => ls.getItemById('inventories', id)
    ),
    create: (data) => withFallback(
        () => api.post('/warehouses/inventories', data),
        () => {
            const count = ls.getItems('inventories').length;
            const inventory = ls.addItemWithSync('inventories', {
                ...data,
                number: `INV-2026-${String(count + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                status: 'draft'
            });
            return { inventory, message: 'Инвентаризация создана (офлайн)' };
        }
    ),
    start: (id) => withFallback(
        () => api.post(`/warehouses/inventories/${id}/start`),
        () => ({ inventory: ls.updateItemWithSync('inventories', id, { status: 'in_progress' }) })
    ),
    complete: (id) => withFallback(
        () => api.post(`/warehouses/inventories/${id}/complete`),
        () => ({ inventory: ls.updateItemWithSync('inventories', id, { status: 'completed' }) })
    ),
    updateItem: (inventoryId, itemId, data) => withFallback(
        () => api.put(`/warehouses/inventories/${inventoryId}/items/${itemId}`, data),
        () => ({ success: true })
    ),
    getAdjustments: (id) => withFallback(
        () => api.get(`/warehouses/inventories/${id}/adjustments`),
        () => ([])
    )
};

// Returns API with offline fallback
export const returnsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/returns', { params }),
        () => {
            const returns = ls.getItems('returns');
            return { returns, total: returns.length };
        }
    ),
    create: (data) => withFallback(
        () => api.post('/returns', data),
        () => {
            const count = ls.getItems('returns').length;
            const returnItem = ls.addItemWithSync('returns', {
                ...data,
                number: `RET-2026-${String(count + 1).padStart(4, '0')}`,
                date: new Date().toISOString().split('T')[0],
                status: 'pending'
            });
            return { return: returnItem, message: 'Возврат создан (офлайн)' };
        }
    ),
    process: (id) => withFallback(
        () => api.post(`/returns/${id}/process`),
        () => ({ return: ls.updateItemWithSync('returns', id, { status: 'processed' }) })
    )
};

// Analytics API
export const analyticsAPI = {
    getABCAnalysis: (params) => api.get('/analytics/abc-analysis', { params }),
    getProfitLoss: (params) => api.get('/analytics/profit-loss', { params }),
    getBalanceSheet: () => api.get('/analytics/balance-sheet'),
    getCategoryAnalysis: (params) => api.get('/analytics/category-analysis', { params }),
    getSalesTrend: (params) => api.get('/analytics/sales-trend', { params }),
    getRFMAnalysis: () => api.get('/analytics/rfm-analysis')
};

// CRM API
export const crmAPI = {
    getCustomers: (params) => withFallback(
        () => api.get('/customers', { params }),
        () => {
            const customers = ls.getItems('customers');
            return { customers, total: customers.length };
        }
    ),
    getCustomerById: (id) => api.get(`/customers/${id}`),
    createCustomer: (data) => withFallback(
        () => api.post('/customers', data),
        () => {
            const customer = ls.addItemWithSync('customers', {
                ...data,
                created_at: new Date().toISOString()
            });
            return { customer, message: 'Клиент создан (офлайн)' };
        }
    ),
    updateCustomer: (id, data) => withFallback(
        () => api.put(`/customers/${id}`, data),
        () => ({ customer: ls.updateItemWithSync('customers', id, data) })
    ),
    getSalesPipeline: () => api.get('/crm/pipeline'),
    getStages: () => api.get('/crm/stages'),
    getDeals: (params) => api.get('/crm/deals', { params }),
    createDeal: (data) => api.post('/crm/deals', data),
    updateDealStage: (id, stageId) => api.put(`/crm/deals/${id}/stage`, { stage_id: stageId }),
    deleteDeal: (id) => api.delete(`/crm/deals/${id}`),
};


// Loyalty API
export const loyaltyAPI = {
    getSettings: () => api.get('/loyalty/settings'),
    updateSettings: (data) => api.put('/loyalty/settings', data),
    getProgram: () => api.get('/loyalty/program'),
    getCards: (params) => api.get('/loyalty/cards', { params }),
    createCard: (data) => api.post('/loyalty/cards', data),
    getCardById: (id) => api.get(`/loyalty/cards/${id}`),
    getCard: (customerId) => api.get(`/loyalty/card/${customerId}`),
    addPoints: (cardId, points, reason) => api.post(`/loyalty/cards/${cardId}/points`, { points, reason }),
    earn: (data) => api.post('/loyalty/earn', data),
    spendPoints: (customerId, points, description) => api.post('/loyalty/spend', { customerId, points, description }),
    spend: (data) => api.post('/loyalty/spend', data),
    getBalance: (customerId) => api.get(`/loyalty/balance/${customerId}`),
    getTransactions: (customerId) => api.get(`/loyalty/transactions/${customerId}`),
    getBarcode: (customerId) => api.get(`/loyalty/card/${customerId}/barcode`),
    getQR: (customerId) => api.get(`/loyalty/card/${customerId}/qr`),
    getGiftCertificates: () => api.get('/loyalty/certificates'),
    createCertificate: (data) => api.post('/loyalty/certificates', data)
};

// Batches API (партионный учёт)
export const batchesAPI = {
    getAll: (params) => api.get('/warehouses/batches', { params }),
    getExpiring: (days = 30) => api.get('/warehouses/batches', { params: { expiring_days: days } }),
    getById: (id) => api.get(`/warehouses/batches/${id}`)
};

// Gift Certificates API
export const giftCertificatesAPI = {
    getAll: () => api.get('/extended/gift-certificates'),
    create: (data) => api.post('/extended/gift-certificates', data),
    redeem: (code, amount, saleId) => api.post('/extended/gift-certificates/redeem', { code, amount, sale_id: saleId }),
    getById: (id) => api.get(`/extended/gift-certificates/${id}`)
};

// Email Campaigns API
export const emailCampaignsAPI = {
    getAll: () => api.get('/email-campaigns'),
    create: (data) => api.post('/email-campaigns', data),
    send: (id) => api.post(`/email-campaigns/${id}/send`),
    delete: (id) => api.delete(`/email-campaigns/${id}`)
};

// Notifications API
export const notificationsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/notifications', { params }),
        () => ({ notifications: ls.getItems('notifications') || [], total: 0 })
    ),
    getUnread: () => withFallback(
        () => api.get('/notifications/unread'),
        () => ({ notifications: [], unreadCount: 0 })
    ),
    getUnreadCount: () => withFallback(
        () => api.get('/notifications/unread-count'),
        () => ({ unreadCount: 0 })
    ),
    getHistory: (params) => withFallback(
        () => api.get('/notifications/history', { params }),
        () => ({ notifications: [], total: 0 })
    ),
    markRead: (id) => api.post(`/notifications/mark-read/${id}`),
    markAllRead: () => api.post('/notifications/mark-all-read'),
    send: (data) => api.post('/notifications/send', data),
    getSentHistory: (params) => withFallback(
        () => api.get('/notifications/sent-history', { params }),
        () => ({ notifications: [], total: 0 })
    ),
    getSettings: () => withFallback(
        () => api.get('/notifications/settings'),
        () => ({ settings: {} })
    ),
    updateSettings: (data) => api.put('/notifications/settings', data),
    delete: (id) => api.delete(`/notifications/${id}`)
};

// Permissions API
export const permissionsAPI = {
    getAll: () => withFallback(
        () => api.get('/permissions'),
        () => ({ permissions: [], grouped: {} })
    ),
    getRoles: () => withFallback(
        () => api.get('/permissions/roles'),
        () => []
    ),
    getRolePermissions: (roleId) => api.get(`/permissions/roles/${roleId}/permissions`),
    getUserRoles: (userId) => api.get(`/permissions/user/${userId}/roles`),
    getUserPermissions: (userId) => api.get(`/permissions/user/${userId}/permissions`),
    checkPermission: (code) => api.get(`/permissions/check/${code}`),
    assignRole: (userId, roleId) => api.post(`/permissions/user/${userId}/roles/${roleId}`),
    removeRole: (userId, roleId) => api.delete(`/permissions/user/${userId}/roles/${roleId}`),
    createRole: (data) => api.post('/permissions/roles', data),
    updateRole: (roleId, data) => api.put(`/permissions/roles/${roleId}`, data),
    deleteRole: (roleId) => api.delete(`/permissions/roles/${roleId}`)
};

// Sessions API
export const sessionsAPI = {
    getAll: () => withFallback(
        () => api.get('/sessions'),
        () => ({ sessions: [] })
    ),
    terminate: (id) => api.delete(`/sessions/${id}`),
    terminateAll: () => api.delete('/sessions'),
    terminateUser: (userId) => api.delete(`/sessions/user/${userId}`),
    getBlockedIps: () => withFallback(
        () => api.get('/sessions/blocked-ips'),
        () => ({ blockedIps: [] })
    ),
    blockIp: (data) => api.post('/sessions/block-ip', data),
    unblockIp: (ip) => api.delete(`/sessions/block-ip/${ip}`),
    getLoginAttempts: (params) => withFallback(
        () => api.get('/sessions/login-attempts', { params }),
        () => ({ attempts: [], stats: {} })
    )
};

// Two Factor Auth API
export const twoFactorAPI = {
    setup: () => api.post('/2fa/setup'),
    verify: (token) => api.post('/2fa/verify', { token }),
    disable: (token, password) => api.post('/2fa/disable', { token, password }),
    validate: (token) => api.post('/2fa/validate', { token }),
    generateBackupCodes: () => api.post('/2fa/backup-codes')
};

// Deliveries API
export const deliveriesAPI = {
    getAll: (params) => withFallback(
        () => api.get('/deliveries', { params }),
        () => ({ deliveries: ls.getItems('deliveries') || [], stats: {} })
    ),
    getById: (id) => api.get(`/deliveries/${id}`),
    create: (data) => withFallback(
        () => api.post('/deliveries', data),
        () => ls.addItemWithSync('deliveries', { ...data, status: 'pending', created_at: new Date().toISOString() })
    ),
    update: (id, data) => api.put(`/deliveries/${id}`, data),
    assign: (id, courierId) => api.post(`/deliveries/${id}/assign`, { courier_id: courierId }),
    complete: (id, data) => api.post(`/deliveries/${id}/complete`, data),
    cancel: (id, reason) => api.post(`/deliveries/${id}/cancel`, { reason }),
    delete: (id) => api.delete(`/deliveries/${id}`),
    getCouriers: () => withFallback(
        () => api.get('/deliveries/couriers'),
        () => []
    )
};

// WMS API (Warehouse Management System)
export const wmsAPI = {
    getInventories: (params) => withFallback(
        () => api.get('/wms', { params }),
        () => ls.getItems('inventories') || []
    ),
    createInventory: (data) => api.post('/wms', data),
    getInventory: (id) => api.get(`/wms/${id}`),
    startInventory: (id) => api.post(`/wms/${id}/start`),
    completeInventory: (id) => api.post(`/wms/${id}/complete`),
    updateItem: (invId, itemId, data) => api.put(`/wms/${invId}/items/${itemId}`, data),
    getBatches: (params) => api.get('/wms/batches', { params }),
    createBatch: (data) => api.post('/wms/batches', data),
    getProductBatches: (productId) => api.get(`/wms/products/${productId}/batches`),
    getLocations: (warehouseId, params) => api.get(`/wms/warehouses/${warehouseId}/locations`, { params }),
    createLocation: (warehouseId, data) => api.post(`/wms/warehouses/${warehouseId}/locations`, data),
    placeItem: (locationId, data) => api.post(`/wms/locations/${locationId}/place`, data),
    getAllLocations: (params) => api.get('/wms/locations', { params }),
    saveLocation: (data) => api.post('/wms/locations', data),
    updateLocation: (id, data) => api.put(`/wms/locations/${id}`, data),
    deleteLocation: (id) => api.delete(`/wms/locations/${id}`)
};

// Scheduler API
export const schedulerAPI = {
    getStatus: () => withFallback(
        () => api.get('/scheduler/status'),
        () => ({ running: false, settings: {} })
    ),
    getTasks: () => withFallback(
        () => api.get('/scheduler/tasks'),
        () => ({ tasks: [] })
    ),
    getTask: (id) => api.get(`/scheduler/tasks/${id}`),
    createTask: (data) => api.post('/scheduler/tasks', data),
    updateTask: (id, data) => api.put(`/scheduler/tasks/${id}`, data),
    deleteTask: (id) => api.delete(`/scheduler/tasks/${id}`),
    trigger: () => api.post('/scheduler/trigger'),
    triggerSync: (data) => api.post('/scheduler/trigger', data),
    reload: () => api.post('/scheduler/reload'),
    stop: () => api.post('/scheduler/stop')
};

// Customers API
export const customersAPI = {
    getAll: (params) => withFallback(
        () => api.get('/customers', { params }),
        () => ({ customers: ls.getItems('customers') || [], total: 0 })
    ),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => withFallback(
        () => api.post('/customers', data),
        () => ({ success: true, customer: ls.addItemWithSync('customers', data) })
    ),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getLoyalty: (id) => api.get(`/customers/${id}/loyalty`),
    addLoyaltyPoints: (id, points) => api.post(`/customers/${id}/loyalty/add`, { points }),
    getDeposits: (id) => withFallback(
        () => api.get(`/customers/${id}/deposits`),
        () => ({ transactions: [], deposits: [] })
    ),
    topUp: (id, data) => api.post(`/customers/${id}/deposits`, data)
};

// Extended API (Serials, Bundles, Installments, etc.)
export const extendedAPI = {
    // Serial Numbers
    getSerialProducts: () => withFallback(
        () => api.get('/extended/serials/products'),
        () => ({ products: [] })
    ),
    getSerials: (productId, params) => withFallback(
        () => api.get(`/extended/serials/${productId}`, { params }),
        () => ({ serials: [] })
    ),
    addSerials: (data) => api.post('/extended/serials', data),
    addSerialsToProduct: (productId, data) => api.post(`/extended/serials/${productId}`, data),

    // Bundles
    getBundles: () => withFallback(
        () => api.get('/extended/bundles'),
        () => ({ bundles: [] })
    ),
    createBundle: (data) => api.post('/extended/bundles', data),
    updateBundle: (id, data) => api.put(`/extended/bundles/${id}`, data),
    deleteBundle: (id) => api.delete(`/extended/bundles/${id}`),

    // Installments
    getInstallments: () => withFallback(
        () => api.get('/extended/installments'),
        () => ({ installments: [], plans: [] })
    ),
    getInstallmentPlans: () => withFallback(
        () => api.get('/extended/installments/plans'),
        () => ({ plans: [] })
    ),
    createInstallment: (data) => api.post('/extended/installments', data),
    getCustomerInstallments: (customerId) => api.get(`/extended/installments/${customerId}`),

    // Gift Certificates
    getGiftCertificates: () => withFallback(
        () => api.get('/extended/gift-certificates'),
        () => ({ certificates: [] })
    ),
    createGiftCertificate: (data) => api.post('/extended/gift-certificates', data),
    redeemGiftCertificate: (code, amount, saleId) => api.post('/extended/gift-certificates/redeem', { code, amount, sale_id: saleId }),

    // Referral Program
    getReferralSettings: () => withFallback(
        () => api.get('/extended/referral/settings'),
        () => ({ settings: {} })
    ),
    updateReferralSettings: (data) => api.put('/extended/referral/settings', data),
    getReferralStats: () => withFallback(
        () => api.get('/extended/referral/stats'),
        () => ({ stats: {} })
    )
};

// Settings API
export const settingsAPI = {
    getAll: () => withFallback(
        () => api.get('/settings'),
        () => ({ settings: ls.getItems('settings') || {} })
    ),
    update: (data) => api.put('/settings', data),
    getByKey: (key) => api.get(`/settings/${key}`),
    updateByKey: (key, value) => api.put(`/settings/${key}`, { value }),
    getReceipt: () => withFallback(
        () => api.get('/settings/receipt'),
        () => ({ settings: {} })
    ),
    updateReceipt: (data) => api.put('/settings/receipt', data)
};

// Contracts API
export const contractsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/contracts', { params }),
        () => ({ contracts: ls.getItems('contracts') || [] })
    ),
    getById: (id) => api.get(`/contracts/${id}`),
    create: (data) => withFallback(
        () => api.post('/contracts', data),
        () => ({ success: true, contract: ls.addItemWithSync('contracts', data) })
    ),
    update: (id, data) => api.put(`/contracts/${id}`, data),
    delete: (id) => api.delete(`/contracts/${id}`)
};

// Documents API
export const documentsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/documents', { params }),
        () => ({ documents: [] })
    ),
    getById: (id) => api.get(`/documents/${id}`),
    create: (data) => api.post('/documents', data),
    update: (id, data) => api.put(`/documents/${id}`, data),
    delete: (id) => api.delete(`/documents/${id}`),
    download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
    sign: (id, data) => api.post(`/documents/${id}/sign`, data)
};

// EDS (Electronic Digital Signature) API
export const edsAPI = {
    getCertificates: () => withFallback(
        () => api.get('/eds/certificates'),
        () => ({ certificates: [] })
    ),
    uploadCertificate: (formData) => api.post('/eds/certificates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteCertificate: (id) => api.delete(`/eds/certificates/${id}`),
    getSignatures: () => withFallback(
        () => api.get('/eds/signatures'),
        () => ({ signatures: [] })
    ),
    signDocument: (formData) => api.post('/eds/sign', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    verifySignature: (id) => api.get(`/eds/signatures/${id}/verify`),
    downloadSigned: (id) => api.get(`/eds/signatures/${id}/download`, { responseType: 'blob' }),
    // ЭДО — Документооборот между организациями
    sendDocument: (formData) => api.post('/eds/documents/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getOutgoing: () => withFallback(
        () => api.get('/eds/documents/outgoing'),
        () => ({ documents: [] })
    ),
    getIncoming: () => withFallback(
        () => api.get('/eds/documents/incoming'),
        () => ({ documents: [] })
    ),
    acceptDocument: (id) => api.put(`/eds/documents/${id}/accept`),
    rejectDocument: (id, reason) => api.put(`/eds/documents/${id}/reject`, { reason }),
    downloadDocument: (id) => api.get(`/eds/documents/${id}/download`, { responseType: 'blob' }),
    getDocStats: () => withFallback(
        () => api.get('/eds/documents/stats'),
        () => ({ newIncoming: 0 })
    ),
    counterSignDocument: (id, data) => api.put(`/eds/documents/${id}/sign`, data)
};

// System API
export const systemAPI = {
    getInfo: () => withFallback(
        () => api.get('/system/info'),
        () => ({ version: '1.0', status: 'offline' })
    ),
    getHealth: () => api.get('/health'),
    getLogs: (params) => api.get('/system/logs', { params }),
    clearCache: () => api.post('/system/cache/clear'),
    getBackups: () => withFallback(
        () => api.get('/backup'),
        () => ({ backups: [] })
    ),
    createBackup: () => api.post('/backup'),
    restoreBackup: (id) => api.post(`/backup/${id}/restore`),
    deleteBackup: (id) => api.delete(`/backup/${id}`)
};

// Audit API
export const auditAPI = {
    getAll: (params) => withFallback(
        () => api.get('/audit', { params }),
        () => ({ logs: [], total: 0 })
    ),
    getById: (id) => api.get(`/audit/${id}`),
    getStats: (params) => api.get('/audit/stats', { params })
};

// Users API
export const usersAPI = {
    getAll: (params) => withFallback(
        () => api.get('/users', { params }),
        () => ({ users: [] })
    ),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    resetPassword: (id) => api.post(`/users/${id}/reset-password`)
};

// Export API
export const exportAPI = {
    exportData: (type, params) => api.get(`/export/${type}`, { params, responseType: 'blob' }),
    importData: (type, data) => api.post(`/export/import/${type}`, data)
};

// Sync API
export const syncAPI = {
    getStatus: () => withFallback(
        () => api.get('/sync-status'),
        () => ({ status: 'offline', lastSync: null })
    ),
    sync1c: (data) => api.post('/sync1c', data),
    get1cStatus: () => api.get('/sync1c/status'),
    triggerByType: (syncType, data) => api.post(`/sync-status/trigger/${syncType}`, data),
    saveGoogleSheetsSettings: (data) => api.post('/sync/google-sheets/settings', data),
    testGoogleSheets: (data) => api.post('/sync/google-sheets/test', data),
    triggerSync: (data) => api.post('/sync/trigger', data)
};

// Database API
export const databaseAPI = {
    getStats: () => api.get('/database/stats'),
    optimize: () => api.post('/database/optimize'),
    migrate: () => api.post('/database/migrate')
};

// Licensing API
export const licensingAPI = {
    getStatus: () => withFallback(
        () => api.get('/licensing/status'),
        () => ({ valid: true, type: 'demo' })
    ),
    activate: (key) => api.post('/licensing/activate', { key }),
    deactivate: () => api.post('/licensing/deactivate')
};

// Organizations API
export const organizationsAPI = {
    getAll: () => withFallback(
        () => api.get('/organizations'),
        () => ({ organizations: [] })
    ),
    getById: (id) => api.get(`/organizations/${id}`),
    create: (data) => api.post('/organizations', data),
    update: (id, data) => api.put(`/organizations/${id}`, data)
};

// Updates API
export const updatesAPI = {
    check: () => api.get('/updates/check'),
    install: (version) => api.post('/updates/install', { version }),
    getHistory: () => api.get('/updates/history')
};

// Alerts API
export const alertsAPI = {
    getAll: (params) => withFallback(
        () => api.get('/alerts', { params }),
        () => ({ alerts: [] })
    ),
    create: (data) => api.post('/alerts', data),
    acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
    delete: (id) => api.delete(`/alerts/${id}`)
};

// Barcode API
export const barcodeAPI = {
    generate: (data) => api.post('/barcode/generate', data),
    lookup: (code) => api.get(`/barcode/lookup/${code}`),
    print: (data) => api.post('/barcode/print', data)
};

// SMS Campaigns API
export const smsCampaignsAPI = {
    getAll: () => withFallback(
        () => api.get('/extended/sms'),
        () => ({ campaigns: [] })
    ),
    create: (data) => api.post('/extended/sms', data),
    send: (id) => api.post(`/extended/sms/${id}/send`),
    delete: (id) => api.delete(`/extended/sms/${id}`)
};

// Telegram Bot API
export const telegramAPI = {
    getBotSettings: () => api.get('/telegram/bot-settings'),
    saveBotSettings: (botToken) => api.post('/telegram/bot-settings', { botToken }),
    deleteBotSettings: () => api.delete('/telegram/bot-settings'),
    setupWebhook: (webhookBaseUrl) => api.post('/telegram/setup-webhook', { webhookBaseUrl }),
    testMessage: (message) => api.post('/telegram/test-message', { message }),
    getChats: () => api.get('/telegram/chats'),
    deleteChat: (id) => api.delete(`/telegram/chats/${id}`)
};

// Payables API (кредиторская задолженность)
export const payablesAPI = {
    getAll: () => api.get('/finance/payables'),
    recordPayment: (creditorId, amount) => api.post(`/finance/payables/${creditorId}/payment`, { amount })
};

// Receivables API (дебиторская задолженность)
export const receivablesAPI = {
    getAll: () => api.get('/finance/receivables'),
    recordPayment: (debtorId, amount) => api.post(`/finance/receivables/${debtorId}/payment`, { amount }),
    getReconciliationReport: () => api.get('/finance/receivables/reconciliation-report', { responseType: 'blob' })
};

// Sync 1C API
export const sync1CAPI = {
    getSettings: () => withFallback(
        () => api.get('/sync1c/settings'),
        () => ({ settings: {} })
    ),
    saveSettings: (data) => api.put('/sync1c/settings', data),
    getLog: (params) => withFallback(
        () => api.get('/sync1c/log', { params }),
        () => ({ log: [] })
    ),
    getOverview: () => withFallback(
        () => api.get('/sync-status/overview'),
        () => ({ overview: {} })
    ),
    testConnection: (data) => api.post('/sync1c/test-connection', data),
    triggerSync: (module) => api.post('/sync1c/trigger', { module }),
    getStatus: () => api.get('/sync1c/status'),
    triggerSyncByType: (syncType, data) => api.post(`/sync-status/trigger/${syncType}`, data),
    importCategories: (data) => api.post('/sync1c/import/categories', data),
    importProducts: (data) => api.post('/sync1c/import/products', data)
};




// Payroll API
export const payrollAPI = {
    getAll: (params) => withFallback(
        () => api.get('/payroll', { params }),
        () => ({ payroll: [], stats: {} })
    ),
    getById: (id) => api.get(`/payroll/${id}`),
    create: (data) => api.post('/payroll', data),
    update: (id, data) => api.put(`/payroll/${id}`, data),
    pay: (id) => api.post(`/payroll/${id}/pay`),
    massCalculate: (data) => api.post('/payroll/mass-calculate', data),
    delete: (id) => api.delete(`/payroll/${id}`)
};

// ======== ADMIN API ========


export const usersAdminAPI = {
    getAll: (params) => withFallback(
        () => api.get('/users', { params }),
        () => ({ users: [] })
    ),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    resetPassword: (id) => api.post(`/users/${id}/reset-password`),
    getRoles: () => withFallback(
        () => api.get('/users/roles'),
        () => ([])
    ),
    getAuditLog: (params) => withFallback(
        () => api.get('/users/audit-log', { params }),
        () => ({ logs: [] })
    )
};

export const systemAdminAPI = {
    getMetrics: () => withFallback(
        () => api.get('/system/metrics'),
        () => ({ cpu: { usage: 0 }, memory: { usagePercent: 0 }, database: {} })
    ),
    getMetricsHistory: (hours) => api.get('/system/metrics/history', { params: { hours } }),
    getConnections: () => withFallback(
        () => api.get('/system/connections'),
        () => ({ websocket: 0 })
    ),
    getServices: () => withFallback(
        () => api.get('/system/services'),
        () => ({ services: { database: { status: 'unknown' }, redis: { status: 'unknown' } } })
    ),
    getLogs: (params) => withFallback(
        () => api.get('/system/logs', { params }),
        () => ({ logs: [] })
    )
};

export const backupAdminAPI = {
    getAll: () => withFallback(
        () => api.get('/backup'),
        () => ({ backups: [] })
    ),
    create: (data) => api.post('/backup', data),
    restore: (id) => api.post(`/backup/${id}/restore`),
    delete: (id) => api.delete(`/backup/${id}`),
    getSchedule: () => withFallback(
        () => api.get('/backup/schedule'),
        () => ({ schedule: {} })
    ),
    updateSchedule: (data) => api.put('/backup/schedule', data)
};


export const databaseAdminAPI = {
    getInfo: () => withFallback(
        () => api.get('/database/info'),
        () => ({ tables: [], size: '0 MB' })
    ),
    optimize: () => api.post('/database/optimize'),
    vacuum: () => api.post('/database/vacuum'),
    getTableStats: () => withFallback(
        () => api.get('/database/tables'),
        () => ({ tables: [] })
    )
};

export const licenseAdminAPI = {
    getAll: (params) => withFallback(
        () => api.get('/license/admin/licenses', { params }),
        () => ({ licenses: [] })
    ),
    create: (data) => api.post('/license/admin/licenses', data),
    update: (id, data) => api.put(`/license/admin/licenses/${id}`, data),
    delete: (id) => api.delete(`/license/${id}`),
    getHistory: (params) => withFallback(
        () => api.get('/license/admin/history', { params }),
        () => ({ history: [] })
    ),
    resetCredentials: (id, data) => api.post(`/license/admin/licenses/${id}/reset-credentials`, data),
    deleteAll: () => api.delete('/license/all/cleanup')
};

// Экспорт состояния офлайн-режима
export const getOfflineStatus = () => isOfflineMode;
export const setOfflineMode = (value) => { isOfflineMode = value; };
export const checkOnlineStatus = checkServerAvailability;
export const forceSync = async () => {
    const isOnline = await checkServerAvailability();
    if (isOnline) {
        try {
            const { syncPendingChanges } = await import('./syncService');
            await syncPendingChanges();
            return { success: true, message: 'Синхронизация завершена' };
        } catch (e) {
            return { success: false, message: 'Ошибка синхронизации: ' + e.message };
        }
    }
    return { success: false, message: 'Сервер недоступен' };
};


export default api;
