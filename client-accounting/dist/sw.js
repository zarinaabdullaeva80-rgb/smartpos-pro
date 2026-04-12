/**
 * SmartPOS Pro - Service Worker
 * Обеспечивает офлайн работу приложения
 */

const CACHE_NAME = 'smartpos-v3.5';
const STATIC_CACHE = 'smartpos-static-v3.5';
const DYNAMIC_CACHE = 'smartpos-dynamic-v3.5';

// Ресурсы для предварительного кэширования
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html'
];

// API endpoints для кэширования
const API_CACHE_URLS = [
    '/api/products',
    '/api/categories',
    '/api/settings'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем не-GET запросы
    if (request.method !== 'GET') {
        return;
    }

    // API запросы - Network First
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Пропускаем мобильное приложение — у него свои ресурсы
    if (url.pathname.startsWith('/mobile/') || url.pathname.startsWith('/mobile')) {
        return;
    }

    // Статические ресурсы - Cache First
    event.respondWith(cacheFirst(request));
});

// Стратегия: Сеть сначала, потом кэш
async function networkFirst(request) {
    try {
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cached = await caches.match(request);

        if (cached) {
            return cached;
        }

        // Возвращаем офлайн страницу для навигационных запросов
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }

        throw error;
    }
}

// Стратегия: Кэш сначала, потом сеть
async function cacheFirst(request) {
    const cached = await caches.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('[SW] Fetch failed:', request.url);

        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }

        throw error;
    }
}

// Синхронизация в фоне
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-sales') {
        event.waitUntil(syncSales());
    }
});

// Синхронизация продаж
async function syncSales() {
    try {
        const pendingSales = await getPendingSales();

        for (const sale of pendingSales) {
            await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sale)
            });
        }

        console.log('[SW] Sales synced successfully');
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// Заглушка для pending sales
async function getPendingSales() {
    // В реальности читать из IndexedDB
    return [];
}

// Push уведомления
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};

    const options = {
        body: data.body || 'Новое уведомление',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SmartPOS Pro', options)
    );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
