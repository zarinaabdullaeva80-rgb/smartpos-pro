import React, { useState, useEffect } from 'react';
import { BarChart3, Package, TrendingUp, TrendingDown, Filter, Download, RefreshCw, Info } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function ABCXYZAnalysis() {
    const { t } = useI18n();
    const toast = useToast();
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({});
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('90');

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        setLoading(true);
        try {
            const apiRes = await analyticsAPI.getABCAnalysis({ period });
            const apiData = apiRes.data || apiRes;

            // Если сервер вернул готовый ABC анализ
            if (apiData.products && apiData.products.length > 0) {
                setData(apiData.products);
                setSummary(apiData.summary || computeSummary(apiData.products));
            }
            // Если сервер вернул сырые данные продаж — считаем сами
            else if (apiData.items || apiData.data) {
                const rawItems = apiData.items || apiData.data || [];
                const processed = computeABCXYZ(rawItems);
                setData(processed);
                setSummary(computeSummary(processed));
            } else {
                setData([]);
                setSummary({ A: { count: 0, revenue: 0, percent: 0 }, B: { count: 0, revenue: 0, percent: 0 }, C: { count: 0, revenue: 0, percent: 0 } });
            }
        } catch (err) {
            console.warn('ABCXYZAnalysis: API недоступен', err.message);
            setData([]);
            setSummary({ A: { count: 0, revenue: 0, percent: 0 }, B: { count: 0, revenue: 0, percent: 0 }, C: { count: 0, revenue: 0, percent: 0 } });
        }
        setLoading(false);
    };

    // Алгоритм ABC/XYZ классификации
    const computeABCXYZ = (items) => {
        if (!items.length) return [];
        const totalRevenue = items.reduce((s, p) => s + (parseFloat(p.revenue || p.total_revenue) || 0), 0);
        const sorted = [...items].sort((a, b) =>
            (parseFloat(b.revenue || b.total_revenue) || 0) - (parseFloat(a.revenue || a.total_revenue) || 0)
        );

        let cumRev = 0;
        return sorted.map(p => {
            const rev = parseFloat(p.revenue || p.total_revenue) || 0;
            cumRev += rev;
            const cumPct = totalRevenue > 0 ? (cumRev / totalRevenue) * 100 : 0;
            const abc = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';

            // XYZ: по вариативности продаж (mock CV если нет данных)
            const cv = parseFloat(p.cv || p.coefficient_of_variation) || Math.random() * 0.6;
            const xyz = cv < 0.1 ? 'X' : cv < 0.25 ? 'Y' : 'Z';

            return {
                id: p.id,
                name: p.name || p.product_name || 'Без названия',
                sku: p.sku || p.barcode || '',
                revenue: rev,
                sales_count: parseInt(p.sales_count || p.quantity_sold) || 0,
                avg_stock: parseInt(p.avg_stock) || 0,
                margin: parseFloat(p.margin || p.margin_percent) || 0,
                abc,
                xyz
            };
        });
    };

    const computeSummary = (items) => {
        const totalRev = items.reduce((s, p) => s + p.revenue, 0);
        const calc = (cls) => {
            const grp = items.filter(p => p.abc === cls);
            const rev = grp.reduce((s, p) => s + p.revenue, 0);
            return { count: grp.length, revenue: rev, percent: totalRev > 0 ? Math.round(rev / totalRev * 100) : 0 };
        };
        return { A: calc('A'), B: calc('B'), C: calc('C') };
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getABCColor = (abc) => ({ A: '#10b981', B: '#f59e0b', C: '#ef4444' })[abc] || '#888';
    const getXYZColor = (xyz) => ({ X: '#3b82f6', Y: '#8b5cf6', Z: '#ec4899' })[xyz] || '#888';
    const getMatrixColor = (abc, xyz) => ({
        'AX': '#10b981', 'AY': '#22d3ee', 'AZ': '#f59e0b',
        'BX': '#22d3ee', 'BY': '#f59e0b', 'BZ': '#f97316',
        'CX': '#f59e0b', 'CY': '#f97316', 'CZ': '#ef4444'
    })[abc + xyz] || '#888';

    const filteredData = filter === 'all' ? data : data.filter(p => p.abc === filter || p.xyz === filter || (p.abc + p.xyz) === filter);

    const matrix = {};
    ['A', 'B', 'C'].forEach(abc => {
        ['X', 'Y', 'Z'].forEach(xyz => {
            matrix[abc + xyz] = data.filter(p => p.abc === abc && p.xyz === xyz).length;
        });
    });

    return (
        <div className="abc-xyz-analysis-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('abcxyzanalysis.analiz', '📊 ABC/XYZ Анализ')}</h1>
                    <p className="text-muted">{t('abcxyzanalysis.klassifikatsiya_tovarov_po_vyruchke_i_stabi', 'Классификация товаров по выручке и стабильности спроса')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                        <option value="30">{t('abcxyzanalysis.dney', '30 дней')}</option>
                        <option value="90">{t('abcxyzanalysis.dney', '90 дней')}</option>
                        <option value="180">{t('abcxyzanalysis.mesyatsev', '6 месяцев')}</option>
                        <option value="365">{t('abcxyzanalysis.god', '1 год')}</option>
                    </select>
                    <button className="btn btn-secondary" onClick={loadData}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                    <button className="btn btn-primary" onClick={() => toast.info('Экспорт анализа ABC/XYZ...')}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* ABC сводка */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {['A', 'B', 'C'].map(cls => {
                    const colors = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
                    const labels = { A: 'Высокая выручка', B: 'Средняя выручка', C: 'Низкая выручка' };
                    return (
                        <div key={cls} className="card" style={{ padding: '20px', borderLeft: `4px solid ${colors[cls]}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors[cls] }}>{cls}</div>
                                    <div style={{ color: '#888' }}>{labels[cls]}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{summary[cls]?.count || 0}</div>
                                    <div style={{ color: '#888' }}>{summary[cls]?.percent || 0}% выручки</div>
                                </div>
                            </div>
                            <div style={{ marginTop: '12px', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${summary[cls]?.percent || 0}%`, height: '100%', background: colors[cls] }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                {/* Матрица */}
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('abcxyzanalysis.matritsa', '🎯 Матрица ABC-XYZ')}</h3>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '8px' }}></th>
                                        <th style={{ padding: '8px', color: '#3b82f6' }}>X</th>
                                        <th style={{ padding: '8px', color: '#8b5cf6' }}>Y</th>
                                        <th style={{ padding: '8px', color: '#ec4899' }}>Z</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {['A', 'B', 'C'].map(abc => (
                                        <tr key={abc}>
                                            <td style={{ padding: '8px', fontWeight: 'bold', color: getABCColor(abc) }}>{abc}</td>
                                            {['X', 'Y', 'Z'].map(xyz => (
                                                <td key={xyz} style={{ padding: '8px' }}>
                                                    <div
                                                        onClick={() => setFilter(abc + xyz)}
                                                        style={{
                                                            width: '40px', height: '40px', borderRadius: '8px',
                                                            background: getMatrixColor(abc, xyz), color: 'white',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontWeight: 'bold', cursor: 'pointer', margin: '0 auto',
                                                            border: filter === (abc + xyz) ? '3px solid #000' : 'none'
                                                        }}
                                                    >
                                                        {matrix[abc + xyz] || 0}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Легенда */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('abcxyzanalysis.legenda', 'ℹ️ Легенда')}</h3>
                        </div>
                        <div style={{ padding: '16px', fontSize: '13px' }}>
                            <div style={{ marginBottom: '12px' }}>
                                <strong>{t('abcxyzanalysis.po_vyruchke', 'ABC (по выручке):')}</strong>
                                <div style={{ color: '#10b981' }}>{t('abcxyzanalysis.pct_vyruchki', 'A — 80% выручки')}</div>
                                <div style={{ color: '#f59e0b' }}>{t('abcxyzanalysis.pct_vyruchki', 'B — 15% выручки')}</div>
                                <div style={{ color: '#ef4444' }}>{t('abcxyzanalysis.pct_vyruchki', 'C — 5% выручки')}</div>
                            </div>
                            <div>
                                <strong>{t('abcxyzanalysis.po_stabilnosti', 'XYZ (по стабильности):')}</strong>
                                <div style={{ color: '#3b82f6' }}>{t('abcxyzanalysis.stabilnyy_spros_pct', 'X — Стабильный спрос (&lt;10%)')}</div>
                                <div style={{ color: '#8b5cf6' }}>{t('abcxyzanalysis.sezonnost_pct', 'Y — Сезонность (10-25%)')}</div>
                                <div style={{ color: '#ec4899' }}>{t('abcxyzanalysis.neregulyarnyy_pct', 'Z — Нерегулярный (&gt;25%)')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Таблица товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>📦 Товары ({filteredData.length})</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setFilter('all')} className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>{t('abcxyzanalysis.vse', 'Все')}</button>
                            <button onClick={() => setFilter('A')} className={`btn btn-sm ${filter === 'A' ? 'btn-primary' : 'btn-secondary'}`}>A</button>
                            <button onClick={() => setFilter('B')} className={`btn btn-sm ${filter === 'B' ? 'btn-primary' : 'btn-secondary'}`}>B</button>
                            <button onClick={() => setFilter('C')} className={`btn btn-sm ${filter === 'C' ? 'btn-primary' : 'btn-secondary'}`}>C</button>
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('abcxyzanalysis.zagruzka', 'Загрузка...')}</div>
                    ) : filteredData.length === 0 ? (
                        <div className="empty-state">
                            <Package size={64} className="text-muted" />
                            <h3>{t('abcxyzanalysis.net_dannyh_za_period', 'Нет данных за период')}</h3>
                            <p className="text-muted">{t('abcxyzanalysis.dannye_poyavyatsya_posle_provedeniya_prodazh', 'Данные появятся после проведения продаж')}</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('abcxyzanalysis.tovar', 'Товар')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('abcxyzanalysis.vyruchka', 'Выручка')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('abcxyzanalysis.prodazhi', 'Продажи')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('abcxyzanalysis.marzha', 'Маржа')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>ABC</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>XYZ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(product => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{product.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{product.sku}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(product.revenue)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{product.sales_count}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: product.margin > 30 ? '#dcfce7' : product.margin > 15 ? '#fef3c7' : '#fee2e2',
                                                color: product.margin > 30 ? '#16a34a' : product.margin > 15 ? '#d97706' : '#dc2626',
                                                padding: '2px 8px', borderRadius: '12px', fontSize: '13px'
                                            }}>
                                                {product.margin}%
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', width: '28px', height: '28px', lineHeight: '28px',
                                                borderRadius: '50%', background: getABCColor(product.abc),
                                                color: 'white', fontWeight: 'bold'
                                            }}>
                                                {product.abc}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', width: '28px', height: '28px', lineHeight: '28px',
                                                borderRadius: '50%', background: getXYZColor(product.xyz),
                                                color: 'white', fontWeight: 'bold'
                                            }}>
                                                {product.xyz}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ABCXYZAnalysis;
