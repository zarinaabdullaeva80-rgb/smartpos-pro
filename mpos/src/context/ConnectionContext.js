import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/settings';
import { OfflineManager } from '../services/offline';
import OfflineCatalogService from '../services/offlineCatalog';

const ConnectionContext = createContext({
    isOnline: true,
    isServerReachable: true,
    connectionType: 'unknown',
    pendingSalesCount: 0,
    lastSyncTime: null,
    isSyncing: false,
    triggerSync: () => {},
});

export function useConnection() {
    return useContext(ConnectionContext);
}

// Интервал проверки сервера (мс)
const SERVER_CHECK_INTERVAL = 15000;
// Задержка перед синхронизацией после обнаружения сервера
const SYNC_DELAY = 3000;

export function ConnectionProvider({ children }) {
    const [isOnline, setIsOnline] = useState(true);
    const [isServerReachable, setIsServerReachable] = useState(true);
    const [connectionType, setConnectionType] = useState('unknown');
    const [pendingSalesCount, setPendingSalesCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const wasServerReachable = useRef(true);
    const checkIntervalRef = useRef(null);
    const appState = useRef(AppState.currentState);

    // ===== Проверка доступности сервера =====
    const checkServerReachability = useCallback(async () => {
        try {
            const apiUrl = getApiUrl();
            const healthUrl = apiUrl.replace(/\/api\/?$/, '') + '/api/health';
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
            });
            clearTimeout(timeoutId);

            const reachable = response.ok;
            setIsServerReachable(reachable);

            // Сервер стал доступен после недоступности → автосинхронизация
            if (reachable && !wasServerReachable.current) {
                console.log('[Connection] 🔄 Сервер стал доступен — запускаю автосинхронизацию...');
                setTimeout(() => syncAll(), SYNC_DELAY);
            }
            wasServerReachable.current = reachable;

            return reachable;
        } catch (error) {
            setIsServerReachable(false);
            wasServerReachable.current = false;
            return false;
        }
    }, []);

    // ===== Полная синхронизация =====
    const syncAll = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        console.log('[Connection] ▶ Начинаю полную синхронизацию...');

        try {
            // 1. Синхронизировать офлайн-продажи
            const salesResult = await OfflineManager.syncSalesQueue();
            console.log(`[Connection] ✅ Продажи: ${salesResult.success} отправлено, ${salesResult.failed} ошибок`);

            // 2. Обновить каталог товаров с сервера
            try {
                const apiUrl = getApiUrl();
                const token = await AsyncStorage.getItem('token');
                if (token) {
                    // Загрузить свежие товары
                    const productsRes = await fetch(`${apiUrl}/sync/products/delta`, {
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (productsRes.ok) {
                        const productsData = await productsRes.json();
                        if (productsData.products && productsData.products.length > 0) {
                            await OfflineCatalogService.mergeDeltaProducts(productsData.products);
                            console.log(`[Connection] ✅ Каталог: +${productsData.products.length} товаров обновлено`);
                        }
                    }

                    // Загрузить свежие остатки
                    const inventoryRes = await fetch(`${apiUrl}/sync/inventory/delta`, {
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (inventoryRes.ok) {
                        const inventoryData = await inventoryRes.json();
                        if (inventoryData.inventory && inventoryData.inventory.length > 0) {
                            await OfflineCatalogService.mergeInventory(inventoryData.inventory);
                            console.log(`[Connection] ✅ Остатки: ${inventoryData.inventory.length} позиций обновлено`);
                        }
                    }
                }
            } catch (catalogError) {
                console.warn('[Connection] ⚠ Ошибка обновления каталога:', catalogError.message);
            }

            // 3. Обновить счётчик и время
            const count = await OfflineManager.getPendingSalesCount();
            setPendingSalesCount(count);
            const now = Date.now();
            setLastSyncTime(now);
            await AsyncStorage.setItem('last_sync_time', now.toString());

            console.log('[Connection] ✅ Синхронизация завершена');
        } catch (error) {
            console.error('[Connection] ❌ Ошибка синхронизации:', error.message);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    // ===== Обновить счётчик ожидающих продаж =====
    const updatePendingCount = useCallback(async () => {
        try {
            const count = await OfflineManager.getPendingSalesCount();
            setPendingSalesCount(count);
        } catch (e) { /* ignore */ }
    }, []);

    // ===== Мониторинг сети =====
    useEffect(() => {
        // Начальная загрузка
        const init = async () => {
            const savedSync = await AsyncStorage.getItem('last_sync_time');
            if (savedSync) setLastSyncTime(parseInt(savedSync));
            await updatePendingCount();
            await checkServerReachability();
        };
        init();

        // Подписка на изменения сети
        const unsubscribe = NetInfo.addEventListener(state => {
            const online = Boolean(state.isConnected);
            setIsOnline(online);
            setConnectionType(state.type || 'unknown');

            if (online) {
                // Сеть появилась — проверяем сервер через 2 секунды
                setTimeout(checkServerReachability, 2000);
            } else {
                setIsServerReachable(false);
                wasServerReachable.current = false;
            }
        });

        // Периодическая проверка сервера
        checkIntervalRef.current = setInterval(() => {
            checkServerReachability();
            updatePendingCount();
        }, SERVER_CHECK_INTERVAL);

        // Мониторинг AppState (foreground/background)
        const appStateSubscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // Приложение вернулось на передний план — проверить сервер
                checkServerReachability();
                updatePendingCount();
            }
            appState.current = nextAppState;
        });

        return () => {
            unsubscribe();
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            appStateSubscription?.remove();
        };
    }, [checkServerReachability, updatePendingCount]);

    const value = {
        isOnline,
        isServerReachable,
        connectionType,
        pendingSalesCount,
        lastSyncTime,
        isSyncing,
        triggerSync: syncAll,
        updatePendingCount,
    };

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}

export default ConnectionContext;
