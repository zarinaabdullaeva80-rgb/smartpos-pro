import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:Smash2206@localhost:5432/accounting_db'
});

async function inspectSchema() {
    try {
        const client = await pool.connect();
        const tables = ['counterparties', 'customers', 'sales', 'sale_items', 'purchases', 'users', 'user_roles', 'roles', 'warehouses', 'returns'];

        for (const table of tables) {
            console.log(`\n🔍 Inspecting "${table}" columns:`);
            const result = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            if (result.rows.length === 0) {
                console.log(`❌ Table "${table}" DOES NOT EXIST!`);
            } else {
                result.rows.forEach(row => {
                    console.log(`- ${row.column_name} (${row.data_type})`);
                });
            }
        }

        client.release();
        await pool.end();
    } catch (error) {
        console.error('❌ Inspection failed:', error.message);
        process.exit(1);
    }
}

inspectSchema();
