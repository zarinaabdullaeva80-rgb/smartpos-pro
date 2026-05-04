import pool from '../src/config/database.js';

async function check() {
    try {
        // Which orgs have products locally?
        const orgs = await pool.query(`
            SELECT organization_id, COUNT(*) as cnt 
            FROM products 
            GROUP BY organization_id 
            ORDER BY cnt DESC
        `);
        console.log('=== Local orgs with products ===');
        console.log(JSON.stringify(orgs.rows, null, 2));

        // Check quantities for the org with most products
        if (orgs.rows.length > 0) {
            const topOrg = orgs.rows[0].organization_id;
            const qty = await pool.query(`
                SELECT p.code, p.name, 
                       COALESCE((
                         SELECT SUM(CASE WHEN im.document_type IN ('receipt','adjustment','inventory') THEN im.quantity
                                        WHEN im.document_type IN ('sale','write_off','transfer_out') THEN -im.quantity
                                        ELSE im.quantity END)
                         FROM inventory_movements im WHERE im.product_id = p.id
                       ), 0) AS quantity
                FROM products p
                WHERE p.organization_id = $1
                ORDER BY quantity DESC
                LIMIT 10
            `, [topOrg]);
            console.log(`\n=== Top 10 products by quantity for org ${topOrg} ===`);
            console.log(JSON.stringify(qty.rows, null, 2));
        }
    } catch(e) { console.error(e); }
    finally { process.exit(0); }
}

check();
