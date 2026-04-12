import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Clock, CheckCircle, Truck, Calendar, User, Phone, DollarSign } from 'lucide-react';
import { salesAPI } from '../services/api';
import { useI18n } from '../i18n';

function Preorders() {
    const { t } = useI18n();
    const [preorders, setPreorders] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await salesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('Preorders.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('Preorders: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusBadge = (status) => {
        const styles = {
            pending: { bg: '#fef3c7', color: '#d97706', icon: Clock, text: 'Ожидает' },
            confirmed: { bg: '#dbeafe', color: '#1d4ed8', icon: CheckCircle, text: 'Подтверждён' },
            in_production: { bg: '#e0e7ff', color: '#4f46e5', icon: Package, text: 'В производстве' },
            ready: { bg: '#dcfce7', color: '#16a34a', icon: Package, text: 'Готов к выдаче' },
            delivered: { bg: '#f3f4f6', color: '#6b7280', icon: Truck, text: 'Выдан' },
            cancelled: { bg: '#fee2e2', color: '#dc2626', icon: Clock, text: 'Отменён' }
        };
        const s = styles[status] || styles.pending;
        const Icon = s.icon;
        return (
            <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={14} /> {s.text}
            </span>
        );
    };

    const filteredPreorders = preorders.filter(p => {
        const matchesSearch = p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || p.status === activeTab;
        return matchesSearch && matchesTab;
    });

    const stats = {
        total: preorders.length,
        pending: preorders.filter(p => ['pending', 'confirmed'].includes(p.status)).length,
        ready: preorders.filter(p => p.status === 'ready').length,
        totalAmount: preorders.filter(p => p.status !== 'delivered' && p.status !== 'cancelled')
            .reduce((sum, p) => sum + (p.total_amount || 0), 0)
    };

    return (
        <div className="preorders-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('preorders.predzakazy', '📦 Предзаказы')}</h1>
                    <p className="text-muted">{t('preorders.upravlenie_zakazami_na_tovary_ne_v_nalich', 'Управление заказами на товары не в наличии')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={18} /> Новый предзаказ
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.total}</div>
                    <div style={{ color: '#666' }}>{t('preorders.vsego_predzakazov', 'Всего предзаказов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.pending}</div>
                    <div style={{ color: '#666' }}>{t('preorders.v_obrabotke', 'В обработке')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.ready}</div>
                    <div style={{ color: '#666' }}>{t('preorders.gotovy_k_vydache', 'Готовы к выдаче')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(stats.totalAmount)}</div>
                    <div style={{ color: '#666' }}>{t('preorders.summa_aktivnyh', 'Сумма активных')}</div>
                </div>
            </div>

            {/* Табы и поиск */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'pending', label: '⏳ Ожидают' },
                            { key: 'confirmed', label: '✓ Подтверждены' },
                            { key: 'ready', label: '📦 Готовы' },
                            { key: 'delivered', label: '✅ Выданы' }
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
                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px', width: '100%' }}
                        />
                    </div>
                </div>

                {/* Список */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('preorders.zagruzka', 'Загрузка...')}</div>
                ) : filteredPreorders.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <Package size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                        <p>{t('preorders.predzakazy_ne_naydeny', 'Предзаказы не найдены')}</p>
                    </div>
                ) : (
                    <div>
                        {filteredPreorders.map(order => (
                            <div key={order.id} style={{
                                padding: '20px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '20px'
                            }}>
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', flexShrink: 0
                                }}>
                                    <Package size={28} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px' }}>{order.order_number}</h4>
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                <User size={14} style={{ marginRight: '4px' }} />
                                                {order.customer_name} • <Phone size={14} style={{ marginRight: '4px' }} />{order.customer_phone}
                                            </div>
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </div>

                                    <div style={{
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        marginBottom: '12px'
                                    }}>
                                        {order.items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{item.name} × {item.quantity}</span>
                                                <span style={{ fontWeight: 'bold' }}>{formatCurrency(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: '#666' }}>
                                        <span><DollarSign size={14} /> {t('preorders.itogo', 'Итого:')} <b>{formatCurrency(order.total_amount)}</b></span>
                                        <span>
                                            {order.deposit_paid ? (
                                                <span style={{ color: '#10b981' }}>✓ Аванс {formatCurrency(order.deposit_amount)}</span>
                                            ) : (
                                                <span style={{ color: '#f59e0b' }}>{t('preorders.bez_avansa', '⚠ Без аванса')}</span>
                                            )}
                                        </span>
                                        <span><Calendar size={14} /> Ожидается: {formatDate(order.expected_date)}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {order.status === 'pending' && <button className="btn btn-primary btn-sm">{t('preorders.podtverdit', 'Подтвердить')}</button>}
                                    {order.status === 'ready' && <button className="btn btn-success btn-sm">{t('preorders.vydat', 'Выдать')}</button>}
                                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                        <button className="btn btn-secondary btn-sm">{t('preorders.otmenit', 'Отменить')}</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Preorders;
