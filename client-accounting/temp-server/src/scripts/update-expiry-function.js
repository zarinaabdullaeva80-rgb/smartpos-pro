import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '../../../database/migrations/057-update-expiry-function.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

pool.query(sql)
    .then(() => {
        console.log('Successfully updated check_expiring_products function');
        process.exit(0);
    })
    .catch(err => {
        console.error('Failed to update function:', err);
        process.exit(1);
    });
