import { google } from 'googleapis';
import pool from '../config/database.js';

// Инициализация Google Sheets API
let sheets = null;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Функция инициализации (потребуется OAuth или Service Account)
export async function initGoogleSheets() {
    try {
        // Проверка наличия учетных данных
        if (!process.env.GOOGLE_SHEETS_CREDENTIALS_PATH) {
            console.log('⚠ Google Sheets credentials не настроены');
            return false;
        }

        // Для упрощения используем Service Account credentials
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
            scopes: SCOPES,
        });

        const authClient = await auth.getClient();
        sheets = google.sheets({ version: 'v4', auth: authClient });

        console.log('✓ Google Sheets API инициализирован');
        return true;
    } catch (error) {
        console.warn('⚠ Google Sheets API не инициализирован:', error.message);
        return false;
    }
}

// Синхронизация товаров в Google Sheets
export async function syncProductsToSheet() {
    if (!sheets || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        console.log('Google Sheets не настроен, пропускаем синхронизацию товаров');
        return;
    }

    try {
        const result = await pool.query(
            `SELECT p.id, p.code, p.name, pc.name as category_name, p.unit,
                    p.price_purchase, p.price_sale, p.min_stock, p.is_active,
                    p.created_at, p.updated_at,
                    COALESCE(SUM(im.quantity), 0) as stock_quantity
             FROM products p
             LEFT JOIN product_categories pc ON p.category_id = pc.id
             LEFT JOIN inventory_movements im ON p.id = im.product_id
             GROUP BY p.id, p.code, p.name, pc.name, p.unit, 
                      p.price_purchase, p.price_sale, p.min_stock, p.is_active,
                      p.created_at, p.updated_at
             ORDER BY p.id`
        );

        const values = [
            ['ID', 'Код', 'Наименование', 'Категория', 'Ед. изм.', 'Цена закупки', 'Цена продажи', 'Остаток', 'Мин. остаток', 'Активен', 'Создан', 'Обновлен'],
            ...result.rows.map(row => [
                row.id,
                row.code || '',
                row.name,
                row.category_name || '',
                row.unit,
                row.price_purchase || 0,
                row.price_sale || 0,
                parseFloat(row.stock_quantity) || 0,
                row.min_stock || 0,
                row.is_active ? 'Да' : 'Нет',
                row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '',
                row.updated_at ? new Date(row.updated_at).toLocaleDateString('ru-RU') : ''
            ])
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: 'Товары!A1',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`✓ Синхронизировано ${result.rows.length} товаров в Google Sheets`);
    } catch (error) {
        console.error('Ошибка синхронизации товаров:', error.message);
    }
}

// Синхронизация продаж в Google Sheets
export async function syncSalesToSheet(dateFrom, dateTo) {
    if (!sheets || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        console.log('Google Sheets не настроен, пропускаем синхронизацию продаж');
        return;
    }

    try {
        let query = `
      SELECT s.id, s.document_number, s.document_date,
             c.name as customer_name,
             s.total_amount, s.discount_amount, s.final_amount,
             s.status, s.payment_type, s.notes, u.full_name as user_name,
             s.created_at
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN counterparties c ON s.customer_id = c.id
      WHERE 1=1
    `;

        const params = [];
        let paramCount = 1;

        if (dateFrom) {
            query += ` AND s.document_date >= $${paramCount}`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND s.document_date <= $${paramCount}`;
            params.push(dateTo);
            paramCount++;
        }

        query += ' ORDER BY s.document_date DESC, s.id DESC';

        const result = await pool.query(query, params);

        const values = [
            ['ID', 'Номер', 'Дата', 'Клиент', 'Сумма', 'Скидка', 'Итого', 'Статус', 'Оплата', 'Пользователь', 'Создано'],
            ...result.rows.map(row => [
                row.id,
                row.document_number || '',
                row.document_date ? new Date(row.document_date).toLocaleDateString('ru-RU') : '',
                row.customer_name || '',
                row.total_amount || 0,
                row.discount_amount || 0,
                row.final_amount || 0,
                row.status || '',
                row.payment_type || '',
                row.user_name || '',
                row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : ''
            ])
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: 'Продажи!A1',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`✓ Синхронизировано ${result.rows.length} продаж в Google Sheets`);
    } catch (error) {
        console.error('Ошибка синхронизации продаж:', error.message);
    }
}

// Синхронизация остатков в Google Sheets
export async function syncInventoryToSheet() {
    if (!sheets || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        console.log('Google Sheets не настроен, пропускаем синхронизацию остатков');
        return;
    }

    try {
        const result = await pool.query(`
      SELECT 
        p.code,
        p.name,
        COALESCE(SUM(im.quantity), 0) as quantity,
        p.unit,
        p.price_purchase,
        p.price_sale,
        COALESCE(SUM(im.quantity), 0) * COALESCE(p.price_purchase, 0) as total_cost
      FROM products p
      LEFT JOIN inventory_movements im ON p.id = im.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.code, p.name, p.unit, p.price_purchase, p.price_sale
      HAVING COALESCE(SUM(im.quantity), 0) > 0
      ORDER BY p.name
    `);

        const values = [
            ['Код', 'Товар', 'Количество', 'Ед. изм.', 'Цена закупки', 'Цена продажи', 'Сумма закупки'],
            ...result.rows.map(row => [
                row.code || '',
                row.name,
                parseFloat(row.quantity),
                row.unit,
                row.price_purchase || 0,
                row.price_sale || 0,
                parseFloat(row.total_cost) || 0
            ])
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: 'Остатки!A1',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`✓ Синхронизированы остатки в Google Sheets`);
    } catch (error) {
        console.error('Ошибка синхронизации остатков:', error.message);
    }
}

// Синхронизация статистики в Google Sheets
export async function syncStatisticsToSheet() {
    if (!sheets || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        console.log('Google Sheets не настроен, пропускаем синхронизацию статистики');
        return;
    }

    try {
        // Общая статистика
        const statsQuery = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
                (SELECT COUNT(*) FROM sales) as total_sales,
                (SELECT COALESCE(SUM(final_amount), 0) FROM sales) as total_revenue,
                (SELECT COALESCE(AVG(final_amount), 0) FROM sales) as avg_sale
        `);

        const stats = statsQuery.rows[0];

        // Топ товары
        const topProductsQuery = await pool.query(`
            SELECT p.name, COUNT(si.id) as sales_count, SUM(si.total_price) as revenue
            FROM products p
            JOIN sale_items si ON p.id = si.product_id
            GROUP BY p.id, p.name
            ORDER BY revenue DESC
            LIMIT 5
        `);

        const values = [
            ['Показатель', 'Значение'],
            ['Товаров в базе', stats.total_products],
            ['Всего продаж', stats.total_sales],
            ['Общая выручка', parseFloat(stats.total_revenue).toFixed(2)],
            ['Средний чек', parseFloat(stats.avg_sale).toFixed(2)],
            ['Последнее обновление', new Date().toLocaleString('ru-RU')],
            [],
            ['Топ Товары', 'Продаж', 'Выручка'],
            ...topProductsQuery.rows.map(row => [
                row.name,
                row.sales_count,
                parseFloat(row.revenue).toFixed(2)
            ])
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: 'Статистика!A1',
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`✓ Синхронизирована статистика в Google Sheets`);
    } catch (error) {
        console.error('Ошибка синхронизации статистики:', error.message);
    }
}

// Полная синхронизация всех данных
export async function syncAllData() {
    console.log('Начало полной синхронизации с Google Sheets...');
    await syncProductsToSheet();
    await syncSalesToSheet();
    await syncInventoryToSheet();
    await syncStatisticsToSheet();
    console.log('✓ Полная синхронизация завершена');
}

export default {
    initGoogleSheets,
    syncProductsToSheet,
    syncSalesToSheet,
    syncInventoryToSheet,
    syncStatisticsToSheet,
    syncAllData
};
