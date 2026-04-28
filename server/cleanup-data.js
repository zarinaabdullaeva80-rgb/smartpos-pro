/**
 * SmartPOS Pro — Скрипт полной очистки данных
 * Запуск: node server/cleanup-data.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'accounting_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Smash2206',
});

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('='.repeat(60));
        console.log('🧹 SmartPOS Pro — ОЧИСТКА ДАННЫХ');
        console.log('='.repeat(60));

        const tables = [
            { name: 'licenses', label: 'Лицензии' },
            { name: 'license_activations', label: 'Активации' },
            { name: 'products', label: 'Товары' },
            { name: 'employees', label: 'Сотрудники' },
            { name: 'users', label: 'Пользователи' },
            { name: 'sales', label: 'Продажи' },
            { name: 'sale_items', label: 'Позиции продаж' },
        ];

        console.log('\n📊 ДО очистки:');
        for (const t of tables) {
            try {
                const r = await client.query(`SELECT COUNT(*) as cnt FROM ${t.name}`);
                console.log(`   ${t.label}: ${r.rows[0].cnt}`);
            } catch (e) { console.log(`   ${t.label}: —`); }
        }

        console.log('\n🔥 Очистка...\n');
        await client.query('BEGIN');

        const deletes = [
            ['license_activations', null],
            ['licenses', null],
            ['return_items', null],
            ['returns', null],
            ['sale_items', null],
            ['sales', null],
            ['inventory_movements', null],
            ['stock_movements', null],
            ['products', null],
            ['employees', null],
            ['users', "username != 'admin' AND role != 'admin'"],
        ];

        let step = 1;
        for (const [table, where] of deletes) {
            try {
                const sql = where ? `DELETE FROM ${table} WHERE ${where}` : `DELETE FROM ${table}`;
                const r = await client.query(sql);
                console.log(`✅ [${step}] ${table}: удалено ${r.rowCount}`);
            } catch (e) {
                console.log(`⏭️ [${step}] ${table}: пропущено (${e.message.slice(0, 50)})`);
            }
            step++;
        }

        await client.query('COMMIT');

        console.log('\n📊 ПОСЛЕ очистки:');
        for (const t of tables) {
            try {
                const r = await client.query(`SELECT COUNT(*) as cnt FROM ${t.name}`);
                console.log(`   ${t.label}: ${r.rows[0].cnt}`);
            } catch (e) { /* skip */ }
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ ОЧИСТКА ЗАВЕРШЕНА');
        console.log('='.repeat(60));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ ОШИБКА:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();
