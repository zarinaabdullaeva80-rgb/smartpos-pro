import React, { useState, useEffect } from 'react';
import { User, Gift, ShoppingBag, Heart, Star, Settings, CreditCard, MapPin, Clock, ChevronRight, Award } from 'lucide-react';
import { customersAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CustomerPortal() {
    const { t } = useI18n();
    const toast = useToast();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await customersAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setCustomer(apiData.customer || {});
        } catch (err) {
            console.warn('CustomerPortal: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => new Date(date).toLocaleDateString('ru-RU');

    const getStatusLabel = (status) => {
        const statuses = {
            delivering: { label: '🚚 В доставке', color: '#3b82f6' },
            delivered: { label: '✅ Доставлен', color: '#10b981' },
            processing: { label: '⏳ Обработка', color: '#f59e0b' }
        };
        return statuses[status] || { label: status, color: '#888' };
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>{t('customerportal.zagruzka', 'Загрузка...')}</div>;
    }

    return (
        <div className="customer-portal-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('customerportal.lichnyy_kabinet', '👤 Личный кабинет')}</h1>
                    <p className="text-muted">{t('customerportal.portal_klienta', 'Портал клиента')}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
                {/* Профиль */}
                <div>
                    <div className="card" style={{ padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                        <div style={{
                            width: '80px', height: '80px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${customer.level_color}40, ${customer.level_color}20)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            border: `3px solid ${customer.level_color}`
                        }}>
                            <User size={40} color={customer.level_color} />
                        </div>
                        <h2 style={{ margin: '0 0 4px' }}>{customer.name}</h2>
                        <span style={{
                            background: `${customer.level_color}20`,
                            color: customer.level_color,
                            padding: '4px 16px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <Award size={14} /> {customer.level}
                        </span>
                        <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: customer.level_color }}>
                                {customer.points.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '13px', color: '#888' }}>{t('customerportal.bonusnyh_ballov', 'бонусных баллов')}</div>
                            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                                ≈ {formatCurrency(customer.points_value)}
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                        <div style={{ display: 'grid', gap: '4px' }}>
                            {[
                                { icon: ShoppingBag, label: 'Мои заказы', value: customer.total_purchases },
                                { icon: CreditCard, label: 'Сумма покупок', value: formatCurrency(customer.total_spent) },
                                { icon: Clock, label: 'Клиент с', value: formatDate(customer.member_since) }
                            ].map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}>
                                    <item.icon size={20} color="#888" />
                                    <span style={{ flex: 1, color: '#666' }}>{item.label}</span>
                                    <span style={{ fontWeight: 500 }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Контент */}
                <div>
                    {/* Последние заказы */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{t('customerportal.poslednie_zakazy', '📦 Последние заказы')}</h3>
                            <a href="#" style={{ color: 'var(--primary)', fontSize: '13px' }}>{t('customerportal.vse_zakazy', 'Все заказы →')}</a>
                        </div>
                        <div>
                            {customer.recent_orders.map(order => {
                                const statusInfo = getStatusLabel(order.status);
                                return (
                                    <div key={order.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>Заказ #{order.id}</div>
                                            <div style={{ fontSize: '13px', color: '#888' }}>{formatDate(order.date)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', marginRight: '16px' }}>
                                            <div style={{ fontWeight: 'bold' }}>{formatCurrency(order.total)}</div>
                                            <div style={{ fontSize: '12px', color: statusInfo.color }}>{statusInfo.label}</div>
                                        </div>
                                        <ChevronRight size={20} color="#888" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Wishlist */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{t('customerportal.izbrannoe', '❤️ Избранное')}</h3>
                            <a href="#" style={{ color: 'var(--primary)', fontSize: '13px' }}>{t('customerportal.vse_tovary', 'Все товары →')}</a>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
                            {customer.wishlist.map(item => (
                                <div key={item.id} style={{
                                    padding: '16px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{ fontSize: '32px' }}>{item.image}</div>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                                        <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{formatCurrency(item.price)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Адреса */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{t('customerportal.adresa_dostavki', '📍 Адреса доставки')}</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => toast.success('Добавление адреса...')}>+ Добавить</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
                            {customer.saved_addresses.map(addr => (
                                <div key={addr.id} style={{
                                    padding: '16px',
                                    border: addr.default ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    background: addr.default ? 'var(--primary-light)' : 'transparent'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <MapPin size={16} color="var(--primary)" />
                                        <span style={{ fontWeight: 500 }}>{addr.label}</span>
                                        {addr.default && (
                                            <span style={{
                                                fontSize: '10px',
                                                background: 'var(--primary)',
                                                color: 'white',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                По умолчанию
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#666' }}>{addr.address}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CustomerPortal;
