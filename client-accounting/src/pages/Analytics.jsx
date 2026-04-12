import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, Calendar, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/Common.css';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

const Analytics = () => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('abc');
    const [abcData, setAbcData] = useState(null);
    const [plData, setPlData] = useState(null);
    const [balanceData, setBalanceData] = useState(null);
    const [categoryData, setCategoryData] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'abc') loadABCAnalysis();
        if (activeTab === 'pl') loadProfitLoss();
        if (activeTab === 'balance') loadBalanceSheet();
        if (activeTab === 'category') loadCategoryAnalysis();
    }, [activeTab, dateRange]);

    const loadABCAnalysis = async () => {
        setLoading(true);
        try {
            const response = await analyticsAPI.getABCAnalysis({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            setAbcData(response.data);
        } catch (error) {
            console.error('Error loading ABC analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProfitLoss = async () => {
        setLoading(true);
        try {
            const response = await analyticsAPI.getProfitLoss({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            setPlData(response.data);
        } catch (error) {
            console.error('Error loading P&L:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadBalanceSheet = async () => {
        setLoading(true);
        try {
            const response = await analyticsAPI.getBalanceSheet();
            setBalanceData(response.data);
        } catch (error) {
            console.error('Error loading balance sheet:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategoryAnalysis = async () => {
        setLoading(true);
        try {
            const response = await analyticsAPI.getCategoryAnalysis({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            setCategoryData(response.data);
        } catch (error) {
            console.error('Error loading category analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = { A: '#28a745', B: '#ffc107', C: '#dc3545' };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><BarChart3 size={32} /> {t('analytics.title', 'Аналитика и прогнозирование')}</h1>
                    <p>{t('analytics.subtitle', 'Глубокая аналитика продаж, товаров и финансов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        className="input"
                    />
                    <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        className="input"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'abc' ? 'active' : ''}`}
                    onClick={() => setActiveTab('abc')}
                >
                    <Package size={18} /> {t('analytics.abcAnalysis', 'ABC-анализ')}
                </button>
                <button
                    className={`tab ${activeTab === 'pl' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pl')}
                >
                    <DollarSign size={18} /> {t('analytics.profitLoss', 'ОПиУ (P&L)')}
                </button>
                <button
                    className={`tab ${activeTab === 'balance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('balance')}
                >
                    <TrendingUp size={18} /> {t('analytics.balance', 'Баланс')}
                </button>
                <button
                    className={`tab ${activeTab === 'category' ? 'active' : ''}`}
                    onClick={() => setActiveTab('category')}
                >
                    <BarChart3 size={18} /> {t('analytics.byCategory', 'По категориям')}
                </button>
            </div>

            {loading && <div className="loading">{t('common.loading')}</div>}

            {/* ABC Analysis */}
            {activeTab === 'abc' && abcData && !loading && (
                <div className="analytics-content">
                    {/* Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card card" style={{ borderLeft: '4px solid #28a745' }}>
                            <div className="stat-label">{t('analytics.kategoriya', 'Категория A (VIP)')}</div>
                            <div className="stat-value">{abcData.stats.A.count} товаров</div>
                            <div className="stat-meta">{abcData.stats.A.percent}% выручки • {abcData.stats.A.revenue.toLocaleString()} ₽</div>
                        </div>
                        <div className="stat-card card" style={{ borderLeft: '4px solid #ffc107' }}>
                            <div className="stat-label">{t('analytics.kategoriya_vazhnye', 'Категория B (Важные)')}</div>
                            <div className="stat-value">{abcData.stats.B.count} товаров</div>
                            <div className="stat-meta">{abcData.stats.B.percent}% выручки • {abcData.stats.B.revenue.toLocaleString()} ₽</div>
                        </div>
                        <div className="stat-card card" style={{ borderLeft: '4px solid #dc3545' }}>
                            <div className="stat-label">{t('analytics.kategoriya_prochie', 'Категория C (Прочие)')}</div>
                            <div className="stat-value">{abcData.stats.C.count} товаров</div>
                            <div className="stat-meta">{abcData.stats.C.percent}% выручки • {abcData.stats.C.revenue.toLocaleString()} ₽</div>
                        </div>
                        <div className="stat-card card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                            <div className="stat-label">{t('analytics.obschaya_vyruchka', 'Общая выручка')}</div>
                            <div className="stat-value">{parseFloat(abcData.totalRevenue).toLocaleString()} ₽</div>
                            <div className="stat-meta">{t('analytics.za_vybrannyy_period', 'За выбранный период')}</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="charts-grid">
                        <div className="card">
                            <h3>{t('analytics.raspredelenie_po_kategoriyam', 'Распределение по категориям')}</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'A', value: abcData.stats.A.count },
                                            { name: 'B', value: abcData.stats.B.count },
                                            { name: 'C', value: abcData.stats.C.count }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {['A', 'B', 'C'].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[entry]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card">
                            <h3>{t('analytics.vyruchka_po_kategoriyam', 'Выручка по категориям')}</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[
                                    { name: 'A', revenue: abcData.stats.A.revenue },
                                    { name: 'B', revenue: abcData.stats.B.revenue },
                                    { name: 'C', revenue: abcData.stats.C.revenue }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="revenue" fill="var(--primary-color)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Products Table */}
                    <div className="card">
                        <h3>{t('analytics.top_tovarov', 'Топ-20 товаров')}</h3>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{t('analytics.tovar', 'Товар')}</th>
                                    <th>{t('analytics.kategoriya', 'Категория ABC')}</th>
                                    <th>{t('analytics.vyruchka', 'Выручка')}</th>
                                    <th>{t('analytics.prodano', 'Продано')}</th>
                                    <th>{t('analytics.pct_ot_obschey_vyruchki', '% от общей выручки')}</th>
                                    <th>{t('analytics.nakoplennyy_pct', 'Накопленный %')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {abcData.products.slice(0, 20).map((product, idx) => (
                                    <tr key={product.id}>
                                        <td>{idx + 1}</td>
                                        <td>{product.name}</td>
                                        <td>
                                            <span className={`badge badge-${product.category.toLowerCase()}`}>
                                                {product.category}
                                            </span>
                                        </td>
                                        <td>{parseFloat(product.revenue).toLocaleString()} ₽</td>
                                        <td>{product.quantity_sold}</td>
                                        <td>{product.revenue_percent}%</td>
                                        <td>{product.cumulative_percent}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* P&L Report */}
            {activeTab === 'pl' && plData && !loading && (
                <div className="analytics-content">
                    <div className="card pl-report">
                        <h2>{t('analytics.otchyot_o_pribylyah_i_ubytkah_opiu', 'Отчёт о прибылях и убытках (ОПиУ)')}</h2>
                        <p className="period">Период: {plData.period.startDate} - {plData.period.endDate}</p>

                        <div className="pl-section">
                            <h3>{t('analytics.dohody', 'Доходы')}</h3>
                            <div className="pl-line">
                                <span>{t('analytics.vyruchka_ot_prodazh', 'Выручка от продаж')}</span>
                                <span className="amount">{parseFloat(plData.revenue).toLocaleString()} ₽</span>
                            </div>
                            <div className="pl-line">
                                <span>{t('analytics.vozvraty', 'Возвраты')}</span>
                                <span className="amount negative">-{parseFloat(plData.returns).toLocaleString()} ₽</span>
                            </div>
                            <div className="pl-line total">
                                <span>{t('analytics.chistaya_vyruchka', 'Чистая выручка')}</span>
                                <span className="amount">{parseFloat(plData.netRevenue).toLocaleString()} ₽</span>
                            </div>
                        </div>

                        <div className="pl-section">
                            <h3>{t('analytics.rashody', 'Расходы')}</h3>
                            <div className="pl-line">
                                <span>{t('analytics.sebestoimost_tovarov', 'Себестоимость товаров')}</span>
                                <span className="amount negative">-{parseFloat(plData.costOfGoods).toLocaleString()} ₽</span>
                            </div>
                            <div className="pl-line total">
                                <span>{t('analytics.valovaya_pribyl', 'Валовая прибыль')}</span>
                                <span className="amount">{parseFloat(plData.grossProfit).toLocaleString()} ₽</span>
                            </div>
                            <div className="pl-line meta">
                                <span>{t('analytics.valovaya_marzha', 'Валовая маржа')}</span>
                                <span>{plData.grossMargin}%</span>
                            </div>
                        </div>

                        <div className="pl-section">
                            <h3>{t('analytics.operatsionnye_rashody', 'Операционные расходы')}</h3>
                            <div className="pl-line">
                                <span>{t('analytics.prochie_rashody', 'Прочие расходы')}</span>
                                <span className="amount negative">-{parseFloat(plData.operatingExpenses).toLocaleString()} ₽</span>
                            </div>
                        </div>

                        <div className="pl-section final">
                            <div className="pl-line total highlight">
                                <span><strong>{t('analytics.chistaya_pribyl', 'Чистая прибыль')}</strong></span>
                                <span className={`amount ${parseFloat(plData.netProfit) >= 0 ? 'positive' : 'negative'}`}>
                                    <strong>{parseFloat(plData.netProfit).toLocaleString()} ₽</strong>
                                </span>
                            </div>
                            <div className="pl-line meta">
                                <span>{t('analytics.chistaya_marzha', 'Чистая маржа')}</span>
                                <span>{plData.netMargin}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Sheet */}
            {activeTab === 'balance' && balanceData && !loading && (
                <div className="analytics-content">
                    <div className="balance-grid">
                        <div className="card">
                            <h2>{t('analytics.aktivy', 'Активы')}</h2>
                            <div className="balance-section">
                                <h3>{t('analytics.tekuschie_aktivy', 'Текущие активы')}</h3>
                                <div className="balance-line">
                                    <span>{t('analytics.denezhnye_sredstva', 'Денежные средства')}</span>
                                    <span>{parseFloat(balanceData.assets.current.cash).toLocaleString()} ₽</span>
                                </div>
                                <div className="balance-line">
                                    <span>{t('analytics.tovarnye_zapasy', 'Товарные запасы')}</span>
                                    <span>{parseFloat(balanceData.assets.current.inventory).toLocaleString()} ₽</span>
                                </div>
                                <div className="balance-line">
                                    <span>{t('analytics.debitorskaya_zadolzhennost', 'Дебиторская задолженность')}</span>
                                    <span>{parseFloat(balanceData.assets.current.receivables).toLocaleString()} ₽</span>
                                </div>
                                <div className="balance-line total">
                                    <span><strong>{t('analytics.itogo_tekuschie_aktivy', 'Итого текущие активы')}</strong></span>
                                    <span><strong>{parseFloat(balanceData.assets.current.total).toLocaleString()} ₽</strong></span>
                                </div>
                            </div>
                            <div className="balance-total">
                                <span><strong>{t('analytics.vsego_aktivy', 'ВСЕГО АКТИВЫ')}</strong></span>
                                <span className="amount"><strong>{parseFloat(balanceData.assets.total).toLocaleString()} ₽</strong></span>
                            </div>
                        </div>

                        <div className="card">
                            <h2>{t('analytics.passivy_i_kapital', 'Пассивы и капитал')}</h2>
                            <div className="balance-section">
                                <h3>{t('analytics.obyazatelstva', 'Обязательства')}</h3>
                                <div className="balance-line">
                                    <span>{t('analytics.kreditorskaya_zadolzhennost', 'Кредиторская задолженность')}</span>
                                    <span>{parseFloat(balanceData.liabilities.current.payables).toLocaleString()} ₽</span>
                                </div>
                                <div className="balance-line total">
                                    <span><strong>{t('analytics.itogo_obyazatelstva', 'Итого обязательства')}</strong></span>
                                    <span><strong>{parseFloat(balanceData.liabilities.total).toLocaleString()} ₽</strong></span>
                                </div>
                            </div>
                            <div className="balance-section">
                                <h3>{t('analytics.kapital', 'Капитал')}</h3>
                                <div className="balance-line">
                                    <span>{t('analytics.neraspredelyonnaya_pribyl', 'Нераспределённая прибыль')}</span>
                                    <span>{parseFloat(balanceData.equity.retainedEarnings).toLocaleString()} ₽</span>
                                </div>
                                <div className="balance-line total">
                                    <span><strong>{t('analytics.itogo_kapital', 'Итого капитал')}</strong></span>
                                    <span><strong>{parseFloat(balanceData.equity.total).toLocaleString()} ₽</strong></span>
                                </div>
                            </div>
                            <div className="balance-total">
                                <span><strong>{t('analytics.vsego_passivy', 'ВСЕГО ПАССИВЫ')}</strong></span>
                                <span className="amount"><strong>{parseFloat(balanceData.totalLiabilitiesAndEquity).toLocaleString()} ₽</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Analysis */}
            {activeTab === 'category' && categoryData && !loading && (
                <div className="analytics-content">
                    <div className="card">
                        <h3>{t('analytics.analiz_po_kategoriyam_tovarov', 'Анализ по категориям товаров')}</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={categoryData.categories}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category_name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="total_revenue" fill="var(--primary-color)" name="Выручка" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('analytics.kategoriya', 'Категория')}</th>
                                    <th>{t('analytics.tovarov', 'Товаров')}</th>
                                    <th>{t('analytics.kolichestvo_prodano', 'Количество продано')}</th>
                                    <th>{t('analytics.vyruchka', 'Выручка')}</th>
                                    <th>{t('analytics.srednyaya_tsena', 'Средняя цена')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoryData.categories.map((cat, idx) => (
                                    <tr key={idx}>
                                        <td>{cat.category_name}</td>
                                        <td>{cat.products_count}</td>
                                        <td>{cat.total_quantity}</td>
                                        <td>{parseFloat(cat.total_revenue).toLocaleString()} ₽</td>
                                        <td>{parseFloat(cat.avg_price).toFixed(2)} ₽</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style jsx>{`
    .tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 2px solid var(--border-color);
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        background: rgba(255, 255, 255, 0.05);
    }

    .tab.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }

    .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
    }

    .pl-report {
        max-width: 800px;
        margin: 0 auto;
        padding: 30px;
    }

    .pl-section {
        margin: 20px 0;
        padding: 15px 0;
        border-bottom: 1px solid var(--border-color);
    }

    .pl-section.final {
        border-bottom: none;
        background: rgba(68, 114, 196, 0.1);
        padding: 20px;
        border-radius: 8px;
    }

    .pl-line {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
    }

    .pl-line.total {
        font-weight: 600;
        padding-top: 12px;
        margin-top: 8px;
        border-top: 1px solid var(--border-color);
    }

    .pl-line.meta {
        font-size: 14px;
        opacity: 0.7;
    }

    .negative {
        color: #dc3545;
    }

    .positive {
        color: #28a745;
    }

    .balance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 20px;
    }

    .balance-section {
        margin: 15px 0;
        padding: 15px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
    }

    .balance-line {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
    }

    .balance-total {
        display: flex;
        justify-content: space-between;
        padding: 20px;
        margin-top: 15px;
        background: var(--primary-color);
        border-radius: 8px;
        font-size: 18px;
    }

    .badge-a { background: #28a745; color: white; }
    .badge-b { background: #ffc107; color: #000; }
    .badge-c { background: #dc3545; color: white; }
`}</style>
        </div>
    );
};

export default Analytics;
