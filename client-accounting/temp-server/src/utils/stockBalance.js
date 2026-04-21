import pool from '../config/database.js';

/**
 * Обновить stock_balances после изменения inventory_movements.
 * available_quantity — GENERATED ALWAYS (= quantity - reserved_quantity),
 * поэтому обновляем только поле quantity.
 *
 * @param {object} client  — pg Client (если в транзакции) или pool
 * @param {number} productId
 * @param {number} warehouseId
 * @param {number} quantityDelta — изменение количества (+/-)
 */
export async function updateStockBalance(client, productId, warehouseId, quantityDelta) {
    if (!productId || !warehouseId || quantityDelta === 0) return;

    const db = client || pool;

    await db.query(`
        INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
        VALUES ($1, $2, GREATEST(0, $3), NOW())
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET 
            quantity = GREATEST(0, stock_balances.quantity + $3),
            updated_at = NOW()
    `, [productId, warehouseId, quantityDelta]);
}

/**
 * Пересчитать stock_balances из inventory_movements для конкретного товара на складе.
 * Используется когда нужна полная пересинхронизация.
 */
export async function recalcStockBalance(client, productId, warehouseId) {
    const db = client || pool;

    await db.query(`
        INSERT INTO stock_balances (product_id, warehouse_id, quantity, updated_at)
        SELECT $1, $2, GREATEST(0, COALESCE(SUM(quantity), 0)), NOW()
        FROM inventory_movements
        WHERE product_id = $1 AND warehouse_id = $2
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET 
            quantity = EXCLUDED.quantity,
            updated_at = NOW()
    `, [productId, warehouseId]);
}

export default { updateStockBalance, recalcStockBalance };
