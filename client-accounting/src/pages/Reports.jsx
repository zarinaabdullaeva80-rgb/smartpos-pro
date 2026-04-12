import React, { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../services/api';
import { connectSocket } from '../services/api';
import { BarChart3, Download, Calendar, RefreshCw, TrendingUp, Package } from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line, Area, AreaChart
} from 'recharts';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function Reports() {
    const toast = useToast();
    const { t } = useI18n();
    const [financial, setFinancial] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [salesAnalytics, setSalesAnalytics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('financial');
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const [financialRes, productsRes, analyticsRes] = await Promise.all([
                reportsAPI.getFinancialSummary({ dateFrom, dateTo }),
                reportsAPI.getTopProducts({ limit: 10, dateFrom, dateTo }),
                reportsAPI.getSalesAnalytics({ dateFrom, dateTo, groupBy: 'day' })
            ]);

            setFinancial(financialRes.data.financial);
            setTopProducts(productsRes.data.topProducts || []);
            setSalesAnalytics((analyticsRes.data.analytics || []).reverse());
        } catch (error) {
            console.error('Ошибка загрузки отчетов:', error);
            setFinancial({ totalSales: 0, totalPurchases: 0, profit: 0, profitMargin: 0 });
            setTopProducts([]);
            setSalesAnalytics([]);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo]);

    useEffect(() => {
        loadReports();

        // WebSocket: обновлять отчёты при новых продажах
        const socket = connectSocket();
        if (socket) {
            socket.on('sale:created', () => {
                loadReports();
            });
            socket.on('sale:updated', () => {
                loadReports();
            });
        }

        return () => {
            if (socket) {
                socket.off('sale:created');
                socket.off('sale:updated');
            }
        };
    }, [loadReports]);

    const setQuickPeriod = (period) => {
        const today = new Date();
        const from = new Date();
        switch (period) {
            case 'today': break;
            case 'week': from.setDate(today.getDate() - 7); break;
            case 'month': from.setMonth(today.getMonth() - 1); break;
            case 'quarter': from.setMonth(today.getMonth() - 3); break;
            case 'year': from.setFullYear(today.getFullYear() - 1); break;
            default: break;
        }
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
    };

    const formatCurrency = (value) => formatCurrencyUZS(value);

    const pieData = topProducts.slice(0, 6).map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        value: parseFloat(p.total_revenue)
    }));

    const barData = topProducts.slice(0, 5).map(p => ({
        name: p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name,
        revenue: parseFloat(p.total_revenue),
        quantity: parseFloat(p.total_quantity)
    }));

    const lineData = salesAnalytics.map(row => ({
        date: row.period ? new Date(row.period).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '',
        revenue: parseFloat(row.total_revenue || 0),
        count: parseInt(row.sales_count || 0)
    }));

    const handleExport = () => {
        try {
            const wb = XLSX.utils.book_new();

            const financialData = [
                ['Финансовый отчет'],
                [''],
                ['Показатель', 'Значение (сум)'],
                ['Доходы от продаж', financial?.totalSales || 0],
                ['Расходы на закупки', financial?.totalPurchases || 0],
                ['Прибыль', financial?.profit || 0],
                ['Маржа прибыли (%)', financial?.profitMargin || 0]
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(financialData);
            ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, ws1, 'Финансовый отчет');

            const topProductsData = [
                ['Топ товаров по выручке'],
                [''],
                ['№', 'Товар', 'Количество', 'Выручка (сум)']
            ];
            topProducts.forEach((product, index) => {
                topProductsData.push([index + 1, product.name, parseFloat(product.total_quantity), parseFloat(product.total_revenue)]);
            });
            const ws2 = XLSX.utils.aoa_to_sheet(topProductsData);
            ws2['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Топ товаров');

            if (salesAnalytics.length > 0) {
                const analyticsData = [
                    ['Продажи по дням'],
                    [''],
                    ['Дата', 'Кол-во продаж', 'Выручка (сум)', 'Средний чек']
                ];
                salesAnalytics.forEach(row => {
                    analyticsData.push([
                        row.period ? new Date(row.period).toLocaleDateString('ru-RU') : '',
                        parseInt(row.sales_count || 0),
                        parseFloat(row.total_revenue || 0),
                        parseFloat(row.average_sale || 0)
                    ]);
                });
                const ws3 = XLSX.utils.aoa_to_sheet(analyticsData);
                ws3['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(wb, ws3, 'Продажи по дням');
            }

            const timestamp = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Отчет_${timestamp}.xlsx`);
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            toast.error('Ошибка экспорта отчета');
        }
    };

    const tabs = [
        { id: 'financial', label: t('reports.finance', 'Финансы'), icon: <TrendingUp size={16} /> },
        { id: 'sales', label: t('reports.salesByDay', 'Продажи по дням'), icon: <BarChart3 size={16} /> },
        { id: 'products', label: t('reports.topProducts', 'Топ товаров'), icon: <Package size={16} /> }
    ];

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="reports-page fade-in">
            <div className="page-header">
                <div>
                    <h1>📊 {t('reports.title')}</h1>
                    <p className="text-muted">{t('reports.subtitle', 'Аналитика и отчетность')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={loadReports}>
                        <RefreshCw size={16} /> {t('common.apply', 'Обновить')}
                    </button>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> Excel
                    </button>
                </div>
            </div>

            {/* Фильтры по датам */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Calendar size={18} color="#666" />
                        <span style={{ fontWeight: 500 }}>{t('reports.period', 'Период')}:</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {['today', 'week', 'month', 'quarter', 'year'].map(p => (
                            <button key={p} className="btn btn-sm btn-secondary" onClick={() => setQuickPeriod(p)}>
                                {p === 'today' ? t('dashboard.today') : p === 'week' ? t('dashboard.week') : p === 'month' ? t('dashboard.month') : p === 'quarter' ? t('reports.quarter', 'Квартал') : t('dashboard.year')}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '8px 12px' }} />
                        <span>—</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '8px 12px' }} />
                    </div>
                </div>
            </div>

            {/* Сводные карточки */}
            <div className="grid grid-3 mb-3">
                <div className="card">
                    <h3 className="text-muted mb-2">{t('reports.salesRevenue', 'Доходы от продаж')}</h3>
                    <div className="stat-value text-success">{formatCurrency(financial?.totalSales || 0)}</div>
                </div>
                <div className="card">
                    <h3 className="text-muted mb-2">{t('reports.purchaseExpenses', 'Расходы на закупки')}</h3>
                    <div className="stat-value text-danger">{formatCurrency(financial?.totalPurchases || 0)}</div>
                </div>
                <div className="card">
                    <h3 className="text-muted mb-2">{t('reports.profit', 'Прибыль')}</h3>
                    <div className="stat-value text-primary">{formatCurrency(financial?.profit || 0)}</div>
                    <p className="text-muted">{t('reports.margin', 'Маржа')}: {financial?.profitMargin || 0}%</p>
                </div>
            </div>

            {/* Вкладки */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid var(--border-color)', paddingBottom: '0' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 20px', border: 'none', cursor: 'pointer',
                            background: 'none', fontWeight: activeTab === tab.id ? 600 : 400,
                            color: activeTab === tab.id ? 'var(--primary-color)' : '#666',
                            borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                            marginBottom: '-2px', fontSize: '14px'
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Вкладка: Финансы */}
            {activeTab === 'financial' && (
                <div className="grid grid-2">
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><BarChart3 size={20} /> {t('reports.topByRevenue', 'Топ товаров по выручке')}</h2>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('reports.product', 'Товар')}</th>
                                    <th>{t('common.quantity')}</th>
                                    <th>{t('reports.revenue', 'Выручка')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.map((product, index) => (
                                    <tr key={product.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="badge badge-primary">#{index + 1}</span>
                                                <strong>{product.name}</strong>
                                            </div>
                                        </td>
                                        <td>{parseFloat(product.total_quantity).toFixed(0)} шт.</td>
                                        <td><strong>{formatCurrency(product.total_revenue)}</strong></td>
                                    </tr>
                                ))}
                                {topProducts.length === 0 && (
                                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888', padding: '20px' }}>{t('reports.net_dannyh_za_period', 'Нет данных за период')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title">{t('reports.revenueDistribution', 'Распределение выручки')}</h2>
                        </div>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={380}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={120} dataKey="value">
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>{t('common.noData')}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Вкладка: Продажи по дням */}
            {activeTab === 'sales' && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><TrendingUp size={20} /> {t('reports.salesDynamics', 'Динамика продаж')}</h2>
                    </div>
                    {lineData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={320}>
                                <AreaChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                                        fill="url(#colorRevenue)" name={t('reports.revenue', 'Выручка')} />
                                </AreaChart>
                            </ResponsiveContainer>

                            <div style={{ marginTop: '24px' }}>
                                <h3 style={{ marginBottom: '12px' }}>{t('reports.salesCountByDay', 'Количество продаж по дням')}</h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={lineData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#10b981" name={t('sales.title', 'Продаж')} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                            {t('common.noData')}
                        </div>
                    )}
                </div>
            )}

            {/* Вкладка: Топ товаров */}
            {activeTab === 'products' && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Package size={20} /> {t('reports.top5ByRevenue', 'Топ-5 товаров по выручке')}</h2>
                    </div>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis type="number" tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                                <Tooltip formatter={(value, name) => [
                                    name === 'revenue' ? formatCurrency(value) : value,
                                    name === 'revenue' ? t('reports.revenue', 'Выручка') : t('common.quantity')
                                ]} />
                                <Legend />
                                <Bar dataKey="revenue" fill="#3b82f6" name={t('reports.revenue', 'Выручка')} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                            {t('common.noData')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Reports;
