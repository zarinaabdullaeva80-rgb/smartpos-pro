async function checkLocalSchema() {
    try {
        const { default: pool } = await import('../src/config/database.js');
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sync_log'");
        if (res.rows.length === 0) {
            console.log('Table sync_log does not exist');
        } else {
            console.log(JSON.stringify(res.rows, null, 2));
        }
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}

checkLocalSchema();
