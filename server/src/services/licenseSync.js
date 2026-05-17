import fetch from 'node-fetch';

// ★ Секрет для синхронизации между локальным сервером и Railway
const CLOUD_SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';
// ★ ОБА deployment'а Railway — клиент использует f885, авто-синхронизация шла на оригинальный
const CLOUD_URLS = [
    process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app',
    'https://smartpos-pro-production-f885.up.railway.app'
];

/**
 * Синхронизация лицензии на ОБА облачных сервера Railway
 * Вызывается автоматически после создания лицензии на локальном сервере
 */
export async function syncToCloud(licenseData) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    const results = [];
    for (const cloudUrl of CLOUD_URLS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${cloudUrl}/api/license/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Secret': process.env.CLOUD_SYNC_SECRET || CLOUD_SYNC_SECRET
                },
                body: JSON.stringify(licenseData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const result = await response.json();
            console.log(`[SYNC] ${cloudUrl} response:`, result);
            results.push({ url: cloudUrl, ...result });
        } catch (error) {
            console.error(`[SYNC] ${cloudUrl} sync failed (non-blocking):`, error.message);
            results.push({ url: cloudUrl, error: error.message });
        }
    }
    // Возвращаем успех если хотя бы один deployment отработал
    const anySuccess = results.some(r => r.success);
    return { success: anySuccess, results };
}

/**
 * Синхронизация УДАЛЕНИЯ лицензии на ОБА облачных сервера Railway
 * Вызывается автоматически после удаления лицензии на локальном сервере
 */
export async function deleteFromCloud(licenseKey) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    const results = [];
    for (const cloudUrl of CLOUD_URLS) {
        try {
            console.log(`[SYNC-DELETE] 🚀 Notifying ${cloudUrl} about deleted license: ${licenseKey}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${cloudUrl}/api/license/sync-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Secret': process.env.CLOUD_SYNC_SECRET || CLOUD_SYNC_SECRET
                },
                body: JSON.stringify({ license_key: licenseKey }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const result = await response.json();
            console.log(`[SYNC-DELETE] ${cloudUrl} response:`, result);
            results.push({ url: cloudUrl, ...result });
        } catch (error) {
            console.error(`[SYNC-DELETE] ${cloudUrl} sync failed (non-blocking):`, error.message);
            results.push({ url: cloudUrl, error: error.message });
        }
    }
    return { success: results.some(r => r.success), results };
}
