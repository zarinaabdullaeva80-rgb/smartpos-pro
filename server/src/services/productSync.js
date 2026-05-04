import fetch from 'node-fetch';

const CLOUD_SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app';

function isCloud() {
    return !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
}

/**
 * Синхронизация одного товара на облако (create/update)
 */
export async function syncProductToCloud(productData, licenseKey) {
    if (isCloud()) return { skipped: true, reason: 'already cloud' };
    try {
        console.log(`[PRODUCT-SYNC] Syncing product "${productData.name}" (code=${productData.code}) to cloud...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ ...productData, license_key: licenseKey }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[PRODUCT-SYNC] Cloud error ${response.status}:`, text.substring(0, 300));
            return { success: false, error: `Cloud error ${response.status}` };
        }
        const result = await response.json();
        console.log(`[PRODUCT-SYNC] Cloud response:`, result.success ? '✅ OK' : '⚠️ ' + (result.error || 'unknown'));
        return result;
    } catch (error) {
        console.error('[PRODUCT-SYNC] Cloud sync failed (non-blocking):', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Синхронизация удаления товара
 */
export async function syncProductDeleteToCloud(productCode, licenseKey) {
    if (isCloud()) return { skipped: true, reason: 'already cloud' };
    try {
        console.log(`[PRODUCT-SYNC] Deleting product code="${productCode}" from cloud...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync-product-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ code: productCode, license_key: licenseKey }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        console.log(`[PRODUCT-SYNC] Delete response:`, result.success ? '✅ OK' : '⚠️ ' + (result.error || 'unknown'));
        return result;
    } catch (error) {
        console.error('[PRODUCT-SYNC] Delete sync failed (non-blocking):', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Полная синхронизация ВСЕХ товаров организации в облако (batch)
 */
export async function syncAllProductsToCloud(products, licenseKey) {
    if (isCloud()) return { skipped: true, reason: 'already cloud' };
    if (!products || products.length === 0) return { success: true, synced: 0 };

    try {
        console.log(`[PRODUCT-SYNC] Bulk syncing ${products.length} products to cloud...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for bulk

        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync-products-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ products, license_key: licenseKey }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[PRODUCT-SYNC] Bulk error ${response.status}:`, text.substring(0, 300));
            return { success: false, error: `Cloud error ${response.status}` };
        }
        const result = await response.json();
        console.log(`[PRODUCT-SYNC] Bulk response: synced=${result.synced}, errors=${result.errors}`);
        return result;
    } catch (error) {
        console.error('[PRODUCT-SYNC] Bulk sync failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Синхронизация остатков товара
 */
export async function syncInventoryToCloud(productCode, quantity, licenseKey) {
    if (isCloud()) return { skipped: true, reason: 'already cloud' };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync-inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ product_code: productCode, quantity, license_key: licenseKey }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('[INVENTORY-SYNC] Sync failed (non-blocking):', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Синхронизация категорий (bulk)
 */
export async function syncCategoriesToCloud(categories, licenseKey) {
    if (isCloud()) return { skipped: true, reason: 'already cloud' };
    if (!categories || categories.length === 0) return { success: true, synced: 0 };

    try {
        console.log(`[CATEGORY-SYNC] Syncing ${categories.length} categories to cloud...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${CLOUD_SERVER_URL}/api/license/sync-categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ categories, license_key: licenseKey }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        console.log(`[CATEGORY-SYNC] Response: synced=${result.synced}`);
        return result;
    } catch (error) {
        console.error('[CATEGORY-SYNC] Sync failed:', error.message);
        return { success: false, error: error.message };
    }
}
