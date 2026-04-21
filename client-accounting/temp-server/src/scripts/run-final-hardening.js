import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const migrationPath = path.join(__dirname, '../../../database/migrations/056-final-saas-hardening.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('--- Starting Final SaaS Hardening Migration ---');
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Split by semicolon? No, DO $$ block is complex. 
        // Better to execute the whole block as one query if possible.
        await client.query(sql);
        
        await client.query('COMMIT');
        console.log('--- Migration Completed Successfully ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('--- Migration Failed ---');
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration();
