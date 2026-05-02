import pool from '../config/database.js';
import { syncToCloud } from './licenseSync.js';

/**
 * Синхронизирует все активные лицензии с облаком Railway.
 * Используется для первоначальной миграции или фоновой периодической синхронизации.
 */
export async function syncAllLicensesToCloud() {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    console.log('[AUTO-SYNC] Starting full license synchronization...');
    
    try {
        const result = await pool.query('SELECT * FROM licenses WHERE is_active = true');
        const licenses = result.rows;
        
        console.log(`[AUTO-SYNC] Found ${licenses.length} licenses to sync.`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const license of licenses) {
            try {
                const res = await syncToCloud(license);
                if (res.success || res.skipped) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`[AUTO-SYNC] Failed to sync license ${license.license_key}:`, res.error);
                }
            } catch (e) {
                errorCount++;
                console.error(`[AUTO-SYNC] Critical error syncing ${license.license_key}:`, e.message);
            }
        }
        
        console.log(`[AUTO-SYNC] Finished. Success: ${successCount}, Errors: ${errorCount}`);
        return { success: true, synced: successCount, errors: errorCount };
    } catch (error) {
        console.error('[AUTO-SYNC] Failed to get licenses:', error.message);
        return { success: false, error: error.message };
    }
}
