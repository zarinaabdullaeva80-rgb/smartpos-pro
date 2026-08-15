import pool from './src/config/database.js';

async function getTestOrders() {
    try {
        console.log('Fetching sales from database...');
        const res = await pool.query(
            `SELECT id, document_number, total_amount, final_amount, status, payment_status, created_at 
             FROM sales 
             ORDER BY id DESC 
             LIMIT 10`
        );
        console.log('\n--- EXISTING SALES IN DATABASE ---');
        res.rows.forEach(s => {
            const amtSum = parseFloat(s.final_amount || s.total_amount || 0);
            const amtTiyin = Math.round(amtSum * 100);
            console.log(`ID: ${s.id} | DocNum: ${s.document_number} | Amount: ${amtSum} SUM (${amtTiyin} tiyin) | Status: ${s.status} | Paid: ${s.payment_status}`);
        });

        // Let's create 3 dedicated test orders if needed
        let unpaidSales = res.rows.filter(s => s.payment_status !== 'paid');
        if (unpaidSales.length < 3) {
            console.log('\nCreating new test sales...');
            for (let i = 1; i <= 3; i++) {
                const amountSum = 1000 * i; // 1000, 2000, 3000 sum
                const insRes = await pool.query(
                    `INSERT INTO sales 
                     (document_number, total_amount, final_amount, status, payment_status, organization_id, created_at)
                     VALUES ($1, $2, $3, 'draft', 'unpaid', 1, NOW())
                     RETURNING id, document_number, total_amount, final_amount`,
                    [`TEST-PAYME-${Date.now()}-${i}`, amountSum, amountSum]
                );
                const s = insRes.rows[0];
                const amtSum = parseFloat(s.final_amount || s.total_amount || 0);
                const amtTiyin = Math.round(amtSum * 100);
                console.log(`NEW TEST ORDER -> ID: ${s.id} | Amount: ${amtSum} SUM (${amtTiyin} tiyin)`);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

getTestOrders();
