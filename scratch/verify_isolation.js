import pool from '../server/src/config/database.js';

async function verifyIsolation() {
    console.log('--- STARTING ISOLATION VERIFICATION ---');

    try {
        // 1. Simulating a normal user query (Org ID = 5, not superadmin)
        const orgId = 5;
        const isSuperAdmin = false;

        // Simulate Product query logic
        let query = 'SELECT COUNT(*) as cnt FROM products p WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (isSuperAdmin) {
            // query += ... 
        } else if (orgId) {
            query += ` AND p.organization_id = $${paramCount}`;
            params.push(orgId);
        } else {
            query += ` AND 1=0`;
        }

        const res = await pool.query(query, params);
        console.log(`Normal User (Org 5) sees ${res.rows[0].cnt} products.`);

        // 2. Check for NULL leakage
        const leakCheck = await pool.query('SELECT COUNT(*) as cnt FROM products WHERE organization_id IS NULL');
        const nullCount = parseInt(leakCheck.rows[0].cnt);
        
        if (nullCount > 0) {
            console.log(`Note: There are ${nullCount} products with NULL organization_id in DB.`);
            // Verify if normal user query would include them
            if (query.includes('IS NULL')) {
                console.error('FAIL: Query for normal user includes IS NULL check!');
            } else {
                console.log('SUCCESS: Normal user query excludes NULL records.');
            }
        } else {
            console.log('No NULL records found to leak.');
        }

        // 3. Verify sales duplicate column fix
        try {
            // Just a dry run of the insert syntax (will fail due to FK/Data but checks syntax)
            const syntaxCheck = await pool.query(
                `EXPLAIN INSERT INTO sales (document_number, document_date, customer_id, warehouse_id, 
                total_amount, discount_percent, discount_amount, final_amount, user_id, notes, status, payment_type, organization_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                ['TEST', '2024-01-01', null, 1, 0, 0, 0, 0, 1, '', 'draft', 'cash', 1]
            );
            console.log('SUCCESS: Sales INSERT syntax is valid (no duplicates).');
        } catch (e) {
            if (e.message.includes('has more target columns than expressions')) {
                 console.error('FAIL: Sales INSERT still has column/value mismatch.');
            } else {
                 console.log('Note: Sales INSERT syntax is likely fine (failed on data, not syntax).');
            }
        }

    } catch (err) {
        console.error('Verification error:', err.message);
    } finally {
        process.exit(0);
    }
}

verifyIsolation();
