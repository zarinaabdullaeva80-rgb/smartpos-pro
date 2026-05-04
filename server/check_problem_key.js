import pool from './src/config/database.js';

async function check() {
    try {
        const res = await pool.query("SELECT * FROM licenses WHERE license_key = 'B5F3-87E6-20F4-7B7A'");
        console.log(JSON.stringify(res.rows, null, 2));
        
        const activations = await pool.query("SELECT * FROM license_activations WHERE license_id = $1", [res.rows[0]?.id]);
        console.log("Activations:", JSON.stringify(activations.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
