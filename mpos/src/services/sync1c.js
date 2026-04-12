import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import OfflineCatalogService from './offlineCatalog';

const LAST_PRODUCT_SYNC_KEY = 'last_product_sync';
const LAST_INVENTORY_SYNC_KEY = 'last_inventory_sync';

/**
 * Сервис синхронизации с 1С / локальным сервером
 * Поддерживает умную дельта-синхронизацию и экспорт продаж
 */
class Sync1CService {
    static syncInProgress = false;
    static lastSyncTime = null;
    static onSyncStatusChange = null;

    /**
     * Дельта-импорт товаров — загружает только изменённые с момента последней синхронизации
     */
    static async importProducts() {
        if (this.syncInProgress) return { success: false, message: 'Синхронизация уже выполняется' };

        this.syncInProgress = true;
        this.notifyStatus('importing', 'Импорт товаров...');

        try {
            // Получить метку времени последней синхронизации
            const lastSync = await AsyncStorage.getItem(LAST_PRODUCT_SYNC_KEY);

            // Сделать дельта-запрос
            const response = await api.get('/sync/products/delta', {
                params: lastSync ? { since: lastSync } : {}
            });

            const products = response.data.products || [];
            const count = response.data.count || products.length;
            const serverTime = response.data.server_time || new Date().toISOString();

            if (products.length > 0) {
                // Обновить/добавить только изменившиеся товары в кэш
                if (lastSync) {
                    // Дельта: мержим с существующим кэшем
                    await OfflineCatalogService.mergeDeltaProducts(products);
                } else {
                    // Первый запуск: полная синхронизация
                    await OfflineCatalogService.syncProducts(products);
                }
                this.notifyStatus('success', `Обновлено ${count} товаров`);
            } else {
                this.notifyStatus('success', 'Товары актуальны');
            }

            // Сохранить метку времени для следующей дельты
            await AsyncStorage.setItem(LAST_PRODUCT_SYNC_KEY, serverTime);
            this.lastSyncTime = new Date();

            return { success: true, count, delta: !!lastSync };
        } catch (error) {
            console.error('[Sync1C] Import error:', error);
            // Fallback: попробовать полный список товаров
            try {
                const fallbackRes = await api.get('/products', { params: { active: true } });
                const products = fallbackRes.data.products || [];
                await OfflineCatalogService.syncProducts(products);
                await AsyncStorage.setItem(LAST_PRODUCT_SYNC_KEY, new Date().toISOString());
                this.notifyStatus('success', `Загружено ${products.length} товаров (fallback)`);
                return { success: true, count: products.length, delta: false };
            } catch (fallbackErr) {
                this.notifyStatus('error', 'Ошибка импорта товаров');
                return { success: false, message: error.message };
            }
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Дельта-импорт остатков
     */
    static async importInventory() {
        try {
            const lastSync = await AsyncStorage.getItem(LAST_INVENTORY_SYNC_KEY);
            const response = await api.get('/sync/inventory/delta', {
                params: lastSync ? { since: lastSync } : {}
            });

            const inventory = response.data.inventory || [];
            const serverTime = response.data.server_time || new Date().toISOString();

            if (inventory.length > 0) {
                await OfflineCatalogService.mergeInventory(inventory);
            }

            await AsyncStorage.setItem(LAST_INVENTORY_SYNC_KEY, serverTime);
            return { success: true, count: inventory.length };
        } catch (error) {
            console.error('[Sync1C] Inventory import error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Синхронизация категорий — кэшируем полный список
     */
    static async importCategories() {
        try {
            const response = await api.get('/categories');
            const categories = response.data.categories || response.data || [];
            if (categories.length > 0) {
                await OfflineCatalogService.syncCategories(categories);
            }
            return { success: true, count: categories.length };
        } catch (error) {
            console.error('[Sync1C] Categories import error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Экспорт офлайн-продаж на сервер
     */
    static async exportSales() {
        if (this.syncInProgress) return { success: false, message: 'Синхронизация уже выполняется' };

        this.syncInProgress = true;
        this.notifyStatus('exporting', 'Экспорт продаж...');

        try {
            const pendingSales = await OfflineCatalogService.getPendingSales();

            if (pendingSales.length === 0) {
                this.notifyStatus('success', 'Нет продаж для экспорта');
                this.syncInProgress = false;
                return { success: true, count: 0 };
            }

            let exported = 0;
            for (const sale of pendingSales) {
                try {
                    await api.post('/sales', sale.data);
                    await OfflineCatalogService.markSaleSynced(sale.id);
                    exported++;
                } catch (err) {
                    console.error('[Sync1C] Export sale error:', err);
                }
            }

            this.lastSyncTime = new Date();
            this.notifyStatus('success', `Экспортировано ${exported} продаж`);
            return { success: true, count: exported };
        } catch (error) {
            console.error('[Sync1C] Export error:', error);
            this.notifyStatus('error', 'Ошибка экспорта');
            return { success: false, message: error.message };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Полная синхронизация: дельта товары + дельта остатки + экспорт продаж
     */
    static async fullSync() {
        const [importResult, inventoryResult, exportResult] = await Promise.allSettled([
            this.importProducts(),
            this.importInventory(),
            this.exportSales()
        ]);

        return {
            success: importResult.status === 'fulfilled' && importResult.value?.success,
            imported: importResult.value?.count || 0,
            inventory: inventoryResult.value?.count || 0,
            exported: exportResult.value?.count || 0,
        };
    }

    /**
     * Быстрая фоновая синхронизация (при возврате приложения из фона)
     * Не загружает интерфейс — работает тихо
     */
    static async backgroundSync() {
        if (this.syncInProgress) return;
        try {
            await Promise.allSettled([
                this.importProducts(),
                this.importInventory(),
                this.importCategories(),
            ]);
            // Экспорт офлайн продаж после возврата онлайн
            const pendingSales = await OfflineCatalogService.getPendingSales?.() || [];
            if (pendingSales.length > 0) {
                await this.exportSales();
            }
        } catch (e) {
            console.log('[Sync1C] Background sync error (non-critical):', e.message);
        }
    }

    /**
     * Сбросить метки дельта-синхронизации (принудить полную перезагрузку)
     */
    static async resetSyncTimestamps() {
        await AsyncStorage.removeItem(LAST_PRODUCT_SYNC_KEY);
        await AsyncStorage.removeItem(LAST_INVENTORY_SYNC_KEY);
        console.log('[Sync1C] Sync timestamps reset — next sync will be full');
    }

    static getStatus() {
        return { inProgress: this.syncInProgress, lastSync: this.lastSyncTime };
    }

    static notifyStatus(status, message) {
        console.log(`[Sync1C] ${status}: ${message}`);
        if (this.onSyncStatusChange) this.onSyncStatusChange({ status, message });
    }

    static setStatusCallback(callback) {
        this.onSyncStatusChange = callback;
    }
}

export default Sync1CService;
