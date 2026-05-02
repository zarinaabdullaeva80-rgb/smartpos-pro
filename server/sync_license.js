import pool from './src/config/database.js';
import { syncToCloud } from './src/services/licenseSync.js';
import dotenv from 'dotenv';

dotenv.config();

async function syncLicense(licenseKey) {
    try {
        console.log(`🔍 Searching for license: ${licenseKey}...`);
        
        const result = await pool.query('SELECT * FROM licenses WHERE license_key = $1', [licenseKey]);
        
        if (result.rows.length === 0) {
            console.error(`❌ License ${licenseKey} not found in local database.`);
            process.exit(1);
        }
        
        const license = result.rows[0];
        console.log(`✅ Found license for ${license.customer_name || license.company_name}. Syncing to cloud...`);
        
        const syncResult = await syncToCloud(license);
        
        if (syncResult.success || syncResult.skipped) {
            console.log(`🚀 Successfully synced to cloud!`);
        } else {
            console.error(`❌ Cloud sync failed:`, syncResult.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('💥 Error:', error.message);
    } finally {
        await pool.end();
    }
}

const key = process.argv[2];
if (!key) {
    console.log('Usage: node sync_license.js <LICENSE_KEY>');
    process.exit(1);
}

syncLicense(key);
