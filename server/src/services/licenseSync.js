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
 * Вызывается автоматически после создания/обновления лицензии
 */
export async function syncToCloud(licenseData, req = null) {
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    
    // Получаем хост текущего сервера для предотвращения бесконечных петель
    let currentHost = '';
    if (req) {
        currentHost = req.get('host') || '';
    } else if (process.env.RAILWAY_STATIC_URL) {
        currentHost = process.env.RAILWAY_STATIC_URL;
    }

    const results = [];
    for (const cloudUrl of CLOUD_URLS) {
        // Если это облако и адрес совпадает с хостом текущего сервера, то пропускаем его
        if (isCloud && currentHost && cloudUrl.toLowerCase().includes(currentHost.toLowerCase())) {
            console.log(`[SYNC] 🔁 Skipping self sync for ${cloudUrl} (current host: ${currentHost})`);
            continue;
        }

        try {
            console.log(`[SYNC] 🚀 Syncing license to cloud node: ${cloudUrl}`);
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
    
    const anySuccess = results.some(r => r.success);
    return { success: anySuccess || results.length === 0, results };
}

/**
 * Синхронизация УДАЛЕНИЯ лицензии на ОБА облачных сервера Railway
 * Вызывается автоматически после удаления лицензии
 */
export async function deleteFromCloud(licenseKey, req = null) {
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    
    // Получаем хост текущего сервера для предотвращения бесконечных петель
    let currentHost = '';
    if (req) {
        currentHost = req.get('host') || '';
    } else if (process.env.RAILWAY_STATIC_URL) {
        currentHost = process.env.RAILWAY_STATIC_URL;
    }

    const results = [];
    for (const cloudUrl of CLOUD_URLS) {
        // Если это облако и адрес совпадает с хостом текущего сервера, то пропускаем его
        if (isCloud && currentHost && cloudUrl.toLowerCase().includes(currentHost.toLowerCase())) {
            console.log(`[SYNC-DELETE] 🔁 Skipping self sync-delete for ${cloudUrl} (current host: ${currentHost})`);
            continue;
        }

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
    return { success: results.some(r => r.success) || results.length === 0, results };
}
