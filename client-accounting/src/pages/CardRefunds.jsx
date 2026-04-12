import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowLeft, Search, CheckCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { returnsAPI } from '../services/api';
import { useI18n } from '../i18n';

function CardRefunds() {
    const { t } = useI18n();
    const [refunds, setRefunds] = useState([]);
    const [stats, setStats] = useState({});
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await returnsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setRefunds(apiData.refunds || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('CardRefunds: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const getStatusBadge = (status) => {
        const styles = {
            completed: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle, text: 'Успешно' },
            pending: { bg: '#fef3c7', color: '#d97706', icon: Clock, text: 'В обработке' },
            failed: { bg: '#fee2e2', color: '#dc2626', icon: AlertCircle, text: 'Ошибка' }
        };
        const s = styles[status] || styles.pending;
        const Icon = s.icon;
        return (
            <span style={{
                background: s.bg,
                color: s.color,
                padding: '6px 12px',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <Icon size={14} /> {s.text}
            </span>
        );
    };

    const filteredRefunds = filter === 'all'
        ? refunds
        : refunds.filter(r => r.status === filter);

    return (
        <div className="card-refunds-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('cardrefunds.vozvrat_na_kartu', '💳 Возврат на карту')}</h1>
                    <p className="text-muted">{t('cardrefunds.vozvrat_sredstv_na_bankovskuyu_kartu_klie', 'Возврат средств на банковскую карту клиента')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <ArrowLeft size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_today}</div>
                    <div style={{ color: '#666' }}>{t('cardrefunds.vozvratov_segodnya', 'Возвратов сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <CreditCard size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(stats.total_amount)}</div>
                    <div style={{ color: '#666' }}>{t('cardrefunds.summa_vozvratov', 'Сумма возвратов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.pending}</div>
                    <div style={{ color: '#666' }}>{t('cardrefunds.v_ozhidanii', 'В ожидании')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <CheckCircle size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_time}</div>
                    <div style={{ color: '#666' }}>{t('cardrefunds.srednee_vremya', 'Среднее время')}</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'all', label: 'Все' },
                        { key: 'completed', label: '✅ Успешные' },
                        { key: 'pending', label: '⏳ В ожидании' },
                        { key: 'failed', label: '❌ С ошибкой' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: filter === f.key ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: filter === f.key ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('cardrefunds.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cardrefunds.zakaz', 'Заказ')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cardrefunds.klient', 'Клиент')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cardrefunds.karta', 'Карта')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('cardrefunds.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cardrefunds.sozdan', 'Создан')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('cardrefunds.status', 'Статус')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRefunds.map(refund => (
                                <tr key={refund.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                        {refund.order_id}
                                    </td>
                                    <td style={{ padding: '12px' }}>{refund.customer}</td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CreditCard size={18} color="#888" />
                                            <span>•••• {refund.card_last4}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                                        -{formatCurrency(refund.amount)}
                                    </td>
                                    <td style={{ padding: '12px', fontSize: '13px', color: '#888' }}>
                                        {formatDate(refund.created_at)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {getStatusBadge(refund.status)}
                                        {refund.error && (
                                            <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                                                {refund.error}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Важная информация */}
            <div className="card" style={{ marginTop: '20px', padding: '20px', background: '#fef3c7', border: '1px solid #fcd34d' }}>
                <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={20} color="#d97706" /> Важная информация
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#92400e' }}>
                    <li>{t('cardrefunds.vozvrat_na_kartu_obychno_zanimaet_ot_do', 'Возврат на карту обычно занимает от 1 до 5 рабочих дней')}</li>
                    <li>{t('cardrefunds.vozvrat_vozmozhen_tolko_na_tu_zhe_kartu', 'Возврат возможен только на ту же карту, с которой была произведена оплата')}</li>
                    <li>{t('cardrefunds.dlya_vozvrata_nalichnymi_ispolzuyte_stand', 'Для возврата наличными используйте стандартную операцию возврата')}</li>
                </ul>
            </div>
        </div>
    );
}

export default CardRefunds;
