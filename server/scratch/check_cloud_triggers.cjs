const fetch = require('node-fetch');

async function checkCloudTriggers() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers"
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

checkCloudTriggers();
