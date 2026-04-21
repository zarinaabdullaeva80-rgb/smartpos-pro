import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCorrectiveMigrations() {
    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const files = [
        '050-extended-products.sql',
        '051-extended-payments.sql',
        '052-extended-crm.sql',
        '053-extended-system.sql',
        '056-final-saas-hardening.sql'
    ];

    console.log('--- STARTING CORRECTIVE MIGRATIONS ---');

    for (const file of files) {
        console.log(`Processing: ${file}...`);
        try {
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            // Split by semicolon (crude but usually works for our migrations)
            // Or just run as one block if it's DO $$
            await pool.query(sql);
            console.log(`✓ ${file} applied successfully.`);
        } catch (err) {
            console.error(`❌ Error applying ${file}:`, err.message);
            // We continue if it's "already exists" errors
        }
    }

    console.log('--- CORRECTIVE MIGRATIONS COMPLETED ---');
    process.exit(0);
}

runCorrectiveMigrations();
