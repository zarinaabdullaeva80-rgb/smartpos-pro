/**
 * usePWA - хук для работы с PWA функциями
 * - Регистрация Service Worker
 * - Установка приложения
 * - Проверка обновлений
 */

import { useState, useEffect, useCallback } from 'react';

export function usePWA() {
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [swRegistration, setSwRegistration] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    // Регистрация Service Worker
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration);
                    setSwRegistration(registration);

                    // Проверка обновлений каждый час
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000);
                })
                .catch((error) => {
                    console.error('SW registration failed:', error);
                });
        }
    }, []);

    // Отслеживание онлайн/офлайн статуса
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Обработка события установки
    useEffect(() => {
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Проверка, установлено ли приложение
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    // Функция установки
    const installApp = useCallback(async () => {
        if (!deferredPrompt) {
            console.log('No installation prompt available');
            return false;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstalled(true);
        }

        setDeferredPrompt(null);
        setIsInstallable(false);

        return outcome === 'accepted';
    }, [deferredPrompt]);

    // Проверка обновлений
    const checkForUpdates = useCallback(async () => {
        if (swRegistration) {
            await swRegistration.update();
            return true;
        }
        return false;
    }, [swRegistration]);

    // Синхронизация данных в фоне
    const syncData = useCallback(async (tag = 'sync-sales') => {
        if (swRegistration && 'sync' in swRegistration) {
            try {
                await swRegistration.sync.register(tag);
                return true;
            } catch (error) {
                console.error('Background sync failed:', error);
                return false;
            }
        }
        return false;
    }, [swRegistration]);

    return {
        isInstallable,
        isInstalled,
        isOnline,
        installApp,
        checkForUpdates,
        syncData
    };
}

export default usePWA;
