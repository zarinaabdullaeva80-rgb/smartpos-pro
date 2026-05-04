async function checkLocalOrgs() {
    try {
        const { default: pool } = await import('../src/config/database.js');
        const res = await pool.query("SELECT id FROM organizations");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}

checkLocalOrgs();
