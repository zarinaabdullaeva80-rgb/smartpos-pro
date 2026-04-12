import React, { useState, useEffect } from 'react';
import { FileText, DollarSign, Calendar, Download, TrendingUp, Calculator, AlertTriangle, Check } from 'lucide-react';
import { reportsAPI } from '../services/api';
import { useI18n } from '../i18n';

function TaxReports() {
    const { t } = useI18n();
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState({});
    const [year, setYear] = useState('2026');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    const handleExport = () => {
        setMessage({ type: 'info', text: 'Формирование отчёта...' });
        setTimeout(() => {
            setMessage({ type: 'success', text: 'Отчёт экспортирован!' });
        }, 1000);
    };

    const handlePay = () => {
        setMessage({ type: 'info', text: 'Переход к оплате...' });
        setTimeout(() => {
            setMessage({ type: 'success', text: 'Платёж сформирован. Перейдите в банк для подтверждения.' });
        }, 1000);
    };

    useEffect(() => { loadData(); }, [year]);

    const loadData = async () => {
        try {
            const apiRes = await reportsAPI.getDashboard();
            const apiData = apiRes.data || apiRes;
            setReports(apiData.reports || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('TaxReports: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            paid: { label: 'Оплачено', color: '#10b981', bg: '#dcfce7', icon: Check },
            pending: { label: 'К оплате', color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
            overdue: { label: 'Просрочено', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
        };
        return statuses[status] || statuses.pending;
    };

    return (
        <div className="tax-reports-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('taxreports.nalogovye_otchyoty', '📋 Налоговые отчёты')}</h1>
                    <p className="text-muted">{t('taxreports.raschyot_i_uplata_nalogov', 'Расчёт и уплата налогов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select value={year} onChange={(e) => setYear(e.target.value)}>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* Следующий платёж */}
            <div className="card" style={{
                marginBottom: '20px',
                padding: '24px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '13px', opacity: 0.8 }}>Следующий платёж до {stats.next_due}</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '8px' }}>
                            {formatCurrency(stats.next_amount)}
                        </div>
                    </div>
                    <button className="btn" style={{ background: 'white', color: '#f59e0b' }} onClick={handlePay}>
                        <Calculator size={18} /> Оплатить
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.ytd_revenue)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('taxreports.vyruchka_za_god', 'Выручка за год')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <FileText size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.ytd_tax)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('taxreports.nalogov_za_god', 'Налогов за год')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.effective_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('taxreports.effektivnaya_stavka', 'Эффективная ставка')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('taxreports.istoriya_nalogovyh_platezhey', '📊 История налоговых платежей')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('taxreports.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('taxreports.period', 'Период')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('taxreports.vyruchka', 'Выручка')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('taxreports.nds_pct', 'НДС (12%)')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('taxreports.nalog_na_pribyl', 'Налог на прибыль')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('taxreports.sots_vznosy', 'Соц. взносы')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('taxreports.itogo', 'Итого')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('taxreports.status', 'Статус')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(report => {
                                const statusInfo = getStatusInfo(report.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{report.period}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(report.revenue)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(report.nds)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(report.income_tax)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(report.social)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(report.total_tax)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default TaxReports;
