import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, User, Search, AlertTriangle, Check, Clock, DollarSign } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useI18n } from '../i18n';


function Installments() {
    const { t } = useI18n();
    const [installments, setInstallments] = useState([]);
    const [plans, setPlans] = useState([]);
    const [activeTab, setActiveTab] = useState('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedInstallment, setSelectedInstallment] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setInstallments(apiData.installments || []);
        } catch (err) {
            console.warn('Installments: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const filteredInstallments = installments.filter(i => {
        const matchesSearch = i.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || i.status === activeTab;
        return matchesSearch && matchesTab;
    });

    const getStatusBadge = (status) => {
        const styles = {
            active: { bg: '#dbeafe', color: '#1d4ed8', text: 'Активна' },
            completed: { bg: '#dcfce7', color: '#16a34a', text: 'Погашена' },
            overdue: { bg: '#fee2e2', color: '#dc2626', text: 'Просрочена' }
        };
        const s = styles[status] || styles.active;
        return <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>{s.text}</span>;
    };

    const stats = {
        total: installments.length,
        active: installments.filter(i => i.status === 'active').length,
        totalAmount: installments.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        remaining: installments.reduce((sum, i) => sum + (i.remaining_amount || 0), 0)
    };

    return (
        <div className="installments-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('installments.rassrochka', '💳 Рассрочка')}</h1>
                    <p className="text-muted">{t('installments.upravlenie_prodazhami_v_rassrochku', 'Управление продажами в рассрочку')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={24} color="#1d4ed8" />
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
                            <div style={{ color: '#666', fontSize: '14px' }}>{t('installments.vsego_rassrochek', 'Всего рассрочек')}</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={24} color="#d97706" />
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.active}</div>
                            <div style={{ color: '#666', fontSize: '14px' }}>{t('installments.aktivnyh', 'Активных')}</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={24} color="#16a34a" />
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.totalAmount)}</div>
                            <div style={{ color: '#666', fontSize: '14px' }}>{t('installments.obschaya_summa', 'Общая сумма')}</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={24} color="#dc2626" />
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.remaining)}</div>
                            <div style={{ color: '#666', fontSize: '14px' }}>{t('installments.k_pogasheniyu', 'К погашению')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Планы рассрочки */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px' }}>{t('installments.dostupnye_plany', '📋 Доступные планы')}</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {plans.map(plan => (
                        <div key={plan.id} style={{
                            padding: '12px 20px',
                            border: '2px solid var(--border-color)',
                            borderRadius: '12px',
                            background: 'var(--bg-secondary)'
                        }}>
                            <div style={{ fontWeight: 'bold' }}>{plan.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                                {plan.months} мес. • {plan.interest_rate > 0 ? `${plan.interest_rate}%` : 'Без %'} • от {formatCurrency(plan.min_amount)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Табы и поиск */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'active', label: 'Активные' },
                            { key: 'completed', label: 'Погашенные' },
                            { key: 'overdue', label: 'Просроченные' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                                    color: activeTab === tab.key ? 'white' : 'inherit',
                                    cursor: 'pointer'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск по клиенту..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px', width: '100%' }}
                        />
                    </div>
                </div>

                {/* Таблица */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('installments.klient', 'Клиент')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('installments.plan', 'План')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('installments.summa', 'Сумма')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('installments.ezhemes_platyozh', 'Ежемес. платёж')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('installments.progress', 'Прогресс')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('installments.sled_platyozh', 'След. платёж')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('installments.status', 'Статус')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center' }}>{t('installments.zagruzka', 'Загрузка...')}</td></tr>
                        ) : filteredInstallments.length === 0 ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>{t('installments.rassrochki_ne_naydeny', 'Рассрочки не найдены')}</td></tr>
                        ) : (
                            filteredInstallments.map(inst => (
                                <tr key={inst.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 500 }}>{inst.customer_name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{inst.customer_phone}</div>
                                    </td>
                                    <td style={{ padding: '12px' }}>{inst.plan_name}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(inst.total_amount)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(inst.monthly_payment)}</td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${(inst.payments_done / inst.payments_total) * 100}%`,
                                                    height: '100%',
                                                    background: inst.status === 'completed' ? '#10b981' : '#3b82f6',
                                                    borderRadius: '4px'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '12px', color: '#666' }}>
                                                {inst.payments_done}/{inst.payments_total}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {inst.next_payment_date ? formatDate(inst.next_payment_date) : '-'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {getStatusBadge(inst.status)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Installments;
