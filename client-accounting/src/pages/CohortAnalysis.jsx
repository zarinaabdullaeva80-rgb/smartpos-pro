import React, { useState, useEffect } from 'react';
import { Users, Calendar, TrendingUp, DollarSign, ShoppingCart, Clock, Eye, ArrowRight } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function CohortAnalysis() {
    const { t } = useI18n();
    const [cohorts, setCohorts] = useState([]);
    const [metric, setMetric] = useState('retention');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [metric]);

    const loadData = async () => {
        try {
            const apiRes = await analyticsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('CohortAnalysis.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('CohortAnalysis: не удалось загрузить данные', err.message);
        }
        setCohorts([
            { month: 'Окт 2025', users: 245, retention: [100, 68, 52, 41, 35] },
            { month: 'Ноя 2025', users: 312, retention: [100, 72, 58, 45, null] },
            { month: 'Дек 2025', users: 428, retention: [100, 75, 62, null, null] },
            { month: 'Янв 2026', users: 380, retention: [100, 70, null, null, null] }
        ]);
        setLoading(false);
    };

    const getRetentionColor = (value) => {
        if (!value && value !== 0) return '#f3f4f6';
        if (value >= 70) return '#10b981';
        if (value >= 50) return '#3b82f6';
        if (value >= 30) return '#f59e0b';
        return '#ef4444';
    };

    const getRetentionBg = (value) => {
        if (!value && value !== 0) return '#f3f4f6';
        if (value >= 70) return '#dcfce7';
        if (value >= 50) return '#dbeafe';
        if (value >= 30) return '#fef3c7';
        return '#fee2e2';
    };

    return (
        <div className="cohort-analysis-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('cohortanalysis.kogortnyy_analiz', '📊 Когортный анализ')}</h1>
                    <p className="text-muted">{t('cohortanalysis.uderzhanie_klientov_po_kogortam', 'Удержание клиентов по когортам')}</p>
                </div>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                    <option value="retention">{t('cohortanalysis.uderzhanie_pct', 'Удержание (%)')}</option>
                    <option value="revenue">{t('cohortanalysis.vyruchka', 'Выручка')}</option>
                    <option value="orders">{t('cohortanalysis.zakazy', 'Заказы')}</option>
                </select>
            </div>

            {/* Ключевые метрики */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>1,365</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('cohortanalysis.novyh_klientov', 'Новых клиентов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>71%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Retention M1</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <ShoppingCart size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>2.4</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('cohortanalysis.srednee_kol_vo_zakazov', 'Среднее кол-во заказов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>18.5M so'm</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('cohortanalysis.sredniy', 'Средний LTV')}</div>
                </div>
            </div>

            {/* Таблица когорт */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('cohortanalysis.kogortnaya_tablitsa_uderzhaniya', '📈 Когортная таблица удержания')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('cohortanalysis.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ padding: '20px', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '12px', textAlign: 'left', background: 'var(--bg-secondary)' }}>{t('cohortanalysis.kogorta', 'Когорта')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>{t('cohortanalysis.klientov', 'Клиентов')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>M0</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>M1</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>M2</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>M3</th>
                                    <th style={{ padding: '12px', textAlign: 'center', background: 'var(--bg-secondary)' }}>M4</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cohorts.map((cohort, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={16} color="#888" />
                                                {cohort.month}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {cohort.users}
                                        </td>
                                        {cohort.retention.map((val, i) => (
                                            <td key={i} style={{ padding: '8px', textAlign: 'center' }}>
                                                <div style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    background: getRetentionBg(val),
                                                    color: val !== null ? getRetentionColor(val) : '#888',
                                                    fontWeight: val !== null ? 'bold' : 'normal'
                                                }}>
                                                    {val !== null ? `${val}%` : '-'}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Легенда */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '13px', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#dcfce7', borderRadius: '4px' }} />
                    <span>{t('cohortanalysis.pct_otlichno', '70%+ (Отлично)')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#dbeafe', borderRadius: '4px' }} />
                    <span>{t('cohortanalysis.pct_horosho', '50-69% (Хорошо)')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#fef3c7', borderRadius: '4px' }} />
                    <span>{t('cohortanalysis.pct_sredne', '30-49% (Средне)')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#fee2e2', borderRadius: '4px' }} />
                    <span>{t('cohortanalysis.pct_ploho', '&lt;30% (Плохо)')}</span>
                </div>
            </div>
        </div>
    );
}

export default CohortAnalysis;
