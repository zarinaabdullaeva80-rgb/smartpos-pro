import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';

const router = express.Router();

// ============================================================================
// ABC-АНАЛИЗ ТОВАРОВ
// ============================================================================

/**
 * ABC-анализ товаров по выручке
 * Классификация:
 * A - 20% товаров дают 80% выручки
 * B - 30% товаров дают 15% выручки
 * C - 50% товаров дают 5% выручки
 */
router.get('/abc-analysis', authenticate, checkPermission('reports.analytics'), async (req, res) => {
    try {
        const { startDate, endDate, warehouseId } = req.query;

        // Использовать период по умолчанию (последние  30 дней)
        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        let query = `
            WITH product_revenue AS (
                SELECT 
                    p.id,
                    p.name,
                    p.barcode,
                    p.code,
                    pc.name as category_name,
                    SUM(si.quantity * si.price) as revenue,
                    SUM(si.quantity) as quantity_sold,
                    AVG(si.price) as avg_price,
                    COUNT(DISTINCT s.id) as sales_count
                FROM products p
                JOIN sale_items si ON p.id = si.product_id
                JOIN sales s ON si.sale_id = s.id
                LEFT JOIN product_categories pc ON p.category_id = pc.id
                WHERE s.status = 'confirmed'
                    AND s.document_date BETWEEN $1 AND $2
                    AND s.organization_id = $3
        `;

        const params = [sd, ed, req.user?.organization_id];

        if (warehouseId) {
            query += ` AND s.warehouse_id = $${params.length + 1}`;
            params.push(warehouseId);
        }

        query += `
                GROUP BY p.id, p.name, p.barcode, p.code, pc.name
            ),
            ranked_products AS (
                SELECT *,
                    SUM(revenue) OVER () as total_revenue,
                    SUM(revenue) OVER (ORDER BY revenue DESC) as cumulative_revenue,
                    ROW_NUMBER() OVER (ORDER BY revenue DESC) as rank,
                    COUNT(*) OVER () as total_products
                FROM product_revenue
            )
            SELECT *,
                ROUND((revenue / NULLIF(total_revenue, 0) * 100)::numeric, 2) as revenue_percent,
                ROUND((cumulative_revenue / NULLIF(total_revenue, 0) * 100)::numeric, 2) as cumulative_percent,
                CASE 
                    WHEN cumulative_revenue / NULLIF(total_revenue, 0) <= 0.8 THEN 'A'
                    WHEN cumulative_revenue / NULLIF(total_revenue, 0) <= 0.95 THEN 'B'
                    ELSE 'C'
                END as category
            FROM ranked_products
            ORDER BY revenue DESC
        `;

        const result = await pool.query(query, params);

        // Статистика по категориям
        const stats = {
            A: { count: 0, revenue: 0, percent: 0 },
            B: { count: 0, revenue: 0, percent: 0 },
            C: { count: 0, revenue: 0, percent: 0 }
        };

        result.rows.forEach(row => {
            stats[row.category].count++;
            stats[row.category].revenue += parseFloat(row.revenue);
        });

        const totalRevenue = result.rows[0]?.total_revenue || 0;
        Object.keys(stats).forEach(key => {
            stats[key].percent = totalRevenue > 0
                ? (stats[key].revenue / totalRevenue * 100).toFixed(2)
                : 0;
            stats[key].revenue = parseFloat(stats[key].revenue.toFixed(2));
        });

        res.json({
            products: result.rows,
            stats: stats,
            period: { startDate: sd, endDate: ed },
            totalRevenue: parseFloat(totalRevenue).toFixed(2)
        });
    } catch (error) {
        console.error('ABC Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ФИНАНСОВЫЕ ОТЧЁТЫ
// ============================================================================

/**
 * Отчёт о прибылях и убытках (P&L / ОПиУ)
 */
router.get('/profit-loss', authenticate, checkPermission('reports.finance'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        // Доходы от продаж
        const salesResult = await pool.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as sales_count
            FROM sales 
            WHERE status = 'confirmed' 
            AND document_date BETWEEN $1 AND $2
            AND organization_id = $3
        `, [sd, ed, req.user?.organization_id]);

        // Себестоимость проданных товаров
        const cogsResult = await pool.query(`
            SELECT COALESCE(SUM(si.quantity * COALESCE(p.price_purchase, 0)), 0) as cogs
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            WHERE s.status = 'confirmed'
            AND s.document_date BETWEEN $1 AND $2
            AND s.organization_id = $3
        `, [sd, ed, req.user?.organization_id]);

        // Расходы
        const expensesResult = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as operating_expenses,
                COUNT(*) as expense_count
            FROM finance_transactions
            WHERE type = 'expense'
            AND transaction_date BETWEEN $1 AND $2
            AND organization_id = $3
        `, [sd, ed, req.user?.organization_id]);

        // Возвраты
        const returnsResult = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as returns_amount
            FROM returns
            WHERE status = 'confirmed'
            AND return_date BETWEEN $1 AND $2
            AND organization_id = $3
        `, [sd, ed, req.user?.organization_id]);

        const revenue = parseFloat(salesResult.rows[0].revenue);
        const returns = parseFloat(returnsResult.rows[0].returns_amount);
        const netRevenue = revenue - returns;
        const cogs = parseFloat(cogsResult.rows[0].cogs);
        const grossProfit = netRevenue - cogs;
        const operatingExpenses = parseFloat(expensesResult.rows[0].operating_expenses);
        const netProfit = grossProfit - operatingExpenses;

        res.json({
            period: { startDate: sd, endDate: ed },
            revenue: revenue.toFixed(2),
            returns: returns.toFixed(2),
            netRevenue: netRevenue.toFixed(2),
            costOfGoods: cogs.toFixed(2),
            grossProfit: grossProfit.toFixed(2),
            grossMargin: netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(2) : '0.00',
            operatingExpenses: operatingExpenses.toFixed(2),
            netProfit: netProfit.toFixed(2),
            netMargin: netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : '0.00',
            salesCount: parseInt(salesResult.rows[0].sales_count),
            expenseCount: parseInt(expensesResult.rows[0].expense_count)
        });
    } catch (error) {
        console.error('P&L Report error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Баланс (Balance Sheet)
 */
router.get('/balance-sheet', authenticate, checkPermission('reports.finance'), async (req, res) => {
    try {
        const { date } = req.query;
        const balanceDate = date || new Date().toISOString().split('T')[0];

        // АКТИВЫ
        // Текущие активы
        const cashResult = await pool.query(`
            SELECT COALESCE(SUM(
                CASE 
                    WHEN type = 'income' THEN amount
                    WHEN type = 'expense' THEN -amount
                    ELSE 0
                END
            ), 0) as cash
            FROM finance_transactions
            WHERE transaction_date <= $1 AND organization_id = $2
        `, [balanceDate, req.user?.organization_id]);

        const inventoryResult = await pool.query(`
            SELECT COALESCE(SUM(im.quantity * COALESCE(p.price_purchase, p.price_sale, 0)), 0) as inventory_value
            FROM inventory_movements im
            JOIN products p ON im.product_id = p.id
            WHERE p.organization_id = $1
        `, [req.user?.organization_id]);

        const receivablesResult = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as receivables
            FROM sales
            WHERE status = 'confirmed'
            AND payment_status NOT IN ('paid')
            AND document_date <= $1
            AND organization_id = $2
        `, [balanceDate, req.user?.organization_id]);

        // ОБЯЗАТЕЛЬСТВА
        const payablesResult = await pool.query(`
            SELECT COALESCE(SUM(total_amount), 0) as payables
            FROM purchases
            WHERE status = 'confirmed'
            AND payment_status NOT IN ('paid')
            AND document_date <= $1
            AND organization_id = $2
        `, [balanceDate, req.user?.organization_id]);

        const cash = parseFloat(cashResult.rows[0].cash);
        const inventory = parseFloat(inventoryResult.rows[0].inventory_value);
        const receivables = parseFloat(receivablesResult.rows[0].receivables);
        const totalAssets = cash + inventory + receivables;

        const payables = parseFloat(payablesResult.rows[0].payables);
        const totalLiabilities = payables;

        const equity = totalAssets - totalLiabilities;

        res.json({
            date: balanceDate,
            assets: {
                current: {
                    cash: cash.toFixed(2),
                    inventory: inventory.toFixed(2),
                    receivables: receivables.toFixed(2),
                    total: (cash + inventory + receivables).toFixed(2)
                },
                total: totalAssets.toFixed(2)
            },
            liabilities: {
                current: {
                    payables: payables.toFixed(2),
                    total: payables.toFixed(2)
                },
                total: totalLiabilities.toFixed(2)
            },
            equity: {
                retainedEarnings: equity.toFixed(2),
                total: equity.toFixed(2)
            },
            totalLiabilitiesAndEquity: (totalLiabilities + equity).toFixed(2)
        });
    } catch (error) {
        console.error('Balance Sheet error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Прогнозирование спроса (Moving Average)
 */
router.get('/demand-forecast', authenticate, checkPermission('reports.analytics'), async (req, res) => {
    try {
        const { productId, days = 30 } = req.query;

        if (!productId) {
            return res.status(400).json({ error: 'Укажите productId' });
        }

        // Получить историю продаж за последние N дней
        const historyResult = await pool.query(`
            SELECT 
                DATE(s.document_date) as sale_date,
                SUM(si.quantity) as quantity_sold
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE si.product_id = $1
            AND s.status = 'confirmed'
            AND s.document_date >= NOW() - INTERVAL '${parseInt(days)} days'
            AND s.organization_id = $2
            GROUP BY DATE(s.document_date)
            ORDER BY sale_date
        `, [productId, req.user?.organization_id]);

        if (historyResult.rows.length === 0) {
            return res.json({
                productId,
                forecast: null,
                message: 'Недостаточно данных для прогноза'
            });
        }

        // Moving Average (скользящее среднее за 7 дней)
        const window = Math.min(7, historyResult.rows.length);
        const recentSales = historyResult.rows.slice(-window);
        const avgDailySales = recentSales.reduce((sum, row) => sum + parseFloat(row.quantity_sold), 0) / window;

        // Прогноз на следующие 7, 14, 30 дней
        const productResult = await pool.query('SELECT name FROM products WHERE id = $1 AND organization_id = $2', [productId, req.user?.organization_id]);
        const stockResult = await pool.query('SELECT COALESCE(SUM(quantity), 0) as stock FROM inventory_movements WHERE product_id = $1', [productId]);
        const product = productResult.rows[0];
        const currentStock = parseFloat(stockResult.rows[0]?.stock || 0);

        res.json({
            productId,
            productName: product?.name,
            currentStock,
            historicalData: historyResult.rows,
            avgDailySales: avgDailySales.toFixed(2),
            forecast: {
                next7Days: (avgDailySales * 7).toFixed(0),
                next14Days: (avgDailySales * 14).toFixed(0),
                next30Days: (avgDailySales * 30).toFixed(0)
            },
            stockoutRisk: {
                days7: currentStock < (avgDailySales * 7),
                days14: currentStock < (avgDailySales * 14),
                days30: currentStock < (avgDailySales * 30)
            },
            recommendedOrder: Math.max(0, (avgDailySales * 30) - currentStock).toFixed(0)
        });
    } catch (error) {
        console.error('Demand Forecast error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Отчёт по категориям товаров
 */
router.get('/category-analysis', authenticate, checkPermission('reports.analytics'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        const result = await pool.query(`
            SELECT 
                COALESCE(c.name, 'Без категории') as category_name,
                COUNT(DISTINCT p.id) as products_count,
                SUM(si.quantity) as total_quantity,
                SUM(si.quantity * si.price) as total_revenue,
                AVG(si.price) as avg_price
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE s.status = 'confirmed'
            AND s.document_date BETWEEN $1 AND $2
            AND s.organization_id = $3
            GROUP BY c.name
            ORDER BY total_revenue DESC
        `, [sd, ed, req.user?.organization_id]);

        res.json({
            period: { startDate: sd, endDate: ed },
            categories: result.rows
        });
    } catch (error) {
        console.error('Category Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ГРАФИКИ ПРОДАЖ
// ============================================================================

/**
 * Данные для графика продаж по дням/неделям/месяцам
 */
router.get('/sales-chart', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        let dateFormat;
        switch (groupBy) {
            case 'month':
                dateFormat = "TO_CHAR(document_date, 'YYYY-MM')";
                break;
            case 'week':
                dateFormat = "TO_CHAR(document_date, 'IYYY-IW')";
                break;
            default: // day
                dateFormat = "TO_CHAR(document_date, 'YYYY-MM-DD')";
        }

        const result = await pool.query(`
            SELECT 
                ${dateFormat} as period,
                COUNT(*) as sales_count,
                SUM(total_amount) as revenue,
                AVG(total_amount) as avg_check,
                SUM(CASE WHEN final_amount < total_amount THEN (total_amount - final_amount) ELSE 0 END) as total_discount
            FROM sales
            WHERE status = 'confirmed'
            AND document_date BETWEEN $1 AND $2
            AND organization_id = $3
            GROUP BY ${dateFormat}
            ORDER BY period
        `, [sd, ed, req.user?.organization_id]);

        res.json({
            period: { startDate: sd, endDate: ed, groupBy },
            data: result.rows
        });
    } catch (error) {
        console.error('Sales Chart error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Топ 10 самых продаваемых товаров
 */
router.get('/top-products', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, limit = 10, sortBy = 'revenue' } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        let orderByClause;
        switch (sortBy) {
            case 'quantity':
                orderByClause = 'total_quantity DESC';
                break;
            case 'profit':
                orderByClause = '(total_revenue - total_cost) DESC';
                break;
            default: // revenue
                orderByClause = 'total_revenue DESC';
        }

        const result = await pool.query(`
            SELECT 
                p.id,
                p.code,
                p.name,
                p.barcode,
                pc.name as category_name,
                SUM(si.quantity) as total_quantity,
                SUM(si.quantity * si.price) as total_revenue,
                SUM(si.quantity * COALESCE(p.price_purchase, 0)) as total_cost,
                AVG(si.price) as avg_price,
                COUNT(DISTINCT s.id) as sales_count
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE s.status = 'confirmed'
            AND s.document_date BETWEEN $1 AND $2
            AND s.organization_id = $4
            GROUP BY p.id, p.code, p.name, p.barcode, pc.name
            ORDER BY ${orderByClause}
            LIMIT $3
        `, [sd, ed, limit, req.user?.organization_id]);

        res.json({
            period: { startDate: sd, endDate: ed },
            sortBy,
            products: result.rows.map(row => ({
                ...row,
                profit: (parseFloat(row.total_revenue) - parseFloat(row.total_cost)).toFixed(2),
                margin: row.total_revenue > 0
                    ? (((parseFloat(row.total_revenue) - parseFloat(row.total_cost)) / parseFloat(row.total_revenue)) * 100).toFixed(2)
                    : '0.00'
            }))
        });
    } catch (error) {
        console.error('Top Products error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Анализ производительности кассиров
 */
router.get('/cashier-performance', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        const result = await pool.query(`
            SELECT 
                u.id as user_id,
                u.full_name as cashier_name,
                u.username,
                COUNT(DISTINCT s.id) as sales_count,
                SUM(s.total_amount) as total_revenue,
                AVG(s.total_amount) as avg_check,
                SUM(s.total_amount - s.final_amount) as total_discounts,
                COUNT(DISTINCT DATE(s.document_date)) as working_days,
                MIN(s.created_at) as first_sale,
                MAX(s.created_at) as last_sale
            FROM sales s
            JOIN users u ON s.user_id = u.id
            WHERE s.status = 'confirmed'
            AND s.document_date BETWEEN $1 AND $2
            AND s.organization_id = $3
            GROUP BY u.id, u.full_name, u.username
            ORDER BY total_revenue DESC
        `, [sd, ed, req.user?.organization_id]);

        const cashiers = result.rows.map(row => ({
            ...row,
            avg_sales_per_day: row.working_days > 0
                ? (parseFloat(row.sales_count) / parseFloat(row.working_days)).toFixed(2)
                : '0.00',
            avg_revenue_per_day: row.working_days > 0
                ? (parseFloat(row.total_revenue) / parseFloat(row.working_days)).toFixed(2)
                : '0.00',
            discount_rate: row.total_revenue > 0
                ? ((parseFloat(row.total_discounts) / (parseFloat(row.total_revenue) + parseFloat(row.total_discounts))) * 100).toFixed(2)
                : '0.00'
        }));

        res.json({
            period: { startDate: sd, endDate: ed },
            cashiers
        });
    } catch (error) {
        console.error('Cashier Performance error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Отчёты по складам
 */
router.get('/warehouse-report', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, warehouseId } = req.query;

        const sd = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ed = endDate || new Date().toISOString().split('T')[0];

        let query = `
            SELECT 
                w.id as warehouse_id,
                w.code as warehouse_code,
                w.name as warehouse_name,
                COUNT(DISTINCT s.id) as sales_count,
                SUM(s.total_amount) as total_revenue,
                COUNT(DISTINCT si.product_id) as unique_products,
                SUM(si.quantity) as total_quantity_sold,
                AVG(s.total_amount) as avg_check
            FROM warehouses w
            LEFT JOIN sales s ON w.id = s.warehouse_id AND s.status = 'confirmed' 
                AND s.document_date BETWEEN $1 AND $2
            LEFT JOIN sale_items si ON s.id = si.sale_id
            WHERE w.is_active = true AND w.organization_id = $3
        `;

        const params = [sd, ed, req.user?.organization_id];

        if (warehouseId) {
            query += ` AND w.id = $${params.length + 1}`;
            params.push(warehouseId);
        }

        query += `
            GROUP BY w.id, w.code, w.name
            ORDER BY total_revenue DESC NULLS LAST
        `;

        const result = await pool.query(query, params);

        // Получить текущие остатки по складам
        const inventoryQuery = `
            SELECT 
                w.id as warehouse_id,
                COUNT(DISTINCT im.product_id) as products_in_stock,
                SUM(im.quantity) as total_quantity,
                SUM(COALESCE(im.quantity * im.cost_price, 0)) as inventory_value
            FROM warehouses w
            LEFT JOIN inventory_movements im ON w.id = im.warehouse_id
            WHERE w.is_active = true AND w.organization_id = $1
            ${warehouseId ? 'AND w.id = $2' : ''}
            GROUP BY w.id
        `;

        const inventoryResult = await pool.query(
            inventoryQuery,
            warehouseId ? [req.user?.organization_id, warehouseId] : [req.user?.organization_id]
        );

        // Объединить данные
        const warehouses = result.rows.map(row => {
            const inventory = inventoryResult.rows.find(inv => inv.warehouse_id === row.warehouse_id) || {};
            return {
                ...row,
                products_in_stock: inventory.products_in_stock || 0,
                inventory_quantity: inventory.total_quantity || 0,
                inventory_value: parseFloat(inventory.inventory_value || 0).toFixed(2)
            };
        });

        res.json({
            period: { startDate: sd, endDate: ed },
            warehouses
        });
    } catch (error) {
        console.error('Warehouse Report error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// RFM-АНАЛИЗ КЛИЕНТОВ
// ============================================================================

/**
 * RFM-анализ (Recency, Frequency, Monetary)
 * Сегментация клиентов по давности, частоте и объёму покупок
 */
router.get('/rfm-analysis', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            WITH customer_metrics AS (
                SELECT 
                    c.id,
                    c.name,
                    c.phone,
                    MAX(s.document_date) as last_purchase,
                    COUNT(s.id) as purchase_count,
                    COALESCE(SUM(s.total_amount), 0) as total_spent,
                    EXTRACT(DAY FROM NOW() - MAX(s.document_date)) as days_since_last
                FROM customers c
                LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'confirmed'
                WHERE c.organization_id = $1
                GROUP BY c.id, c.name, c.phone
                HAVING COUNT(s.id) > 0
            ),
            rfm_scores AS (
                SELECT *,
                    NTILE(5) OVER (ORDER BY days_since_last DESC) as r_score,
                    NTILE(5) OVER (ORDER BY purchase_count) as f_score,
                    NTILE(5) OVER (ORDER BY total_spent) as m_score
                FROM customer_metrics
            )
            SELECT *,
                CASE 
                    WHEN r_score >= 4 AND f_score >= 4 THEN 'champions'
                    WHEN r_score >= 3 AND f_score >= 3 AND m_score >= 3 THEN 'loyal'
                    WHEN r_score >= 4 AND f_score <= 2 THEN 'new_customers'
                    WHEN r_score <= 2 AND f_score >= 3 THEN 'at_risk'
                    WHEN r_score <= 2 AND f_score <= 2 THEN 'lost'
                    ELSE 'regular'
                END as segment
            FROM rfm_scores
            ORDER BY total_spent DESC
        `, [req.user?.organization_id]);

        // Собрать статистику по сегментам
        const segments = {};
        result.rows.forEach(row => {
            if (!segments[row.segment]) {
                segments[row.segment] = { count: 0, totalSpent: 0, customers: [] };
            }
            segments[row.segment].count++;
            segments[row.segment].totalSpent += parseFloat(row.total_spent);
        });

        res.json({
            customers: result.rows,
            segments,
            totalCustomers: result.rows.length
        });
    } catch (error) {
        console.error('RFM Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
