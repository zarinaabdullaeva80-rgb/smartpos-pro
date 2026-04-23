import pg from 'pg';
const { Pool } = pg;

const localPool = new Pool({ connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db' });

async function main() {
    try {
        console.log('Fetching local license 834B-D59B-4D92-3DD0...');
        const res = await localPool.query(
            `SELECT * FROM licenses WHERE license_key = '834B-D59B-4D92-3DD0'`
        );
        
        if (res.rows.length === 0) {
            console.error('License not found locally!');
            return;
        }
        
        const lic = res.rows[0];
        const syncData = {
            ...lic,
            company_name: lic.company_name || lic.customer_name || lic.customer_username
        };
        
        console.log('Sending sync request to Railway...');
        const response = await fetch('https://smartpos-pro-production.up.railway.app/api/license/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': 'smartpos-sync-key-2026'
            },
            body: JSON.stringify(syncData)
        });
        
        const result = await response.json();
        console.log('Sync result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await localPool.end();
    }
}

main();
