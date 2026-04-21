import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import XLSX from 'xlsx';

const router = express.Router();

/**
 * Export products to Excel
 */
router.get('/products/excel', authenticate, checkPermission('products.read'), async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        const params = [];
        let licenseFilter = '';
        if (orgId) {
            params.push(orgId);
            licenseFilter = `WHERE p.organization_id = $${params.length}`;
        }

        const result = await pool.query(`
            SELECT 
                p.id,
                p.name as "Наименование",
                p.barcode as "Штрих-код",
                p.code as "Код",
                pc.name as "Категория",
                p.unit as "Единица",
                p.price_sale as "Цена",
                p.price_purchase as "Себестоимость",
                COALESCE(SUM(
                    CASE 
                        WHEN im.document_type IN ('sale', 'write_off', 'return_supplier') THEN -im.quantity
                        ELSE im.quantity 
                    END
                ), 0) as "Остаток",
                p.is_active as "Активен"
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            LEFT JOIN inventory_movements im ON p.id = im.product_id
            ${licenseFilter}
            GROUP BY p.id, pc.name
            ORDER BY p.name
        `, params);

        // Создать workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(result.rows);

        // Настроить ширину колонок
        const colWidths = [
            { wch: 5 },  // ID
            { wch: 40 }, // Наименование
            { wch: 15 }, // Штрих-код
            { wch: 15 }, // Артикул
            { wch: 20 }, // Категория
            { wch: 10 }, // Единица
            { wch: 12 }, // Цена
            { wch: 15 }, // Себестоимость
            { wch: 10 }, // Остаток
            { wch: 10 }  // Активен
        ];
        ws['!cols'] = colWidths;

        // Добавить лист в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Товары');

        // Генерировать буфер
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Отправить файл
        res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Export sales to Excel
 */
router.get('/sales/excel', authenticate, checkPermission('sales.read'), async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const orgId = req.user?.organization_id;

        let query = `
            SELECT 
                s.id as "ID",
                s.document_number as "Номер",
                TO_CHAR(s.document_date, 'DD.MM.YYYY') as "Дата",
                c.name as "Клиент",
                w.name as "Склад",
                s.total_amount as "Сумма",
                s.status as "Статус",
                u.full_name as "Создал"
            FROM sales s
            LEFT JOIN counterparties c ON s.customer_id = c.id
            LEFT JOIN warehouses w ON s.warehouse_id = w.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;

        const params = [];
        if (orgId) {
            params.push(orgId);
            query += ` AND s.organization_id = $${params.length}`;
        }

        if (date_from) {
            params.push(date_from);
            query += ` AND s.document_date >= $${params.length}`;
        }
        if (date_to) {
            params.push(date_to);
            query += ` AND s.document_date <= $${params.length}`;
        }

        query += ` ORDER BY s.document_date DESC, s.id DESC`;

        const result = await pool.query(query, params);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(result.rows);

        ws['!cols'] = [
            { wch: 8 },
            { wch: 15 },
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 12 },
            { wch: 12 },
            { wch: 25 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Продажи');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="sales_${date_from || 'all'}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting sales:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Export inventory to Excel
 */
router.get('/inventory/excel/:inventoryId', authenticate, checkPermission('inventory.read'), async (req, res) => {
    try {
        const { inventoryId } = req.params;

        const result = await pool.query(`
            SELECT 
                p.name as "Товар",
                p.barcode as "Штрих-код",
                ii.expected_quantity as "Ожидалось",
                ii.actual_quantity as "Фактически",
                (ii.actual_quantity - ii.expected_quantity) as "Разница",
                ii.notes as "Примечание"
            FROM inventory_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.inventory_id = $1
            ORDER BY p.name
        `, [inventoryId]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(result.rows);

        ws['!cols'] = [
            { wch: 40 },
            { wch: 15 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 30 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Инвентаризация');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="inventory_${inventoryId}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
