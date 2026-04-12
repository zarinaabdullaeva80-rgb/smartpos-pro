import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Helper function to add license filter only if license_id exists
const getLicenseFilter = (userLicenseId, paramNum, columnPrefix = '') => {
    if (userLicenseId) {
        return { filter: ` AND ${columnPrefix}license_id = $${paramNum}`, params: [userLicenseId], nextParam: paramNum + 1 };
    }
    return { filter: '', params: [], nextParam: paramNum };
};

// Аналитика продаж
router.get('/sales-analytics', authenticate, async (req, res) => {
    try {
        const { dateFrom, dateTo, groupBy = 'day' } = req.query;

        let groupByClause = 'DATE(s.document_date)';
        if (groupBy === 'month') {
            groupByClause = "DATE_TRUNC('month', s.document_date)";
        } else if (groupBy === 'year') {
            groupByClause = "DATE_TRUNC('year', s.document_date)";
        }

        let query = `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as sales_count,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COALESCE(AVG(final_amount), 0) as average_sale
      FROM sales s
      WHERE 1=1
    `;

        const params = [];
        let paramCount = 1;

        // Add license filter if user has license_id
        if (req.user.license_id) {
            query += ` AND s.license_id = $${paramCount}`;
            params.push(req.user.license_id);
            paramCount++;
        }

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

        query += ` GROUP BY period ORDER BY period DESC`;

        const result = await pool.query(query, params);
        res.json({ analytics: result.rows });
    } catch (error) {
        console.error('Ошибка получения аналитики продаж:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', analytics: [] });
    }
});

// Топ продаваемых товаров
router.get('/top-products', authenticate, async (req, res) => {
    try {
        const { dateFrom, dateTo, limit = 10 } = req.query;

        let query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        COALESCE(SUM(si.quantity), 0) as total_quantity,
        COALESCE(SUM(COALESCE(si.total_amount, si.total_price, 0)), 0) as total_revenue,
        COUNT(DISTINCT si.sale_id) as sales_count
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
    `;

        const params = [];
        let paramCount = 1;

        if (req.user.license_id) {
            query += ` AND s.license_id = $${paramCount}`;
            params.push(req.user.license_id);
            paramCount++;
        }

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

        query += ` GROUP BY p.id, p.code, p.name ORDER BY total_revenue DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);
        res.json({ topProducts: result.rows });
    } catch (error) {
        console.error('Ошибка получения топ товаров:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', topProducts: [] });
    }
});

// Остатки товаров на складах
router.get('/inventory-balances', authenticate, async (req, res) => {
    try {
        const { warehouseId, lowStock } = req.query;

        let query = `
      SELECT 
        p.id,
        p.code,
        p.name,
        p.unit,
        w.id as warehouse_id,
        w.name as warehouse_name,
        COALESCE(SUM(im.quantity), 0) as quantity,
        COALESCE(p.price_purchase, 0) as price_purchase,
        COALESCE(p.price_sale, 0) as price_sale,
        COALESCE(SUM(im.quantity), 0) * COALESCE(p.price_purchase, 0) as total_cost
      FROM products p
      CROSS JOIN warehouses w
      LEFT JOIN inventory_movements im ON p.id = im.product_id AND w.id = im.warehouse_id
      WHERE p.is_active = true AND w.is_active = true
    `;

        const params = [];
        let paramCount = 1;

        if (req.user.license_id) {
            query += ` AND (p.license_id = $${paramCount} OR p.license_id IS NULL)`;
            params.push(req.user.license_id);
            paramCount++;
        }

        if (warehouseId) {
            query += ` AND w.id = $${paramCount}`;
            params.push(warehouseId);
            paramCount++;
        }

        query += ` GROUP BY p.id, p.code, p.name, p.unit, w.id, w.name, p.price_purchase, p.price_sale`;

        if (lowStock) {
            query += ` HAVING COALESCE(SUM(im.quantity), 0) < $${paramCount}`;
            params.push(lowStock);
            paramCount++;
        }

        query += ` ORDER BY p.name, w.name`;

        const result = await pool.query(query, params);
        res.json({ inventory: result.rows });
    } catch (error) {
        console.error('Ошибка получения остатков:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', inventory: [] });
    }
});

// Финансовый отчет
router.get('/financial-summary', authenticate, async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const userLicenseId = req.user.license_id;

        let salesParams = [];
        let purchasesParams = [];
        let salesParamCount = 1;
        let purchasesParamCount = 1;
        let salesDateFilter = '';
        let purchasesDateFilter = '';

        // Build license filter
        let salesLicenseFilter = '';
        let purchasesLicenseFilter = '';
        let balanceLicenseFilter = '';

        if (userLicenseId) {
            salesLicenseFilter = ` AND license_id = $${salesParamCount}`;
            salesParams.push(userLicenseId);
            salesParamCount++;

            purchasesLicenseFilter = ` AND license_id = $${purchasesParamCount}`;
            purchasesParams.push(userLicenseId);
            purchasesParamCount++;

            balanceLicenseFilter = ` AND license_id = $1`;
        }

        if (dateFrom) {
            salesDateFilter += ` AND document_date >= $${salesParamCount}`;
            salesParams.push(dateFrom);
            salesParamCount++;

            purchasesDateFilter += ` AND document_date >= $${purchasesParamCount}`;
            purchasesParams.push(dateFrom);
            purchasesParamCount++;
        }

        if (dateTo) {
            salesDateFilter += ` AND document_date <= $${salesParamCount}`;
            salesParams.push(dateTo);
            salesParamCount++;

            purchasesDateFilter += ` AND document_date <= $${purchasesParamCount}`;
            purchasesParams.push(dateTo);
            purchasesParamCount++;
        }

        // Доходы от продаж
        const salesQuery = `
      SELECT 
        COALESCE(SUM(final_amount), 0) as total_sales,
        COALESCE(SUM(vat_amount), 0) as total_vat
      FROM sales
      WHERE 1=1 ${salesLicenseFilter} ${salesDateFilter}
    `;

        // Расходы на закупки
        const purchasesQuery = `
      SELECT 
        COALESCE(SUM(final_amount), 0) as total_purchases
      FROM purchases
      WHERE 1=1 ${purchasesLicenseFilter} ${purchasesDateFilter}
    `;

        // Баланс по счетам
        const balanceQuery = `
      SELECT 
        COALESCE(SUM(balance), 0) as total_balance
      FROM bank_accounts
      WHERE is_active = true ${balanceLicenseFilter}
    `;

        const [salesResult, purchasesResult, balanceResult] = await Promise.all([
            pool.query(salesQuery, salesParams),
            pool.query(purchasesQuery, purchasesParams),
            pool.query(balanceQuery, userLicenseId ? [userLicenseId] : [])
        ]);

        const totalSales = parseFloat(salesResult.rows[0]?.total_sales || 0);
        const totalPurchases = parseFloat(purchasesResult.rows[0]?.total_purchases || 0);
        const profit = totalSales - totalPurchases;

        res.json({
            financial: {
                totalSales,
                totalPurchases,
                profit,
                profitMargin: totalSales > 0 ? ((profit / totalSales) * 100).toFixed(2) : 0,
                totalVat: parseFloat(salesResult.rows[0]?.total_vat || 0),
                totalBalance: parseFloat(balanceResult.rows[0]?.total_balance || 0)
            }
        });
    } catch (error) {
        console.error('Ошибка получения финансового отчета:', error.message);
        res.status(500).json({
            error: 'Ошибка сервера',
            financial: { totalSales: 0, totalPurchases: 0, profit: 0, profitMargin: 0, totalVat: 0, totalBalance: 0 }
        });
    }
});

// Отчет по контрагентам
router.get('/counterparty-report', authenticate, async (req, res) => {
    try {
        const { type, dateFrom, dateTo } = req.query;

        let query = `
      SELECT 
        c.id,
        c.code,
        c.name,
        c.type,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.id END) as sales_count,
        COALESCE(SUM(s.final_amount), 0) as total_sales,
        COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN p.id END) as purchases_count,
        COALESCE(SUM(p.final_amount), 0) as total_purchases
      FROM counterparties c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.status != 'draft'
      LEFT JOIN purchases p ON c.id = p.counterparty_id AND p.status != 'draft'
      WHERE c.is_active = true
    `;

        const params = [];
        let paramCount = 1;

        if (req.user.license_id) {
            query += ` AND (c.license_id = $${paramCount} OR c.license_id IS NULL)`;
            params.push(req.user.license_id);
            paramCount++;
        }

        if (type) {
            query += ` AND c.type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }

        if (dateFrom) {
            query += ` AND (s.document_date >= $${paramCount} OR p.document_date >= $${paramCount})`;
            params.push(dateFrom);
            paramCount++;
        }

        if (dateTo) {
            query += ` AND (s.document_date <= $${paramCount} OR p.document_date <= $${paramCount})`;
            params.push(dateTo);
            paramCount++;
        }

        query += ` GROUP BY c.id, c.code, c.name, c.type ORDER BY (COALESCE(SUM(s.final_amount), 0) + COALESCE(SUM(p.final_amount), 0)) DESC`;

        const result = await pool.query(query, params);
        res.json({ counterparties: result.rows });
    } catch (error) {
        console.error('Ошибка получения отчета по контрагентам:', error.message);
        res.status(500).json({ error: 'Ошибка сервера', counterparties: [] });
    }
});

// Dashboard данные
router.get('/dashboard', authenticate, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const userLicenseId = req.user.license_id;

        // Продажи за сегодня
        let todaySalesData = { amount: 0, count: 0 };
        try {
            const licenseFilter = userLicenseId ? ' AND license_id = $2' : '';
            const params = userLicenseId ? [today, userLicenseId] : [today];
            const todaySales = await pool.query(
                `SELECT COALESCE(SUM(final_amount), 0) as amount, COUNT(*) as count
                 FROM sales WHERE DATE(document_date) = $1${licenseFilter}`,
                params
            );
            todaySalesData = {
                amount: parseFloat(todaySales.rows[0]?.amount || 0),
                count: parseInt(todaySales.rows[0]?.count || 0)
            };
        } catch (e) {
            console.error('Dashboard: Error fetching today sales:', e.message);
        }

        // Продажи за месяц
        let monthSalesData = { amount: 0, count: 0 };
        try {
            const licenseFilter = userLicenseId ? ' AND license_id = $2' : '';
            const params = userLicenseId ? [monthStart, userLicenseId] : [monthStart];
            const monthSales = await pool.query(
                `SELECT COALESCE(SUM(final_amount), 0) as amount, COUNT(*) as count
                 FROM sales WHERE document_date >= $1${licenseFilter}`,
                params
            );
            monthSalesData = {
                amount: parseFloat(monthSales.rows[0]?.amount || 0),
                count: parseInt(monthSales.rows[0]?.count || 0)
            };
        } catch (e) {
            console.error('Dashboard: Error fetching month sales:', e.message);
        }

        // Количество товаров
        let productsCount = 0;
        try {
            const licenseFilter = userLicenseId ? ' AND license_id = $1' : '';
            const params = userLicenseId ? [userLicenseId] : [];
            const products = await pool.query(
                `SELECT COUNT(*) as count FROM products WHERE is_active = true${licenseFilter}`,
                params
            );
            productsCount = parseInt(products.rows[0]?.count || 0);
        } catch (e) {
            console.error('Dashboard: Error fetching products count:', e.message);
        }

        // Количество активных пользователей
        let activeUsersCount = 0;
        try {
            const licenseFilter = userLicenseId ? ' AND license_id = $1' : '';
            const params = userLicenseId ? [userLicenseId] : [];
            const activeUsers = await pool.query(
                `SELECT COUNT(*) as count FROM users WHERE is_active = true${licenseFilter}`,
                params
            );
            activeUsersCount = parseInt(activeUsers.rows[0]?.count || 0);
        } catch (e) {
            console.error('Dashboard: Error fetching users count:', e.message);
        }

        // Товары с низким остатком (РЕАЛЬНЫЙ запрос)
        let lowStockProducts = [];
        try {
            const licenseFilter = userLicenseId ? ' AND p.license_id = $1' : '';
            const params = userLicenseId ? [userLicenseId] : [];
            const lowStock = await pool.query(
                `SELECT 
                    p.id, p.name, p.min_stock,
                    COALESCE(w.name, 'Основной') as warehouse,
                    COALESCE(SUM(im.quantity), 0) as quantity
                 FROM products p
                 LEFT JOIN inventory_movements im ON p.id = im.product_id
                 LEFT JOIN warehouses w ON im.warehouse_id = w.id
                 WHERE p.is_active = true${licenseFilter}
                 GROUP BY p.id, p.name, p.min_stock, w.name
                 HAVING COALESCE(SUM(im.quantity), 0) < GREATEST(p.min_stock, 10)
                 ORDER BY COALESCE(SUM(im.quantity), 0) ASC
                 LIMIT 20`,
                params
            );
            lowStockProducts = lowStock.rows.map(row => ({
                name: row.name,
                warehouse: row.warehouse,
                quantity: parseFloat(row.quantity),
                minStock: parseFloat(row.min_stock || 10)
            }));
        } catch (e) {
            console.error('Dashboard: Error fetching low stock:', e.message);
        }

        res.json({
            dashboard: {
                todaySales: todaySalesData,
                monthSales: monthSalesData,
                lowStockProducts,
                productsCount,
                activeUsersCount
            }
        });
    } catch (error) {
        console.error('Ошибка получения данных dashboard:', error.message);
        res.status(500).json({
            error: 'Ошибка сервера',
            dashboard: {
                todaySales: { amount: 0, count: 0 },
                monthSales: { amount: 0, count: 0 },
                lowStockProducts: [],
                productsCount: 0,
                activeUsersCount: 0
            }
        });
    }
});

export default router;
