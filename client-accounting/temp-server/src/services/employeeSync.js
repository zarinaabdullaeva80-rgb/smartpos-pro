/**
 * Employee Sync Service
 * Синхронизирует сотрудников с облачным сервером (Railway)
 * когда лицензия имеет server_type = 'cloud'
 */
import pool from '../config/database.js';

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://smartpos-pro-production.up.railway.app/api';

/**
 * Получить server_type и server_url для лицензии
 */
async function getLicenseServerInfo(licenseId) {
    if (!licenseId) return null;
    try {
        const result = await pool.query(
            'SELECT id, server_type, server_url, server_api_key FROM licenses WHERE id = $1',
            [licenseId]
        );
        return result.rows[0] || null;
    } catch (e) {
        console.error('[EmployeeSync] Error getting license info:', e.message);
        return null;
    }
}

/**
 * Получить URL облачного сервера
 */
function getCloudUrl(license) {
    if (license.server_type === 'self_hosted' && license.server_url) {
        return license.server_url;
    }
    return RAILWAY_API_URL;
}

/**
 * Синхронизировать сотрудника с облачным сервером при создании
 */
export async function syncEmployeeCreate(employeeData, licenseId) {
    const license = await getLicenseServerInfo(licenseId);
    if (!license) {
        console.log('[EmployeeSync] No license found, skipping sync');
        return { synced: false, reason: 'no_license' };
    }

    if (license.server_type === 'self_hosted') {
        console.log('[EmployeeSync] License is self_hosted, skipping cloud sync');
        return { synced: false, reason: 'self_hosted' };
    }

    const cloudUrl = getCloudUrl(license);
    console.log(`[EmployeeSync] Syncing employee "${employeeData.username}" to ${cloudUrl}`);

    try {
        const response = await fetch(`${cloudUrl}/employees/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': license.server_api_key || '',
                'X-License-Id': String(licenseId)
            },
            body: JSON.stringify({
                action: 'create',
                employee: employeeData,
                licenseId: licenseId
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[EmployeeSync] Employee "${employeeData.username}" synced successfully`);
            return { synced: true, remote_id: data.employee?.id };
        } else {
            console.error(`[EmployeeSync] Sync failed: ${data.error}`);
            return { synced: false, reason: data.error };
        }
    } catch (error) {
        console.error(`[EmployeeSync] Network error: ${error.message}`);
        return { synced: false, reason: error.message };
    }
}

/**
 * Синхронизировать обновление сотрудника
 */
export async function syncEmployeeUpdate(employeeId, updateData, licenseId) {
    const license = await getLicenseServerInfo(licenseId);
    if (!license || license.server_type === 'self_hosted') return { synced: false };

    const cloudUrl = getCloudUrl(license);

    try {
        const response = await fetch(`${cloudUrl}/employees/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': license.server_api_key || '',
                'X-License-Id': String(licenseId)
            },
            body: JSON.stringify({
                action: 'update',
                employeeId,
                employee: updateData,
                licenseId
            })
        });

        const data = await response.json();
        return { synced: response.ok, remote_id: data.employee?.id };
    } catch (error) {
        console.error(`[EmployeeSync] Update sync error: ${error.message}`);
        return { synced: false, reason: error.message };
    }
}

/**
 * Синхронизировать удаление/деактивацию сотрудника
 */
export async function syncEmployeeDelete(username, licenseId) {
    const license = await getLicenseServerInfo(licenseId);
    if (!license || license.server_type === 'self_hosted') return { synced: false };

    const cloudUrl = getCloudUrl(license);

    try {
        const response = await fetch(`${cloudUrl}/employees/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': license.server_api_key || '',
                'X-License-Id': String(licenseId)
            },
            body: JSON.stringify({
                action: 'delete',
                username,
                licenseId
            })
        });

        const data = await response.json();
        return { synced: response.ok };
    } catch (error) {
        console.error(`[EmployeeSync] Delete sync error: ${error.message}`);
        return { synced: false, reason: error.message };
    }
}

/**
 * Синхронизировать лицензию с облачным сервером
 */
export async function syncLicenseToCloud(licenseData) {
    try {
        const response = await fetch(`${RAILWAY_API_URL}/licenses/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': licenseData.server_api_key || process.env.SYNC_SECRET_KEY || 'smartpos-sync-key'
            },
            body: JSON.stringify({ license: licenseData })
        });

        const data = await response.json();
        console.log(`[EmployeeSync] License sync result:`, data);
        return { synced: response.ok };
    } catch (error) {
        console.error(`[EmployeeSync] License sync error: ${error.message}`);
        return { synced: false, reason: error.message };
    }
}
