/**
 * Sync Service - Сервис синхронизации
 * Автоматически синхронизирует офлайн-изменения с сервером
 */

import {
    getSyncQueue,
    markSynced,
    clearSyncedItems,
    getPendingCount
} from './localStorageService';
import { getApiUrl } from '../config/settings';
import axios from 'axios';

const getBaseUrl = () => getApiUrl();
const CHECK_INTERVAL = 30000; // Проверять каждые 30 секунд

// Состояние синхронизации
let isOnline = false;
let isSyncing = false;
let syncListeners = [];
let checkIntervalId = null;

// API endpoints для разных сущностей
const API_ENDPOINTS = {
    products: '/products',
    counterparties: '/counterparties',
    warehouses: '/warehouses',
    accounts: '/finance/accounts',
    sales: '/sales',
    purchases: '/purchases',
    invoices: '/invoices'
};

// Проверка доступности сервера
export const checkServerStatus = async () => {
    try {
        const response = await axios.get(`${getBaseUrl()}/health`, {
            timeout: 5000
        });
        const wasOffline = !isOnline;
        isOnline = response.status === 200;

        if (wasOffline && isOnline) {
            console.log('[Sync] Server is back online! Starting sync...');
            notifyListeners({ type: 'online' });
            await syncAll();
        }

        return isOnline;
    } catch (error) {
        if (isOnline) {
            console.log('[Sync] Server went offline');
            notifyListeners({ type: 'offline' });
        }
        isOnline = false;
        return false;
    }
};

// Получить статус онлайн/офлайн
export const getOnlineStatus = () => isOnline;

// Получить статус синхронизации
export const getSyncStatus = () => ({
    isOnline,
    isSyncing,
    pendingCount: getPendingCount()
});

// Синхронизировать один элемент из очереди
const syncQueueItem = async (item) => {
    const { operation, entityType, entityId, data } = item;
    const endpoint = API_ENDPOINTS[entityType];

    if (!endpoint) {
        console.warn(`[Sync] Unknown entity type: ${entityType}`);
        return false;
    }

    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        switch (operation) {
            case 'create':
                await axios.post(`${getBaseUrl()}${endpoint}`, data, { headers });
                break;
            case 'update':
                await axios.put(`${getBaseUrl()}${endpoint}/${entityId}`, data, { headers });
                break;
            case 'delete':
                await axios.delete(`${getBaseUrl()}${endpoint}/${entityId}`, { headers });
                break;
            default:
                console.warn(`[Sync] Unknown operation: ${operation}`);
                return false;
        }

        console.log(`[Sync] Synced: ${operation} ${entityType}:${entityId}`);
        return true;
    } catch (error) {
        console.error(`[Sync] Failed: ${operation} ${entityType}:${entityId}`, error.message);
        return false;
    }
};

// Синхронизировать все pending изменения
export const syncAll = async () => {
    if (isSyncing) {
        console.log('[Sync] Already syncing, skipping...');
        return { synced: 0, failed: 0 };
    }

    if (!isOnline) {
        console.log('[Sync] Offline, cannot sync');
        return { synced: 0, failed: 0, offline: true };
    }

    const queue = getSyncQueue();
    if (queue.length === 0) {
        console.log('[Sync] No pending changes');
        return { synced: 0, failed: 0 };
    }

    isSyncing = true;
    notifyListeners({ type: 'syncStart', pending: queue.length });

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
        const success = await syncQueueItem(item);
        if (success) {
            markSynced(item.id);
            synced++;
        } else {
            failed++;
        }
        notifyListeners({ type: 'syncProgress', synced, failed, total: queue.length });
    }

    clearSyncedItems();
    isSyncing = false;

    notifyListeners({ type: 'syncComplete', synced, failed });
    console.log(`[Sync] Complete: ${synced} synced, ${failed} failed`);

    return { synced, failed };
};

// Подписаться на события синхронизации
export const addSyncListener = (listener) => {
    syncListeners.push(listener);
    return () => {
        syncListeners = syncListeners.filter(l => l !== listener);
    };
};

// Уведомить всех слушателей
const notifyListeners = (event) => {
    syncListeners.forEach(listener => {
        try {
            listener(event);
        } catch (e) {
            console.error('[Sync] Listener error:', e);
        }
    });
};

// Запустить автоматическую синхронизацию
export const startAutoSync = () => {
    if (checkIntervalId) {
        console.log('[Sync] Auto-sync already running');
        return;
    }

    console.log('[Sync] Starting auto-sync...');

    // Первичная проверка
    checkServerStatus();

    // Периодическая проверка
    checkIntervalId = setInterval(checkServerStatus, CHECK_INTERVAL);
};

// Остановить автоматическую синхронизацию
export const stopAutoSync = () => {
    if (checkIntervalId) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
        console.log('[Sync] Auto-sync stopped');
    }
};

// Ручная синхронизация
export const manualSync = async () => {
    await checkServerStatus();
    if (isOnline) {
        return await syncAll();
    }
    return { synced: 0, failed: 0, offline: true };
};

export default {
    checkServerStatus,
    getOnlineStatus,
    getSyncStatus,
    syncAll,
    addSyncListener,
    startAutoSync,
    stopAutoSync,
    manualSync
};
