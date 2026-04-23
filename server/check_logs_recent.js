import fetch from 'node-fetch';

const RAILWAY_API = 'https://smartpos-pro-production.up.railway.app';
const SYNC_SECRET = 'smartpos-sync-key-2026';

async function check() {
    console.log('📜 Recent Logs from Railway (Post-Migration):');
    
    const resLogs = await fetch(`${RAILWAY_API}/api/license/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': SYNC_SECRET },
        body: JSON.stringify({ action: 'get_logs' })
    });
    const dataLogs = await resLogs.json();
    const logs = dataLogs.results?.logs || [];
    
    // Filter logs after 12:20 UTC
    const recentLogs = logs.filter(l => new Date(l.created_at) > new Date('2026-04-23T12:20:00Z'));
    
    console.log(JSON.stringify(recentLogs, null, 2));
}

check();
