import React, { useState, useEffect } from 'react';
import { ShoppingBag, RefreshCw, Check, X, AlertTriangle, Settings, Plus, TrendingUp, Package, DollarSign } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Marketplaces() {
    const { t } = useI18n();
    const toast = useToast();
    const [marketplaces, setMarketplaces] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('Marketplaces.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('Marketplaces: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            connected: { label: 'Подключён', color: '#10b981', bg: '#dcfce7', icon: Check },
            disconnected: { label: 'Отключён', color: '#888', bg: '#f3f4f6', icon: X },
            pending: { label: 'Ожидает', color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
            error: { label: 'Ошибка', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle }
        };
        return statuses[status] || statuses.disconnected;
    };

    const handleConnect = (name) => toast.info(`Подключение к ${name}...`);

    return (
        <div className="marketplaces-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('marketplaces.marketpleysy', '🛒 Маркетплейсы')}</h1>
                    <p className="text-muted">{t('marketplaces.integratsiya_s_torgovymi_ploschadkami', 'Интеграция с торговыми площадками')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleConnect('маркетплейсу')}>
                    <Plus size={18} /> Подключить
                </button>
            </div>

            {/* Общая статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <ShoppingBag size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>2</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('marketplaces.aktivnyh_ploschadok', 'Активных площадок')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>425</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('marketplaces.tovarov_opublikovano', 'Товаров опубликовано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>17</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('marketplaces.zakazov_segodnya', 'Заказов сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(63000000)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('marketplaces.vyruchka_segodnya', 'Выручка сегодня')}</div>
                </div>
            </div>

            {/* Маркетплейсы */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {marketplaces.map(mp => {
                    const statusInfo = getStatusInfo(mp.status);
                    const StatusIcon = statusInfo.icon;

                    return (
                        <div key={mp.id} className="card" style={{
                            padding: '24px',
                            opacity: mp.status === 'disconnected' ? 0.7 : 1
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '56px', height: '56px',
                                        borderRadius: '12px',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '28px'
                                    }}>
                                        {mp.logo}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{mp.name}</h3>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            marginTop: '4px'
                                        }}>
                                            <StatusIcon size={12} /> {statusInfo.label}
                                        </span>
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Настройки: ${mp.name}`)}>
                                    <Settings size={14} />
                                </button>
                            </div>

                            {mp.status === 'connected' ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{mp.products_synced}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{t('marketplaces.tovarov', 'Товаров')}</div>
                                        </div>
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{mp.orders_today}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{t('marketplaces.zakazov', 'Заказов')}</div>
                                        </div>
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatCurrency(mp.revenue_today)}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{t('marketplaces.vyruchka', 'Выручка')}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#888' }}>
                                        <span>Комиссия: {mp.commission}%</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <RefreshCw size={12} />
                                            Синхр.: {mp.last_sync}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <button className="btn btn-primary" onClick={() => toast.info('Подключение маркетплейса...')}>
                                        <Plus size={16} /> Подключить
                                    </button>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                                        Комиссия: {mp.commission}%
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Marketplaces;
