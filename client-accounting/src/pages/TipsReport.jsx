import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Calendar, BarChart3 } from 'lucide-react';
import { reportsAPI } from '../services/api';
import { useI18n } from '../i18n';

function TipsReport() {
    const { t } = useI18n();
    const [period, setPeriod] = useState('today');
    const [stats, setStats] = useState({});
    const [tips, setTips] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await reportsAPI.getDashboard();
            const apiData = apiRes.data || apiRes;
            setStats(apiData.stats || {});
            setEmployees(apiData.employees || []);
            setTips(apiData.tips || []);
        } catch (err) {
            console.warn('TipsReport: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    return (
        <div className="tips-report-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('tipsreport.chaevye', '💵 Чаевые')}</h1>
                    <p className="text-muted">{t('tipsreport.otchyot_po_chaevym_sotrudnikov', 'Отчёт по чаевым сотрудников')}</p>
                </div>
                <div>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: '180px' }}>
                        <option value="today">{t('tipsreport.segodnya', 'Сегодня')}</option>
                        <option value="week">{t('tipsreport.eta_nedelya', 'Эта неделя')}</option>
                        <option value="month">{t('tipsreport.etot_mesyats', 'Этот месяц')}</option>
                        <option value="year">{t('tipsreport.etot_god', 'Этот год')}</option>
                    </select>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(stats.total)}</div>
                    <div style={{ color: '#666' }}>{t('tipsreport.vsego_chaevyh', 'Всего чаевых')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(stats.average)}</div>
                    <div style={{ color: '#666' }}>{t('tipsreport.srednie_chaevye', 'Средние чаевые')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <BarChart3 size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.transactions}</div>
                    <div style={{ color: '#666' }}>{t('tipsreport.tranzaktsiy', 'Транзакций')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.top_employee}</div>
                    <div style={{ color: '#666' }}>{t('tipsreport.lider', 'Лидер')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px' }}>
                {/* Рейтинг сотрудников */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('tipsreport.reyting_sotrudnikov', '🏆 Рейтинг сотрудников')}</h3>
                    </div>
                    <div>
                        {employees.map((emp, idx) => (
                            <div key={emp.id} style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                background: idx === 0 ? '#fef3c720' : 'transparent'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px',
                                    borderRadius: '50%',
                                    background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#e5e7eb',
                                    color: idx < 3 ? 'white' : '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    {idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{emp.name}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {emp.orders} заказов • ср. {formatCurrency(emp.avg_tip)}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 'bold', color: '#10b981' }}>
                                    {formatCurrency(emp.tips)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* История чаевых */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('tipsreport.poslednie_chaevye', '📋 Последние чаевые')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('tipsreport.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('tipsreport.data', 'Дата')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('tipsreport.zakaz', 'Заказ')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('tipsreport.sotrudnik', 'Сотрудник')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('tipsreport.oplata', 'Оплата')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('tipsreport.summa', 'Сумма')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tips.map(tip => (
                                    <tr key={tip.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontSize: '13px' }}>{formatDate(tip.date)}</td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{tip.order_id}</td>
                                        <td style={{ padding: '12px' }}>{tip.employee}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                background: tip.payment === 'Карта' ? '#dbeafe' : '#dcfce7',
                                                color: tip.payment === 'Карта' ? '#1d4ed8' : '#16a34a',
                                                fontSize: '12px'
                                            }}>
                                                {tip.payment}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                                            +{formatCurrency(tip.amount)}
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

export default TipsReport;
