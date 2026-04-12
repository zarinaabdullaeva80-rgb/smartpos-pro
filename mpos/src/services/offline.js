import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { salesAPI } from './api';
import logger from './logger';
import { OFFLINE_CONFIG } from '../config/settings';

/**
 * Offline Manager - управление работой приложения без интернета
 * 
 * Функции:
 * - Кэширование каталога товаров
 * - Очередь неотправленных продаж
 * - Автоматическая синхронизация при восстановлении сети
 * - Мониторинг статуса соединения
 */

export class OfflineManager {
    static PRODUCTS_KEY = 'cached_products';
    static SALES_QUEUE_KEY = 'sales_queue';
    static LAST_SYNC_KEY = 'last_sync_timestamp';

    // ==================== КЭШИРОВАНИЕ ТОВАРОВ ====================

    /**
     * Сохранить товары в кэш
     * @param {Array} products - массив товаров
     */
    static async cacheProducts(products) {
        try {
            await AsyncStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
            logger.offline('Cache', `Products cached: ${products.length}`);
        } catch (error) {
            logger.error('Offline', 'Failed to cache products', error);
        }
    }

    /**
     * Получить товары из кэша
     * @returns {Array} массив товаров или пустой массив
     */
    static async getCachedProducts() {
        try {
            const cached = await AsyncStorage.getItem(this.PRODUCTS_KEY);
            if (cached) {
                const products = JSON.parse(cached);
                logger.offline('Cache', `Loaded cached products: ${products.length}`);
                return products;
            }
        } catch (error) {
            logger.error('Offline', 'Failed to load cached products', error);
        }
        return [];
    }

    // ==================== ОЧЕРЕДЬ ПРОДАЖ ====================

    /**
     * Добавить продажу в очередь
     * @param {Object} saleData - данные продажи
     */
    static async queueSale(saleData) {
        try {
            const queue = await this.getSalesQueue();
            const queueItem = {
                ...saleData,
                timestamp: Date.now(),
                synced: false,
                id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            queue.push(queueItem);
            await AsyncStorage.setItem(this.SALES_QUEUE_KEY, JSON.stringify(queue));
            logger.offline('Queue', `Sale queued: ${queueItem.id}`);
            return queueItem.id;
        } catch (error) {
            logger.error('Offline', 'Failed to queue sale', error);
            throw error;
        }
    }

    /**
     * Получить очередь продаж
     * @returns {Array} массив продаж в очереди
     */
    static async getSalesQueue() {
        try {
            const queue = await AsyncStorage.getItem(this.SALES_QUEUE_KEY);
            return queue ? JSON.parse(queue) : [];
        } catch (error) {
            console.error('[Offline] Failed to get sales queue:', error);
            return [];
        }
    }

    /**
     * Получить количество неотправленных продаж
     * @returns {Number} количество
     */
    static async getPendingSalesCount() {
        const queue = await this.getSalesQueue();
        return queue.filter(s => !s.synced).length;
    }

    // ==================== СИНХРОНИЗАЦИЯ ====================

    /**
     * Синхронизировать очередь продаж с сервером
     * @returns {Object} результат синхронизации { success: number, failed: number }
     */
    static async syncSalesQueue() {
        const queue = await this.getSalesQueue();
        const unsyncedSales = queue.filter(s => !s.synced);

        if (unsyncedSales.length === 0) {
            console.log('[Offline] No sales to sync');
            return { success: 0, failed: 0 };
        }

        console.log('[Offline] Starting sync for', unsyncedSales.length, 'sales');

        let successCount = 0;
        let failedCount = 0;
        const updatedQueue = [...queue];

        for (let i = 0; i < updatedQueue.length; i++) {
            const sale = updatedQueue[i];
            if (sale.synced) continue;

            try {
                // Отправить продажу НАПРЯМУЮ на сервер (НЕ через salesAPI.create — он бы снова поставил в очередь)
                const axios = (await import('axios')).default;
                const AsyncStorageModule = (await import('@react-native-async-storage/async-storage')).default;
                const { getApiUrl } = await import('../config/settings');
                
                const token = await AsyncStorageModule.getItem('token');
                const apiUrl = getApiUrl();
                
                // Добавляем offline_id для идемпотентности (сервер не создаст дубликат)
                const saleData = { ...sale, offline_id: sale.id };
                delete saleData.synced;
                delete saleData.syncedAt;
                delete saleData.timestamp;
                
                await axios.post(`${apiUrl}/sales`, saleData, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000,
                });

                // Пометить как синхронизированную
                updatedQueue[i] = { ...sale, synced: true, syncedAt: Date.now() };
                successCount++;

                console.log('[Offline] Synced sale:', sale.id);
            } catch (error) {
                logger.error('Sync', `Failed to sync sale: ${sale.id}`, error);
                failedCount++;
            }
        }

        // Удалить успешно синхронизированные продажи (старше 24 часов)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const filteredQueue = updatedQueue.filter(s =>
            !s.synced || (s.syncedAt && s.syncedAt > oneDayAgo)
        );

        await AsyncStorage.setItem(this.SALES_QUEUE_KEY, JSON.stringify(filteredQueue));
        await AsyncStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());

        logger.sync(`Sync completed. Success: ${successCount}, Failed: ${failedCount}`);
        return { success: successCount, failed: failedCount };
    }

    // ==================== МОНИТОРИНГ СЕТИ ====================

    /**
     * Запустить мониторинг сети и автоматическую синхронизацию
     * @param {Function} onSyncCallback - callback при успешной синхронизации
     */
    static startNetworkMonitoring(onSyncCallback) {
        logger.info('Offline', 'Starting network monitoring');

        NetInfo.addEventListener(state => {
            const isConnected = Boolean(state.isConnected);
            logger.info('Offline', `Network state changed: ${isConnected ? 'Online' : 'Offline'}`);

            if (isConnected) {
                // Подождать 2 секунды и попытаться синхронизировать
                setTimeout(async () => {
                    try {
                        const result = await this.syncSalesQueue();
                        if (result.success > 0 && onSyncCallback) {
                            onSyncCallback(result);
                        }
                    } catch (error) {
                        logger.error('Offline', 'Auto-sync failed', error);
                    }
                }, 2000);
            }
        });
    }

    /**
     * Проверить текущий статус сети
     * @returns {Boolean} true если есть интернет
     */
    static async isOnline() {
        try {
            const state = await NetInfo.fetch();
            return Boolean(state.isConnected);
        } catch (error) {
            logger.error('Offline', 'Failed to check network state', error);
            return false;
        }
    }

    /**
     * Получить время последней синхронизации
     * @returns {Number} timestamp или null
     */
    static async getLastSyncTime() {
        try {
            const timestamp = await AsyncStorage.getItem(this.LAST_SYNC_KEY);
            return timestamp ? parseInt(timestamp) : null;
        } catch (error) {
            logger.error('Offline', 'Failed to get last sync time', error);
            return null;
        }
    }

    // ==================== УТИЛИТЫ ====================

    /**
     * Очистить весь кэш (для отладки)
     */
    static async clearCache() {
        try {
            await AsyncStorage.multiRemove([
                this.PRODUCTS_KEY,
                this.SALES_QUEUE_KEY,
                this.LAST_SYNC_KEY
            ]);
            logger.info('Offline', 'Cache cleared');
        } catch (error) {
            logger.error('Offline', 'Failed to clear cache', error);
        }
    }

    /**
     * Получить статистику кэша
     * @returns {Object} статистика
     */
    static async getCacheStats() {
        const products = await this.getCachedProducts();
        const queue = await this.getSalesQueue();
        const lastSync = await this.getLastSyncTime();
        const isOnline = await this.isOnline();

        return {
            cachedProductsCount: products.length,
            pendingSalesCount: queue.filter(s => !s.synced).length,
            syncedSalesCount: queue.filter(s => s.synced).length,
            lastSyncTime: lastSync,
            isOnline
        };
    }
}

export default OfflineManager;
