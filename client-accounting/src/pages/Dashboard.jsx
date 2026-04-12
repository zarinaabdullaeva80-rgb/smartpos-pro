import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { TrendingUp, TrendingDown, Package, DollarSign, Users, AlertTriangle, ShoppingCart, Calendar, RefreshCw } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatCurrency as formatCurrencyUZS, formatNumber as formatNumberUZS } from '../utils/formatters';
import { useI18n } from '../i18n';
import '../styles/Dashboard.css';

function Dashboard() {
    const { t } = useI18n();
    const [dashboard, setDashboard] = useState(null);
    const [salesAnalytics, setSalesAnalytics] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('week'); // week, month, year
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, [period]);

    const getPeriodDates = () => {
        const today = new Date();
        let dateFrom, dateTo, groupBy;

        switch (period) {
            case 'today':
                dateFrom = format(today, 'yyyy-MM-dd');
                dateTo = format(today, 'yyyy-MM-dd');
                groupBy = 'day';
                break;
            case 'week':
                dateFrom = format(subDays(today, 7), 'yyyy-MM-dd');
                dateTo = format(today, 'yyyy-MM-dd');
                groupBy = 'day';
                break;
            case 'month':
                dateFrom = format(startOfMonth(today), 'yyyy-MM-dd');
                dateTo = format(endOfMonth(today), 'yyyy-MM-dd');
                groupBy = 'day';
                break;
            case 'year':
                dateFrom = format(subMonths(today, 12), 'yyyy-MM-dd');
                dateTo = format(today, 'yyyy-MM-dd');
                groupBy = 'month';
                break;
            default:
                dateFrom = format(subDays(today, 7), 'yyyy-MM-dd');
                dateTo = format(today, 'yyyy-MM-dd');
                groupBy = 'day';
        }

        return { dateFrom, dateTo, groupBy };
    };

    const loadDashboardData = async () => {
        try {
            setRefreshing(true);
            const { dateFrom, dateTo, groupBy } = getPeriodDates();

            const [dashboardRes, analyticsRes, productsRes, financialRes] = await Promise.all([
                reportsAPI.getDashboard(),
                reportsAPI.getSalesAnalytics({ dateFrom, dateTo, groupBy }),
                reportsAPI.getTopProducts({ dateFrom, dateTo, limit: 10 }),
                reportsAPI.getFinancialSummary({ dateFrom, dateTo })
            ]);

            setDashboard(dashboardRes.data?.dashboard || {});
            setSalesAnalytics((analyticsRes.data?.analytics || []).reverse());
            setTopProducts(productsRes.data?.topProducts || []);

            // Сохраняем финансовые данные для отображения
            if (dashboardRes.data?.dashboard) {
                dashboardRes.data.dashboard.financial = financialRes.data?.financial || {};
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        loadDashboardData();
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const formatNumber = (value) => {
        return formatNumberUZS(value);
    };

    const formatDate = (dateStr) => {
        try {
            return format(new Date(dateStr), 'dd MMM', { locale: ru });
        } catch {
            return dateStr;
        }
    };

    const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) return 0;
        return ((current - previous) / previous * 100).toFixed(1);
    };

    // Цвета для круговой диаграммы
    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

    // Подготовка данных для круговой диаграммы (топ 5 товаров)
    const pieData = topProducts.slice(0, 5).map((product, index) => ({
        name: product.name,
        value: parseFloat(product.total_revenue),
        fill: COLORS[index % COLORS.length]
    }));

    // Средний чек
    const averageCheck = salesAnalytics.length > 0
        ? salesAnalytics.reduce((sum, item) => sum + (parseFloat(item.average_sale) || 0), 0) / salesAnalytics.length
        : 0;

    // Общая выручка за период
    const totalRevenue = salesAnalytics.reduce((sum, item) => sum + (parseFloat(item.total_revenue) || 0), 0);
    const totalSalesCount = salesAnalytics.reduce((sum, item) => sum + (parseInt(item.sales_count) || 0), 0);

    return (
        <div className="dashboard fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p className="text-muted">{t('dashboard.subtitle', 'Обзор ключевых показателей и аналитики')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={handleRefresh}
                        className={`btn btn-secondary ${refreshing ? 'loading' : ''}`}
                        disabled={refreshing}
                    >
                        <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                        {refreshing ? t('common.loading', 'Обновление...') : t('common.apply', 'Обновить')}
                    </button>
                </div>
            </div>

            {/* Period Filter */}
            <div className="card mb-3">
                <div className="period-selector">
                    <button
                        className={`period-btn ${period === 'today' ? 'active' : ''}`}
                        onClick={() => setPeriod('today')}
                    >
                        <Calendar size={16} />
                        {t('dashboard.today', 'Сегодня')}
                    </button>
                    <button
                        className={`period-btn ${period === 'week' ? 'active' : ''}`}
                        onClick={() => setPeriod('week')}
                    >
                        <Calendar size={16} />
                        {t('dashboard.week')}
                    </button>
                    <button
                        className={`period-btn ${period === 'month' ? 'active' : ''}`}
                        onClick={() => setPeriod('month')}
                    >
                        <Calendar size={16} />
                        {t('dashboard.month')}
                    </button>
                    <button
                        className={`period-btn ${period === 'year' ? 'active' : ''}`}
                        onClick={() => setPeriod('year')}
                    >
                        <Calendar size={16} />
                        {t('dashboard.year')}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-4 mb-3">
                <div className="stat-card glass hover-lift">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">{t('dashboard.todayRevenue', 'Выручка за период')}</div>
                        <div className="stat-value">{formatCurrency(totalRevenue)}</div>
                        <div className="stat-meta">
                            <ShoppingCart size={14} />
                            {totalSalesCount} {t('dashboard.sales', 'продаж')}
                        </div>
                    </div>
                </div>

                <div className="stat-card glass hover-lift">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">{t('dashboard.avgCheck', 'Средний чек')}</div>
                        <div className="stat-value">{formatCurrency(averageCheck)}</div>
                        <div className="stat-meta">
                            {averageCheck > 0 ? (
                                <span className="text-success">
                                    <TrendingUp size={14} />
                                    {t('dashboard.activeSales', 'Активные продажи')}
                                </span>
                            ) : (
                                <span className="text-muted">{t('common.noData')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="stat-card glass hover-lift">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                        <Package size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">{t('dashboard.lowStock')}</div>
                        <div className="stat-value">{dashboard?.lowStockProducts?.length || 0}</div>
                        <div className="stat-meta">
                            {(dashboard?.lowStockProducts?.length || 0) > 0 ? (
                                <span className="text-warning">
                                    <AlertTriangle size={14} />
                                    {t('dashboard.needAttention', 'Требуют внимания')}
                                </span>
                            ) : (
                                <span className="text-success">{t('dashboard.allGood', 'Все в порядке')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="stat-card glass hover-lift">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">{t('dashboard.activeEmployees')}</div>
                        <div className="stat-value">{dashboard?.activeUsersCount || 0}</div>
                        <div className="stat-meta">{t('dashboard.inSystem', 'В системе')}</div>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            {
                dashboard?.financial && (
                    <div className="grid grid-3 mb-3">
                        <div className="stat-card glass hover-lift">
                            <div className="stat-content">
                                <div className="stat-label">{t('reports.salesRevenue', 'Общая выручка')}</div>
                                <div className="stat-value" style={{ color: '#10b981' }}>
                                    {formatCurrency(dashboard.financial.totalSales)}
                                </div>
                            </div>
                        </div>
                        <div className="stat-card glass hover-lift">
                            <div className="stat-content">
                                <div className="stat-label">{t('reports.purchaseExpenses', 'Общие закупки')}</div>
                                <div className="stat-value" style={{ color: '#ef4444' }}>
                                    {formatCurrency(dashboard.financial.totalPurchases)}
                                </div>
                            </div>
                        </div>
                        <div className="stat-card glass hover-lift">
                            <div className="stat-content">
                                <div className="stat-label">{t('dashboard.grossProfit', 'Валовая прибыль')}</div>
                                <div className="stat-value" style={{ color: dashboard.financial.profit >= 0 ? '#10b981' : '#ef4444' }}>
                                    {formatCurrency(dashboard.financial.profit)}
                                </div>
                                <div className="stat-meta">
                                    {t('reports.margin', 'Маржа')}: {dashboard.financial.profitMargin}%
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Charts */}
            <div className="grid grid-2 mb-3">
                {/* Sales Trend */}
                <div className="card hover-lift">
                    <div className="card-header">
                        <h2 className="card-title">{t('reports.salesDynamics', 'Динамика продаж')}</h2>
                        <span className="text-muted">{salesAnalytics.length} {t('dashboard.dataPoints', 'точек данных')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={salesAnalytics}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                                dataKey="period"
                                tickFormatter={formatDate}
                                stroke="#94a3b8"
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px'
                                }}
                                labelFormatter={formatDate}
                                formatter={(value, name) => {
                                    if (name === t('reports.revenue', 'Выручка')) return [formatCurrency(value), name];
                                    return [value, name];
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="total_revenue"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                name={t('reports.revenue', 'Выручка')}
                            />
                            <Line
                                type="monotone"
                                dataKey="sales_count"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ fill: '#10b981', r: 4 }}
                                name={t('dashboard.salesCount', 'Кол-во продаж')}
                                yAxisId="right"
                            />
                            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Top Products Bar Chart */}
                <div className="card hover-lift">
                    <div className="card-header">
                        <h2 className="card-title">{t('reports.topByRevenue', 'Топ товаров по выручке')}</h2>
                        <span className="text-muted">{t('dashboard.best', 'Лучшие')} {topProducts.length}</span>
                    </div>
                    {topProducts.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#94a3b8"
                                    width={150}
                                    tick={{ fontSize: 11 }}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Bar dataKey="total_revenue" name={t('reports.revenue', 'Выручка')} radius={[0, 8, 8, 0]}>
                                    {topProducts.slice(0, 8).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{
                            height: 350,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b'
                        }}>
                            <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <p style={{ fontSize: '16px', marginBottom: '8px' }}>{t('dashboard.noSalesData', 'Нет данных о продажах')}</p>
                            <p style={{ fontSize: '13px', opacity: 0.7 }}>{t('dashboard.noSalesHint', 'Проведите первые продажи, чтобы увидеть статистику')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Pie Chart and Sales Table */}
            <div className="grid grid-2 mb-3">
                {/* Pie Chart */}
                <div className="card hover-lift">
                    <div className="card-header">
                        <h2 className="card-title">{t('reports.revenueDistribution', 'Распределение выручки')}</h2>
                        <span className="text-muted">{t('dashboard.top5', 'Топ 5 товаров')}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name.slice(0, 15)}... ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Quick Stats Table */}
                <div className="card hover-lift">
                    <div className="card-header">
                        <h2 className="card-title">{t('dashboard.productSummary', 'Сводка по товарам')}</h2>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>{t('reports.product', 'Товар')}</th>
                                <th>{t('dashboard.sold', 'Продано')}</th>
                                <th>{t('reports.revenue', 'Выручка')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProducts.slice(0, 5).map((product, index) => (
                                <tr key={index}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div
                                                style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '50%',
                                                    background: COLORS[index % COLORS.length]
                                                }}
                                            ></div>
                                            {product.name}
                                        </div>
                                    </td>
                                    <td>{formatNumber(product.total_quantity)} {product.unit || 'шт'}</td>
                                    <td><strong>{formatCurrency(product.total_revenue)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Low Stock Products */}
            {
                (dashboard?.lowStockProducts?.length || 0) > 0 && (
                    <div className="card hover-lift">
                        <div className="card-header">
                            <h2 className="card-title">
                                <AlertTriangle size={20} className="text-warning" />
                                {t('dashboard.lowStockItems', 'Товары с низким остатком')}
                            </h2>
                            <span className="badge badge-warning">{dashboard?.lowStockProducts?.length || 0}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('reports.product', 'Товар')}</th>
                                    <th>{t('sales.warehouse')}</th>
                                    <th>{t('warehouse.stock', 'Остаток')}</th>
                                    <th>{t('common.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashboard.lowStockProducts.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.name}</td>
                                        <td>{item.warehouse}</td>
                                        <td>
                                            <span className="badge badge-warning">
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-danger">
                                                <AlertTriangle size={12} />
                                                {t('dashboard.needPurchase', 'Требуется закупка')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }
        </div >
    );
}

export default Dashboard;
