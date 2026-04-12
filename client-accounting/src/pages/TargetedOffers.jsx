import React, { useState, useEffect } from 'react';
import { Target, Users, Gift, Percent, Plus, Search, Check, Clock, TrendingUp, Eye } from 'lucide-react';
import { crmAPI } from '../services/api';
import { useI18n } from '../i18n';

function TargetedOffers() {
    const { t } = useI18n();
    const [offers, setOffers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await crmAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setOffers(apiData.offers || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('TargetedOffers: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Активно', color: '#10b981', bg: '#dcfce7' },
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6' },
            paused: { label: 'Приостановлено', color: '#f59e0b', bg: '#fef3c7' }
        };
        return statuses[status] || statuses.draft;
    };

    const [showModal, setShowModal] = useState(false);
    const [message, setMessage] = useState(null);

    const handleNewOffer = () => {
        setShowModal(true);
        setMessage({ type: 'info', text: 'Создание нового предложения...' });
        // In real app would show modal form
        setTimeout(() => {
            setMessage({ type: 'success', text: 'Форма создания оффера открыта' });
        }, 500);
    };

    return (
        <div className="targeted-offers-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('targetedoffers.targetirovannye_predlozheniya', '🎯 Таргетированные предложения')}</h1>
                    <p className="text-muted">{t('targetedoffers.personalizirovannye_offery_dlya_segmentov', 'Персонализированные офферы для сегментов')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewOffer}>
                    <Plus size={18} /> Новое предложение
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Target size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('targetedoffers.aktivnyh_offerov', 'Активных офферов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_conversions}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('targetedoffers.konversiy', 'Конверсий')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_conversion}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('targetedoffers.konversiya', 'Конверсия')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Gift size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(stats.total_revenue)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('targetedoffers.vyruchka', 'Выручка')}</div>
                </div>
            </div>

            {/* Офферы */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('targetedoffers.vse_predlozheniya', '📋 Все предложения')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('targetedoffers.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('targetedoffers.predlozhenie', 'Предложение')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('targetedoffers.segment', 'Сегмент')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('targetedoffers.prosmotry', 'Просмотры')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('targetedoffers.konversii', 'Конверсии')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('targetedoffers.vyruchka', 'Выручка')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('targetedoffers.status', 'Статус')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offers.map(offer => {
                                const statusInfo = getStatusInfo(offer.status);
                                const conversionRate = offer.views > 0 ? Math.round((offer.conversions / offer.views) * 100) : 0;

                                return (
                                    <tr key={offer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '14px' }}>
                                            <div style={{ fontWeight: 500 }}>{offer.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Percent size={12} />
                                                {offer.offer}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px' }}>
                                            <div style={{ fontWeight: 500 }}>{offer.segment}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{offer.segment_size} клиентов</div>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <Eye size={14} color="#888" />
                                                {offer.views}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold' }}>{offer.conversions}</div>
                                            <div style={{ fontSize: '11px', color: conversionRate > 20 ? '#10b981' : '#f59e0b' }}>
                                                {conversionRate}%
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(offer.revenue)}
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
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

export default TargetedOffers;
