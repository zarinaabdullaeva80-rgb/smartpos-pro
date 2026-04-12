import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Check, Clock, X, Send, Download, Edit, Eye, DollarSign, User } from 'lucide-react';
import { salesAPI } from '../services/api';
import { useI18n } from '../i18n';

function Quotations() {
    const { t } = useI18n();
    const [quotations, setQuotations] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await salesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setQuotations(apiData.quotations || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('Quotations: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6', icon: FileText },
            sent: { label: 'Отправлен', color: '#3b82f6', bg: '#dbeafe', icon: Send },
            accepted: { label: 'Принят', color: '#10b981', bg: '#dcfce7', icon: Check },
            rejected: { label: 'Отклонён', color: '#ef4444', bg: '#fee2e2', icon: X },
            expired: { label: 'Истёк', color: '#f59e0b', bg: '#fef3c7', icon: Clock }
        };
        return statuses[status] || statuses.draft;
    };

    const [message, setMessage] = useState(null);
    const handleNewQuote = () => setMessage({ type: 'info', text: 'Создание новой котировки...' });
    const handleView = (q) => setMessage({ type: 'info', text: `Просмотр ${q.number}` });
    const handleEdit = (q) => setMessage({ type: 'info', text: `Редактирование ${q.number}` });
    const handleDownload = (q) => setMessage({ type: 'success', text: `Скачан PDF ${q.number}` });

    return (
        <div className="quotations-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('quotations.kotirovki', '📋 Котировки')}</h1>
                    <p className="text-muted">{t('quotations.kommercheskie_predlozheniya_dlya_klientov', 'Коммерческие предложения для клиентов')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewQuote}>
                    <Plus size={18} /> Новая котировка
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <FileText size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('quotations.vsego', 'Всего')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Send size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('quotations.v_ozhidanii', 'В ожидании')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.accepted}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('quotations.prinyato', 'Принято')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.conversion}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('quotations.konversiya', 'Конверсия')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(stats.total_value)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('quotations.obschaya_summa', 'Общая сумма')}</div>
                </div>
            </div>

            {/* Список */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('quotations.vse_kotirovki', '📑 Все котировки')}</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '250px' }} />
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('quotations.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('quotations.nomer', 'Номер')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('quotations.klient', 'Клиент')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('quotations.pozitsiy', 'Позиций')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('quotations.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('quotations.deystvuet_do', 'Действует до')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('quotations.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('quotations.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.map(quote => {
                                const statusInfo = getStatusInfo(quote.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={quote.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{quote.number}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{formatDate(quote.created_at)}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{quote.customer}</div>
                                            <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <User size={12} /> {quote.contact}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{quote.items_count}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(quote.total)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {formatDate(quote.valid_until)}
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
                                                <button className="btn btn-sm btn-secondary" title={t('quotations.prosmotr', 'Просмотр')} onClick={() => handleView(quote)}><Eye size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" title={t('quotations.redaktirovat', 'Редактировать')} onClick={() => handleEdit(quote)}><Edit size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" title={t('quotations.skachat', 'Скачать PDF')} onClick={() => handleDownload(quote)}><Download size={14} /></button>
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

export default Quotations;
