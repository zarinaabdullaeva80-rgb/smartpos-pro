import pool from '../config/database.js';

/**
 * Logs a synchronization event to the database.
 */
export async function logSyncEvent({
    organization_id,
    sync_type = 'full',
    direction = 'push',
    status = 'success',
    records_total = 0,
    records_success = 0,
    records_error = 0,
    error_message = null,
    details = {},
    triggered_by = 'system',
    started_at = new Date()
}) {
    const finished_at = new Date();
    const duration_ms = finished_at.getTime() - started_at.getTime();

    try {
        await pool.query(
            `INSERT INTO sync_log (
                organization_id, sync_type, direction, status, 
                records_total, records_success, records_error, 
                error_message, details, triggered_by, 
                started_at, finished_at, duration_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                organization_id, sync_type, direction, status,
                records_total, records_success, records_error,
                error_message, JSON.stringify(details), triggered_by,
                started_at, finished_at, duration_ms
            ]
        );
    } catch (error) {
        console.error('[SYNC-LOGGER] Failed to log sync event:', error.message);
    }
}
