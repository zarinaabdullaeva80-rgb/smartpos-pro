import fetch from 'node-fetch';

const CLOUD_SYNC_SECRET = process.env.CLOUD_SYNC_SECRET || 'smartpos-sync-key-2026';
const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'https://smartpos-pro-production.up.railway.app';

/**
 * Синхронизация сотрудника на облачный сервер Railway
 * Вызывается автоматически после создания/обновления сотрудника на локальном сервере
 */
export async function syncEmployeeToCloud(employeeData) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        console.log(`[EMPLOYEE-SYNC] Syncing employee "${employeeData.username}" to cloud...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${process.env.CLOUD_SERVER_URL || CLOUD_SERVER_URL}/api/license/sync-employee`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': process.env.CLOUD_SYNC_SECRET || CLOUD_SYNC_SECRET
            },
            body: JSON.stringify(employeeData),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const text = await response.text();
            console.error(`[EMPLOYEE-SYNC] Cloud error ${response.status}:`, text.substring(0, 500));
            return { success: false, error: `Cloud error ${response.status}` };
        }

        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (jsonErr) {
            console.error('[EMPLOYEE-SYNC] Failed to parse JSON from cloud:', responseText.substring(0, 500));
            return { success: false, error: 'Invalid JSON from cloud' };
        }
        
        console.log(`[EMPLOYEE-SYNC] Cloud response:`, result.success ? '✅ OK' : '⚠️ ' + (result.error || 'unknown'));
        return result;
    } catch (error) {
        console.error('[EMPLOYEE-SYNC] Cloud sync failed (non-blocking):', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Синхронизация обновления пароля сотрудника
 */
export async function syncEmployeePasswordToCloud(username, passwordHash, organizationId) {
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        console.log(`[EMPLOYEE-SYNC] Syncing password update for "${username}" to cloud...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${process.env.CLOUD_SERVER_URL || CLOUD_SERVER_URL}/api/license/sync-employee`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': process.env.CLOUD_SYNC_SECRET || CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({
                username,
                password_hash: passwordHash,
                organization_id: organizationId,
                action: 'update_password'
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const result = await response.json();
        console.log(`[EMPLOYEE-SYNC] Password sync response:`, result.success ? '✅ OK' : '⚠️ ' + (result.error || 'unknown'));
        return result;
    } catch (error) {
        console.error('[EMPLOYEE-SYNC] Password sync failed (non-blocking):', error.message);
        return { success: false, error: error.message };
    }
}
/**
 * Синхронизация создания сотрудника
 */
export async function syncEmployeeCreate(employeeData, organizationId) {
    return await syncEmployeeToCloud({
        ...employeeData,
        organization_id: organizationId,
        action: 'create'
    });
}

/**
 * Синхронизация обновления сотрудника
 */
export async function syncEmployeeUpdate(employeeId, updateData, organizationId) {
    return await syncEmployeeToCloud({
        ...updateData,
        id: employeeId,
        organization_id: organizationId,
        action: 'update'
    });
}

/**
 * Синхронизация удаления сотрудника
 */
export async function syncEmployeeDelete(username, organizationId) {
    return await syncEmployeeToCloud({
        username,
        organization_id: organizationId,
        action: 'delete'
    });
}
