import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Printer, RefreshCw, Check, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { reportsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function FiscalReports() {
    const { t } = useI18n();
    const toast = useToast();
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState({});
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await reportsAPI.getDashboard();
            const apiData = apiRes.data || apiRes;
            setReports(apiData.reports || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('FiscalReports: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => new Date(date).toLocaleDateString('ru-RU');

    const getReportTypeInfo = (type) => {
        const types = {
            z_report: { label: 'Z-отчёт', color: '#10b981', icon: '📊' },
            x_report: { label: 'X-отчёт', color: '#3b82f6', icon: '📈' },
            monthly: { label: 'Месячный', color: '#8b5cf6', icon: '📅' },
            vat: { label: 'НДС', color: '#f59e0b', icon: '💰' }
        };
        return types[type] || types.z_report;
    };

    const getStatusInfo = (status) => {
        const statuses = {
            generated: { label: 'Сформирован', color: '#3b82f6', bg: '#dbeafe', icon: Check },
            pending: { label: 'Ожидает отправки', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            sent: { label: 'Отправлен в ГНИ', color: '#10b981', bg: '#dcfce7', icon: Check },
            error: { label: 'Ошибка', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
        };
        return statuses[status] || statuses.generated;
    };

    return (
        <div className="fiscal-reports-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('fiscalreports.fiskalnye_otchyoty', '🧾 Фискальные отчёты')}</h1>
                    <p className="text-muted">{t('fiscalreports.otchyoty_otchyoty_nds_otchyotnost', 'Z-отчёты, X-отчёты, НДС отчётность')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => toast.success('Обновление отчётов...')}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                    <button className="btn btn-primary" onClick={() => toast.info('Формирование Z-отчёта...')}>
                        <FileText size={18} /> Сформировать Z-отчёт
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('fiscalreports.oborot_za_mesyats', 'Оборот за месяц')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(stats.total_sales)}</div>
                        </div>
                        <DollarSign size={28} color="#10b981" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('fiscalreports.nds_k_uplate', 'НДС к уплате')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(stats.total_vat)}</div>
                        </div>
                        <FileText size={28} color="#f59e0b" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('fiscalreports.ozhidayut_otpravki', 'Ожидают отправки')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending_reports}</div>
                        </div>
                        <Clock size={28} color="#f59e0b" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('fiscalreports.otpravleno_v_gni', 'Отправлено в ГНИ')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.sent_reports}</div>
                        </div>
                        <Check size={28} color="#10b981" />
                    </div>
                </div>
            </div>

            {/* Быстрые отчёты */}
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px' }}>{t('fiscalreports.bystrye_otchyoty', '⚡ Быстрые отчёты')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <button className="btn btn-secondary" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📊</span>
                        <span>X-отчёт</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>{t('fiscalreports.promezhutochnyy', 'Промежуточный')}</span>
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📈</span>
                        <span>Z-отчёт</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>{t('fiscalreports.zakrytie_smeny', 'Закрытие смены')}</span>
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>📅</span>
                        <span>Месячный</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>{t('fiscalreports.za_tekuschiy_mesyats', 'За текущий месяц')}</span>
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>💰</span>
                        <span>{t('fiscalreports.nds_otchyot', 'НДС отчёт')}</span>
                        <span style={{ fontSize: '11px', color: '#888' }}>{t('fiscalreports.kvartalnyy', 'Квартальный')}</span>
                    </button>
                </div>
            </div>

            {/* Список отчётов */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('fiscalreports.istoriya_otchyotov', '📑 История отчётов')}</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                            <option value="week">{t('fiscalreports.za_nedelyu', 'За неделю')}</option>
                            <option value="month">{t('fiscalreports.za_mesyats', 'За месяц')}</option>
                            <option value="quarter">{t('fiscalreports.za_kvartal', 'За квартал')}</option>
                            <option value="year">{t('fiscalreports.za_god', 'За год')}</option>
                        </select>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('fiscalreports.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('fiscalreports.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('fiscalreports.nazvanie', 'Название')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('fiscalreports.data', 'Дата')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('fiscalreports.prodazh', 'Продаж')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('fiscalreports.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('fiscalreports.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('fiscalreports.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(report => {
                                const typeInfo = getReportTypeInfo(report.type);
                                const statusInfo = getStatusInfo(report.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ fontSize: '20px', marginRight: '8px' }}>{typeInfo.icon}</span>
                                            <span style={{ fontWeight: 500, color: typeInfo.color }}>{typeInfo.label}</span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{report.name}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="#888" />
                                                {formatDate(report.date)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {report.sales !== null ? report.sales : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(report.amount)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('fiscalreports.skachat', 'Скачать')}>
                                                    <Download size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('fiscalreports.pechat', 'Печать')}>
                                                    <Printer size={14} />
                                                </button>
                                            </div>
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

export default FiscalReports;
