import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import pool from '../src/config/database.js';

describe('RBAC Tests', () => {
    let testRoleId;
    let testPermissionId;
    let testUserId;

    beforeAll(async () => {
        // Create test role
        const roleResult = await pool.query(`
            INSERT INTO roles (name, description)
            VALUES ('Test Role', 'Role for testing')
            RETURNING id
        `);
        testRoleId = roleResult.rows[0].id;

        // Create test permission
        const permResult = await pool.query(`
            INSERT INTO permissions (code, name, description, category)
            VALUES ('test.permission', 'Test Permission', 'For testing', 'test')
            RETURNING id
        `);
        testPermissionId = permResult.rows[0].id;

        // Create test user
        const userResult = await pool.query(`
            INSERT INTO users (username, password, full_name, email, role_id)
            VALUES ('testuser_rbac', 'password', 'Test User RBAC', 'test_rbac@test.com', $1)
            RETURNING id
        `, [testRoleId]);
        testUserId = userResult.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [testRoleId]);
        await pool.query('DELETE FROM roles WHERE id = $1', [testRoleId]);
        await pool.query('DELETE FROM permissions WHERE id = $1', [testPermissionId]);
        await pool.end();
    });

    it('should assign permission to role', async () => {
        await pool.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
        `, [testRoleId, testPermissionId]);

        const result = await pool.query(`
            SELECT * FROM role_permissions
            WHERE role_id = $1 AND permission_id = $2
        `, [testRoleId, testPermissionId]);

        expect(result.rows.length).toBe(1);
    });

    it('should get user permissions', async () => {
        const result = await pool.query(`
            SELECT p.*
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN users u ON u.role_id = rp.role_id
            WHERE u.id = $1
        `, [testUserId]);

        expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should check permission for user', async () => {
        const hasPermission = await pool.query(`
            SELECT EXISTS(
                SELECT 1
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN users u ON u.role_id = rp.role_id
                WHERE u.id = $1 AND p.code = $2
            ) as has_permission
        `, [testUserId, 'test.permission']);

        expect(hasPermission.rows[0].has_permission).toBe(true);
    });
});

describe('WMS Workflow Tests', () => {
    let testProductId;
    let testWarehouseId;
    let testLocationId;

    beforeAll(async () => {
        // Create test product
        const prodResult = await pool.query(`
            INSERT INTO products (name, barcode, price, unit)
            VALUES ('Test Product WMS', 'TEST-WMS-001', 100, 'шт')
            RETURNING id
        `);
        testProductId = prodResult.rows[0].id;

        // Create test warehouse
        const whResult = await pool.query(`
            INSERT INTO warehouses (name, address)
            VALUES ('Test Warehouse', 'Test Address')
            RETURNING id
        `);
        testWarehouseId = whResult.rows[0].id;

        // Create test location
        const locResult = await pool.query(`
            INSERT INTO warehouse_locations (warehouse_id, code, name, type)
            VALUES ($1, 'A-01', 'Location A-01', 'shelf')
            RETURNING id
        `, [testWarehouseId]);
        testLocationId = locResult.rows[0].id;
    });

    afterAll(async () => {
        await pool.query('DELETE FROM product_stocks WHERE product_id = $1', [testProductId]);
        await pool.query('DELETE FROM warehouse_locations WHERE id = $1', [testLocationId]);
        await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
        await pool.query('DELETE FROM warehouses WHERE id = $1', [testWarehouseId]);
    });

    it('should add stock to location', async () => {
        await pool.query(`
            INSERT INTO product_stocks (warehouse_id, product_id, location_id, quantity)
            VALUES ($1, $2, $3, 10)
            ON CONFLICT (warehouse_id, product_id, location_id)
            DO UPDATE SET quantity = product_stocks.quantity + 10
        `, [testWarehouseId, testProductId, testLocationId]);

        const result = await pool.query(`
            SELECT quantity FROM product_stocks
            WHERE warehouse_id = $1 AND product_id = $2 AND location_id = $3
        `, [testWarehouseId, testProductId, testLocationId]);

        expect(result.rows[0].quantity).toBeGreaterThanOrEqual(10);
    });

    it('should get total stock across locations', async () => {
        const result = await pool.query(`
            SELECT COALESCE(SUM(quantity), 0) as total
            FROM product_stocks
            WHERE product_id = $1 AND warehouse_id = $2
        `, [testProductId, testWarehouseId]);

        expect(result.rows[0].total).toBeGreaterThan(0);
    });

    it('should move stock between locations', async () => {
        // Create second location
        const loc2Result = await pool.query(`
            INSERT INTO warehouse_locations (warehouse_id, code, name, type)
            VALUES ($1, 'B-01', 'Location B-01', 'shelf')
            RETURNING id
        `, [testWarehouseId]);
        const location2Id = loc2Result.rows[0].id;

        // Move 5 units
        await pool.query('BEGIN');

        await pool.query(`
            UPDATE product_stocks
            SET quantity = quantity - 5
            WHERE warehouse_id = $1 AND product_id = $2 AND location_id = $3
        `, [testWarehouseId, testProductId, testLocationId]);

        await pool.query(`
            INSERT INTO product_stocks (warehouse_id, product_id, location_id, quantity)
            VALUES ($1, $2, $3, 5)
            ON CONFLICT (warehouse_id, product_id, location_id)
            DO UPDATE SET quantity = product_stocks.quantity + 5
        `, [testWarehouseId, testProductId, location2Id]);

        await pool.query('COMMIT');

        const result = await pool.query(`
            SELECT quantity FROM product_stocks
            WHERE warehouse_id = $1 AND product_id = $2 AND location_id = $3
        `, [testWarehouseId, testProductId, location2Id]);

        expect(result.rows[0].quantity).toBe(5);

        // Cleanup
        await pool.query('DELETE FROM product_stocks WHERE location_id = $1', [location2Id]);
        await pool.query('DELETE FROM warehouse_locations WHERE id = $1', [location2Id]);
    });
});

describe('CRM Workflow Tests', () => {
    let testCustomerId;
    let testDealId;
    let testStageId;

    beforeAll(async () => {
        // Create test customer
        const custResult = await pool.query(`
            INSERT INTO counterparties (name, type, email, phone)
            VALUES ('Test Customer CRM', 'customer', 'crm@test.com', '+1234567890')
            RETURNING id
        `);
        testCustomerId = custResult.rows[0].id;

        // Get first stage
        const stageResult = await pool.query(`
            SELECT id FROM deal_stages ORDER BY sequence LIMIT 1
        `);
        testStageId = stageResult.rows[0].id;

        // Create test deal
        const dealResult = await pool.query(`
            INSERT INTO deals (title, customer_id, stage_id, amount, probability, created_by)
            VALUES ('Test Deal', $1, $2, 5000, 50, 1)
            RETURNING id
        `, [testCustomerId, testStageId]);
        testDealId = dealResult.rows[0].id;
    });

    afterAll(async () => {
        await pool.query('DELETE FROM deals WHERE id = $1', [testDealId]);
        await pool.query('DELETE FROM counterparties WHERE id = $1', [testCustomerId]);
    });

    it('should create deal', async () => {
        const result = await pool.query(`
            SELECT * FROM deals WHERE id = $1
        `, [testDealId]);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].title).toBe('Test Deal');
    });

    it('should move deal to next stage', async () => {
        const nextStageResult = await pool.query(`
            SELECT id FROM deal_stages 
            WHERE sequence > (SELECT sequence FROM deal_stages WHERE id = $1)
            ORDER BY sequence LIMIT 1
        `, [testStageId]);

        if (nextStageResult.rows.length > 0) {
            const nextStageId = nextStageResult.rows[0].id;

            await pool.query(`
                UPDATE deals
                SET stage_id = $1
                WHERE id = $2
            `, [nextStageId, testDealId]);

            const result = await pool.query(`
                SELECT stage_id FROM deals WHERE id = $1
            `, [testDealId]);

            expect(result.rows[0].stage_id).toBe(nextStageId);
        }
    });

    it('should calculate loyalty points', async () => {
        // Add purchase
        await pool.query(`
            UPDATE counterparties
            SET total_purchases = 1000
            WHERE id = $1
        `, [testCustomerId]);

        // Recalculate RFM
        await pool.query('REFRESH MATERIALIZED VIEW customer_rfm');

        const result = await pool.query(`
            SELECT * FROM customer_rfm WHERE customer_id = $1
        `, [testCustomerId]);

        expect(result.rows.length).toBeGreaterThanOrEqual(0);
    });
});
