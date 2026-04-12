/**
 * LocalStorage Service - офлайн хранилище данных
 * Используется как fallback когда бэкенд недоступен
 */

const STORAGE_PREFIX = '1c_accounting_';

// Генерация уникального ID
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Генерация EAN-13 штрих-кода
export const generateBarcode = () => {
    // EAN-13: 12 цифр + контрольная сумма
    let code = '200'; // 200-299 для внутреннего использования
    for (let i = 0; i < 9; i++) {
        code += Math.floor(Math.random() * 10);
    }

    // Вычисление контрольной суммы EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    return code + checkDigit;
};

// Генерация кода товара
export const generateProductCode = () => {
    const prefix = 'PRD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
};

// Получить все элементы из хранилища
export const getItems = (key) => {
    try {
        const data = localStorage.getItem(STORAGE_PREFIX + key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`[LocalStorage] Error reading ${key}:`, error);
        return [];
    }
};

// Сохранить все элементы
export const setItems = (key, items) => {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(items));
        return true;
    } catch (error) {
        console.error(`[LocalStorage] Error saving ${key}:`, error);
        return false;
    }
};

// Добавить новый элемент
export const addItem = (key, item) => {
    const items = getItems(key);
    const newItem = {
        ...item,
        id: item.id || generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    items.unshift(newItem);
    setItems(key, items);
    return newItem;
};

// Обновить элемент
export const updateItem = (key, id, data) => {
    const items = getItems(key);
    const index = items.findIndex(item => item.id === id || item.id === parseInt(id));
    if (index !== -1) {
        items[index] = {
            ...items[index],
            ...data,
            updated_at: new Date().toISOString()
        };
        setItems(key, items);
        return items[index];
    }
    return null;
};

// Удалить элемент
export const deleteItem = (key, id) => {
    const items = getItems(key);
    const filtered = items.filter(item => item.id !== id && item.id !== parseInt(id));
    setItems(key, filtered);
    return filtered.length < items.length;
};

// Получить один элемент по ID
export const getItemById = (key, id) => {
    const items = getItems(key);
    return items.find(item => item.id === id || item.id === parseInt(id)) || null;
};

// Поиск элементов
export const searchItems = (key, searchTerm, fields = ['name']) => {
    const items = getItems(key);
    if (!searchTerm) return items;

    const term = searchTerm.toLowerCase();
    return items.filter(item =>
        fields.some(field =>
            item[field] && item[field].toString().toLowerCase().includes(term)
        )
    );
};

// Инициализация данных — больше не создаёт демо-данные
export const initDemoData = () => {
    // No-op: демо-данные удалены для production
    console.log('[LocalStorage] Ready (no demo data)');
};

// Экспорт всех данных (для бэкапа)
export const exportAllData = () => {
    const keys = ['products', 'counterparties', 'warehouses', 'accounts', 'sales', 'purchases', 'invoices'];
    const data = {};
    keys.forEach(key => {
        data[key] = getItems(key);
    });
    return data;
};

// Импорт данных
export const importData = (data) => {
    Object.keys(data).forEach(key => {
        setItems(key, data[key]);
    });
};

// ============================================
// SYNC QUEUE - Очередь синхронизации
// ============================================

const SYNC_QUEUE_KEY = 'sync_queue';

// Добавить операцию в очередь синхронизации
export const addToSyncQueue = (operation, entityType, entityId, data) => {
    const queue = getItems(SYNC_QUEUE_KEY);
    const queueItem = {
        id: generateId(),
        operation, // 'create', 'update', 'delete'
        entityType, // 'products', 'counterparties', 'warehouses', etc.
        entityId,
        data,
        timestamp: new Date().toISOString(),
        synced: false
    };
    queue.push(queueItem);
    setItems(SYNC_QUEUE_KEY, queue);
    console.log(`[SyncQueue] Added ${operation} for ${entityType}:${entityId}`);
    return queueItem;
};

// Получить очередь синхронизации
export const getSyncQueue = () => {
    return getItems(SYNC_QUEUE_KEY).filter(item => !item.synced);
};

// Пометить как синхронизированное
export const markSynced = (queueItemId) => {
    const queue = getItems(SYNC_QUEUE_KEY);
    const index = queue.findIndex(item => item.id === queueItemId);
    if (index !== -1) {
        queue[index].synced = true;
        queue[index].syncedAt = new Date().toISOString();
        setItems(SYNC_QUEUE_KEY, queue);
        return true;
    }
    return false;
};

// Очистить синхронизированные элементы
export const clearSyncedItems = () => {
    const queue = getItems(SYNC_QUEUE_KEY);
    const pending = queue.filter(item => !item.synced);
    setItems(SYNC_QUEUE_KEY, pending);
    return pending.length;
};

// Получить количество pending изменений
export const getPendingCount = () => {
    return getSyncQueue().length;
};

// Добавить элемент С записью в sync queue
export const addItemWithSync = (key, item) => {
    const newItem = addItem(key, item);
    addToSyncQueue('create', key, newItem.id, newItem);
    return newItem;
};

// Обновить элемент С записью в sync queue
export const updateItemWithSync = (key, id, data) => {
    const updated = updateItem(key, id, data);
    if (updated) {
        addToSyncQueue('update', key, id, updated);
    }
    return updated;
};

// Удалить элемент С записью в sync queue
export const deleteItemWithSync = (key, id) => {
    const item = getItemById(key, id);
    const deleted = deleteItem(key, id);
    if (deleted && item) {
        addToSyncQueue('delete', key, id, item);
    }
    return deleted;
};

export default {
    generateId,
    generateBarcode,
    generateProductCode,
    getItems,
    setItems,
    addItem,
    updateItem,
    deleteItem,
    getItemById,
    searchItems,
    initDemoData,
    exportAllData,
    importData,
    // Sync queue functions
    addToSyncQueue,
    getSyncQueue,
    markSynced,
    clearSyncedItems,
    getPendingCount,
    addItemWithSync,
    updateItemWithSync,
    deleteItemWithSync
};
