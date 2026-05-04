import pg from 'pg';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
});

async function fixLocal() {
    try {
        console.log('--- Fixing LOCAL Database (Organization 14) ---');
        
        const userRes = await pool.query('SELECT organization_id FROM users WHERE username = $1', ['Topcell1']);
        if (userRes.rows.length === 0) return;
        const orgId = userRes.rows[0].organization_id;

        // Clean up any orphans
        await pool.query('DELETE FROM product_categories WHERE organization_id = $1', [orgId]);
        await pool.query('DELETE FROM warehouses WHERE organization_id = $1', [orgId]);
        
        // Insert
        await pool.query('INSERT INTO product_categories (name, code, organization_id, is_active) VALUES ($1, $2, $3, true)', 
            ['Общее', 'CAT-L', orgId]);
        const catId = (await pool.query('SELECT id FROM product_categories WHERE organization_id = $1 LIMIT 1', [orgId])).rows[0].id;

        await pool.query('INSERT INTO warehouses (name, code, organization_id, is_active) VALUES ($1, $2, $3, true)', 
            ['Основной склад', 'WH-L', orgId]);
        const whId = (await pool.query('SELECT id FROM warehouses WHERE organization_id = $1 LIMIT 1', [orgId])).rows[0].id;

        await pool.query('INSERT INTO products (code, name, category_id, organization_id, price_sale, is_active) VALUES ($1, $2, $3, $4, $5, true)',
            ['156', 'ТОВАР 156', catId, orgId, 5000]);
        
        const prodId = (await pool.query('SELECT id FROM products WHERE code = $1 AND organization_id = $2', ['156', orgId])).rows[0].id;
        await pool.query('INSERT INTO inventory_movements (product_id, warehouse_id, quantity, document_type, organization_id) VALUES ($1, $2, 100, \'receipt\', $3)',
            [prodId, whId, orgId]);

        console.log('✅ Local database updated for Org', orgId);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

fixLocal();
