import pool from '../src/config/database.js';

async function checkLocalQuantities() {
    try {
        const res = await pool.query(`
            SELECT p.name, 
                   COALESCE((
                     SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                    WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                    ELSE im.quantity END)
                     FROM inventory_movements im WHERE im.product_id = p.id
                   ), 0) AS calculated_quantity
            FROM products p
            WHERE p.organization_id = 9
            LIMIT 10
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkLocalQuantities();
