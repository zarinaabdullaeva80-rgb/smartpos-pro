$path = 'c:\Users\user\Desktop\1С бухгалтерия\server\src\routes\licensing.js'
$content = Get-Content $path -Raw
# Replace the whole block from the start of syncToCloud to the start of resolve
$regex = '(?s)async function syncToCloud.*?router\.get\(''/resolve'''
$newBlock = @"
async function syncToCloud(licenseData) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`\${CLOUD_SERVER_URL}/api/license/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify(licenseData),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        console.log('[SYNC] Cloud response:', result);
        return result;
    } catch (error) {
        console.error('[SYNC] Cloud sync failed (non-blocking):', error.message);
        return { error: error.message };
    }
}

/**
 * Синхронизация УДАЛЕНИЯ лицензии на облачный сервер Railway
 * Вызывается автоматически после удаления лицензии на локальном сервере
 */
async function deleteFromCloud(licenseKey) {
    // Не синхронизировать если МЫ и есть облако
    const isCloud = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    if (isCloud) return { skipped: true, reason: 'already cloud' };

    try {
        console.log(\`[SYNC-DELETE] 🚀 Notifying cloud about deleted license: \${licenseKey}\`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(\`\${CLOUD_SERVER_URL}/api/license/sync-delete\`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Secret': CLOUD_SYNC_SECRET
            },
            body: JSON.stringify({ license_key: licenseKey }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const result = await response.json();
        
        if (response.ok) {
            console.log(\`[SYNC-DELETE] ✅ Cloud confirmed deletion:\`, result);
        } else {
            console.error(\`[SYNC-DELETE] ❌ Cloud rejected deletion (HTTP \${response.status}):\`, result);
        }
        
        return result;
    } catch (error) {
        console.error('[SYNC-DELETE] ❌ Cloud sync-delete failed (non-blocking):', error.message);
        return { error: error.message };
    }
}

/**
 * GET /api/license/resolve?key=XXXX-XXXX-XXXX-XXXX
 * Публичный endpoint (без аутентификации) — резолв лицензионного ключа в URL сервера.
 * Вызывается мобильным приложением при первом запуске до логина.
 */
router.get('/resolve'
"@
$content = $content -replace $regex, $newBlock
Set-Content $path $content -NoNewline
