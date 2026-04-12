import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, Clock, Package, Bell, Check, Trash2 } from 'lucide-react';
import { productsAPI,  batchesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function ExpiryTracking() {
    const { t } = useI18n();
    const toast = useToast();
    const [expiringProducts, setExpiringProducts] = useState([]);
    const [expiredProducts, setExpiredProducts] = useState([]);
    const [activeTab, setActiveTab] = useState('expiring');
    const [loading, setLoading] = useState(true);
    const [alertDays, setAlertDays] = useState(30);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await batchesAPI.getExpiring();
            const apiData = apiRes.data || apiRes;
            console.log('ExpiryTracking.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('ExpiryTracking: не удалось загрузить данные', err.message);
        }


        setLoading(false);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';
    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getUrgencyColor = (days) => {
        if (days <= 3) return '#ef4444';
        if (days <= 7) return '#f59e0b';
        if (days <= 14) return '#eab308';
        return '#10b981';
    };

    const stats = {
        expiring: expiringProducts.length,
        expired: expiredProducts.length,
        critical: expiringProducts.filter(p => p.days_left <= 3).length,
        totalQty: expiringProducts.reduce((sum, p) => sum + p.quantity, 0)
    };

    return (
        <div className="expiry-tracking-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('expirytracking.sroki_godnosti', '📅 Сроки годности')}</h1>
                    <p className="text-muted">{t('expirytracking.otslezhivanie_srokov_godnosti_tovarov', 'Отслеживание сроков годности товаров')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>{t('expirytracking.preduprezhdat_za', 'Предупреждать за:')}</span>
                    <select value={alertDays} onChange={(e) => setAlertDays(e.target.value)} style={{ width: '120px' }}>
                        <option value="7">{t('expirytracking.dney', '7 дней')}</option>
                        <option value="14">{t('expirytracking.dney', '14 дней')}</option>
                        <option value="30">{t('expirytracking.dney', '30 дней')}</option>
                        <option value="60">{t('expirytracking.dney', '60 дней')}</option>
                    </select>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                    <Clock size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.expiring}</div>
                    <div style={{ color: '#666' }}>{t('expirytracking.istekaet_skoro', 'Истекает скоро')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.critical}</div>
                    <div style={{ color: '#666' }}>{t('expirytracking.kritichno_dney', 'Критично (≤3 дней)')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #dc2626' }}>
                    <Calendar size={28} color="#dc2626" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.expired}</div>
                    <div style={{ color: '#666' }}>{t('expirytracking.prosrocheno', 'Просрочено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
                    <Package size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.totalQty}</div>
                    <div style={{ color: '#666' }}>{t('expirytracking.edinits_tovara', 'Единиц товара')}</div>
                </div>
            </div>

            {/* Табы */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setActiveTab('expiring')}
                        style={{
                            padding: '8px 20px',
                            border: 'none',
                            borderRadius: '8px',
                            background: activeTab === 'expiring' ? '#fef3c7' : 'transparent',
                            color: activeTab === 'expiring' ? '#d97706' : 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <Clock size={16} /> Истекает скоро ({stats.expiring})
                    </button>
                    <button
                        onClick={() => setActiveTab('expired')}
                        style={{
                            padding: '8px 20px',
                            border: 'none',
                            borderRadius: '8px',
                            background: activeTab === 'expired' ? '#fee2e2' : 'transparent',
                            color: activeTab === 'expired' ? '#dc2626' : 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <AlertTriangle size={16} /> Просрочено ({stats.expired})
                    </button>
                </div>

                {/* Таблица */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('expirytracking.zagruzka', 'Загрузка...')}</div>
                ) : activeTab === 'expiring' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.tovar', 'Товар')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.partiya', 'Партия')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('expirytracking.kol_vo', 'Кол-во')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.sklad', 'Склад')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.goden_do', 'Годен до')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('expirytracking.ostalos', 'Осталось')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('expirytracking.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiringProducts.map(product => (
                                <tr key={product.id} style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    background: product.days_left <= 3 ? '#fef2f2' : 'transparent'
                                }}>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>{product.product_name}</td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{product.batch}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{product.quantity} шт</td>
                                    <td style={{ padding: '12px' }}>{product.warehouse}</td>
                                    <td style={{ padding: '12px' }}>{formatDate(product.expiry_date)}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: getUrgencyColor(product.days_left) + '20',
                                            color: getUrgencyColor(product.days_left),
                                            fontWeight: 'bold'
                                        }}>
                                            {product.days_left} дней
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                            <button className="btn btn-sm btn-secondary" title="Уценить" onClick={() => toast.info(`Уценка: ${product.product_name}`)}>
                                                <Bell size={14} />
                                            </button>
                                            <button className="btn btn-sm btn-secondary" title="Списать" onClick={() => toast.info(`Списание: ${product.product_name}`)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.tovar', 'Товар')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.partiya', 'Партия')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('expirytracking.kol_vo', 'Кол-во')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('expirytracking.istyok', 'Истёк')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('expirytracking.prosrocheno', 'Просрочено')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('expirytracking.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('expirytracking.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredProducts.map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>{product.product_name}</td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>{product.batch}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{product.quantity} шт</td>
                                    <td style={{ padding: '12px' }}>{formatDate(product.expiry_date)}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                            {product.days_expired} дней назад
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {product.status === 'written_off' ? (
                                            <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                                                <Check size={14} style={{ marginRight: '4px' }} /> Списано
                                            </span>
                                        ) : (
                                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                                                Требует списания
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {product.status !== 'written_off' && (
                                            <button className="btn btn-sm btn-primary" onClick={() => toast.info(`Списание просроченного: ${product.product_name}`)}>Списать</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default ExpiryTracking;
