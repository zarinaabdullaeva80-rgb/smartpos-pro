async function triggerSync() {
    try {
        const { syncAllLicensesToCloud } = await import('../src/services/licenseAutoSync.js');
        console.log('Starting full sync...');
        const result = await syncAllLicensesToCloud('test-manual');
        console.log('Sync Result:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}

triggerSync();
