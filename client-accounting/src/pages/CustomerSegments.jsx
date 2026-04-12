import React, { useState, useEffect } from 'react';
import { Users, Target, Filter, Search, Plus, Star, TrendingUp, DollarSign, ShoppingCart, Calendar } from 'lucide-react';
import { customersAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CustomerSegments() {
    const { t } = useI18n();
    const toast = useToast();
    const [segments, setSegments] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await customersAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSegments(apiData.segments || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('CustomerSegments: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    return (
        <div className="customer-segments-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('customersegments.segmenty_klientov', '👥 Сегменты клиентов')}</h1>
                    <p className="text-muted">{t('customersegments.gruppirovka_klientov_po_povedeniyu', 'Группировка клиентов по поведению')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Создание нового сегмента...')}>
                    <Plus size={18} /> Новый сегмент
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_customers}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('customersegments.vsego_klientov', 'Всего клиентов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('customersegments.aktivnyh', 'Активных')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.avg_ltv)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('customersegments.sredniy', 'Средний LTV')}</div>
                </div>
            </div>

            {/* Сегменты */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {segments.map(segment => (
                    <div key={segment.id} className="card" style={{
                        padding: '20px',
                        borderLeft: `4px solid ${segment.color}`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '40px', height: '40px',
                                        borderRadius: '50%',
                                        background: `${segment.color}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {segment.name === 'VIP клиенты' ? <Star size={20} color={segment.color} /> : <Users size={20} color={segment.color} />}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{segment.name}</h3>
                                        <div style={{ fontSize: '13px', color: '#888' }}>{segment.criteria}</div>
                                    </div>
                                </div>
                            </div>
                            <span style={{
                                background: `${segment.color}20`,
                                color: segment.color,
                                padding: '6px 16px',
                                borderRadius: '20px',
                                fontWeight: 'bold'
                            }}>
                                {segment.customers} клиентов
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>{t('customersegments.vyruchka', 'Выручка')}</div>
                                <div style={{ fontWeight: 'bold' }}>{formatCurrency(segment.revenue)}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>{t('customersegments.sredniy_chek', 'Средний чек')}</div>
                                <div style={{ fontWeight: 'bold' }}>{formatCurrency(segment.avg_check)}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>{t('customersegments.chastota_pokupok', 'Частота покупок')}</div>
                                <div style={{ fontWeight: 'bold' }}>{segment.frequency} / мес</div>
                            </div>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>{t('customersegments.uderzhanie', 'Удержание')}</div>
                                <div style={{ fontWeight: 'bold', color: segment.retention > 60 ? '#10b981' : segment.retention > 30 ? '#f59e0b' : '#ef4444' }}>
                                    {segment.retention}%
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CustomerSegments;
