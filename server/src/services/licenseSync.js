import fetch from 'node-fetch';

// ★ Секрет для синхронизации между локальным сервером и Railway
const CLOUD_SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app';

/**
 * Синхронизация лицензии на облачный сервер Railway
 * Вызывается автоматически после создания лицензии на локальном сервере
 */
export async function syncToCloud(licenseData) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`${process.env.CLOUD_SERVER_URL || CLOUD_SERVER_URL}/api/license/sync`, {
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
        console.log('[SYNC] Cloud response:', result);
        return result;
    } catch (error) {
        console.error('[SYNC] Cloud sync failed (non-blocking):', error.message);
        return { error: error.message };
    }
}

/**
 * Синхронизация УДАЛЕНИЯ лицензии на облачный сервер Railway
 * Вызывается автоматически после удаления лицензии на локальном сервере
 */
export async function deleteFromCloud(licenseKey) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        console.log(`[SYNC-DELETE] 🚀 Notifying cloud about deleted license: ${licenseKey}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(`${process.env.CLOUD_SERVER_URL || CLOUD_SERVER_URL}/api/license/sync-delete`, {
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
        console.log('[SYNC-DELETE] Cloud response:', result);
        return result;
    } catch (error) {
        console.error('[SYNC-DELETE] Cloud sync failed (non-blocking):', error.message);
        return { error: error.message };
    }
}
