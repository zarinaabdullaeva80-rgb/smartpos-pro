import React, { useState, useEffect } from 'react';
import { Package, Truck, Check, Clock, MapPin, Phone, User, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { salesAPI } from '../services/api';
import { useI18n } from '../i18n';

function OrderTracking() {
    const { t } = useI18n();
    const [order, setOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState('1845');
    const [loading, setLoading] = useState(false);

    useEffect(() => { searchOrder(); }, []);

    const searchOrder = async () => {
        setLoading(true);
        try {
            const apiRes = await salesAPI.getById(searchQuery);
            const apiData = apiRes.data || apiRes;
            setOrder(apiData.order || apiData || null);
        } catch (err) {
            console.warn('OrderTracking: не удалось найти заказ', err.message);
            setOrder(null);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            created: { color: '#888', icon: Clock },
            confirmed: { color: '#3b82f6', icon: Check },
            preparing: { color: '#f59e0b', icon: Package },
            ready: { color: '#8b5cf6', icon: Package },
            delivering: { color: '#3b82f6', icon: Truck },
            delivered: { color: '#10b981', icon: Check }
        };
        return statuses[status] || statuses.created;
    };

    return (
        <div className="order-tracking-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('ordertracking.status_zakaza', '📦 Статус заказа')}</h1>
                    <p className="text-muted">{t('ordertracking.otslezhivanie_zakaza_dlya_klienta', 'Отслеживание заказа для клиента')}</p>
                </div>
            </div>

            {/* Поиск */}
            <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Введите номер заказа..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '48px', fontSize: '16px', padding: '14px 14px 14px 48px', width: '100%' }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={searchOrder} style={{ padding: '14px 24px' }}>
                        <Search size={18} /> Найти
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <RefreshCw size={40} className="spin" style={{ marginBottom: '16px', color: '#3b82f6' }} />
                    <div>{t('ordertracking.poisk_zakaza', 'Поиск заказа...')}</div>
                </div>
            ) : order ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
                    {/* Основная информация */}
                    <div>
                        {/* Статус */}
                        <div className="card" style={{
                            marginBottom: '20px',
                            padding: '24px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '64px', height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Truck size={32} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Заказ #{order.id}</div>
                                    <div style={{ opacity: 0.9 }}>{t('ordertracking.v_puti_k_klientu', '🚚 В пути к клиенту')}</div>
                                    <div style={{ marginTop: '8px', fontSize: '14px', opacity: 0.8 }}>
                                        Ожидаемая доставка: {order.estimated_delivery}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="card" style={{ padding: '24px' }}>
                            <h3 style={{ margin: '0 0 20px' }}>{t('ordertracking.otslezhivanie', '📍 Отслеживание')}</h3>
                            <div style={{ position: 'relative' }}>
                                {order.timeline.map((step, idx) => {
                                    const statusInfo = getStatusInfo(step.status);
                                    const StepIcon = statusInfo.icon;

                                    return (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            gap: '16px',
                                            paddingBottom: idx < order.timeline.length - 1 ? '24px' : 0,
                                            position: 'relative'
                                        }}>
                                            {idx < order.timeline.length - 1 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '19px',
                                                    top: '40px',
                                                    width: '2px',
                                                    height: 'calc(100% - 40px)',
                                                    background: step.completed ? statusInfo.color : '#e5e7eb'
                                                }} />
                                            )}
                                            <div style={{
                                                width: '40px', height: '40px',
                                                borderRadius: '50%',
                                                background: step.completed ? `${statusInfo.color}20` : '#f3f4f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                border: step.completed ? `2px solid ${statusInfo.color}` : '2px solid #e5e7eb'
                                            }}>
                                                <StepIcon size={18} color={step.completed ? statusInfo.color : '#888'} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontWeight: step.completed ? 500 : 400,
                                                    color: step.completed ? 'inherit' : '#888'
                                                }}>
                                                    {step.label}
                                                </div>
                                                {step.time && (
                                                    <div style={{ fontSize: '13px', color: '#888' }}>{step.time}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Детали */}
                    <div>
                        {/* Курьер */}
                        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                            <h4 style={{ margin: '0 0 12px' }}>{t('ordertracking.kurer', '🚗 Курьер')}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '48px', height: '48px',
                                    borderRadius: '50%',
                                    background: 'var(--primary-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <User size={24} color="var(--primary)" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{order.courier.name}</div>
                                    <a href={`tel:${order.courier.phone}`} style={{ color: 'var(--primary)', fontSize: '13px' }}>
                                        {order.courier.phone}
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Адрес */}
                        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                            <h4 style={{ margin: '0 0 12px' }}>{t('ordertracking.adres_dostavki', '📍 Адрес доставки')}</h4>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <MapPin size={18} color="#888" style={{ marginTop: '2px' }} />
                                <div>
                                    <div>{order.customer.address}</div>
                                    <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                                        {order.customer.name}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Товары */}
                        <div className="card" style={{ padding: '20px' }}>
                            <h4 style={{ margin: '0 0 12px' }}>{t('ordertracking.tovary', '🛒 Товары')}</h4>
                            {order.items.map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px 0',
                                    borderBottom: idx < order.items.length - 1 ? '1px solid var(--border-color)' : 'none'
                                }}>
                                    <div>
                                        <div>{item.name}</div>
                                        <div style={{ fontSize: '13px', color: '#888' }}>{item.qty} шт.</div>
                                    </div>
                                    <div style={{ fontWeight: 500 }}>{formatCurrency(item.price)}</div>
                                </div>
                            ))}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '2px solid var(--border-color)',
                                fontWeight: 'bold',
                                fontSize: '16px'
                            }}>
                                <span>{t('ordertracking.itogo', 'Итого:')}</span>
                                <span>{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <AlertCircle size={48} color="#888" style={{ marginBottom: '16px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 500 }}>{t('ordertracking.zakaz_ne_nayden', 'Заказ не найден')}</div>
                    <div style={{ color: '#888', marginTop: '8px' }}>{t('ordertracking.proverte_nomer_zakaza', 'Проверьте номер заказа')}</div>
                </div>
            )}
        </div>
    );
}

export default OrderTracking;
