import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, TrendingUp, AlertTriangle, Calendar, Plus, Search, DollarSign, Truck } from 'lucide-react';
import { purchasesAPI } from '../services/api';
import { useI18n } from '../i18n';

function PurchasePlanning() {
    const { t } = useI18n();
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await purchasesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setItems(apiData.items || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('PurchasePlanning: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getPriorityInfo = (priority) => {
        const priorities = {
            high: { label: 'Срочно', color: '#ef4444', bg: '#fee2e2' },
            medium: { label: 'Средний', color: '#f59e0b', bg: '#fef3c7' },
            low: { label: 'Низкий', color: '#10b981', bg: '#dcfce7' }
        };
        return priorities[priority] || priorities.medium;
    };

    const [message, setMessage] = useState(null);
    const handleCreateOrder = () => setMessage({ type: 'info', text: 'Создание заказа на закупку...' });

    return (
        <div className="purchase-planning-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('purchaseplanning.planirovanie_zakupok', '📦 Планирование закупок')}</h1>
                    <p className="text-muted">{t('purchaseplanning.optimalnye_zakazy_na_osnove_sprosa', 'Оптимальные заказы на основе спроса')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreateOrder}>
                    <ShoppingCart size={18} /> Создать заказ
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_orders}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('purchaseplanning.pozitsiy_k_zakazu', 'Позиций к заказу')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.total_value)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('purchaseplanning.summa_zakazov', 'Сумма заказов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.critical_items}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('purchaseplanning.kriticheskih', 'Критических')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Truck size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_lead_time} дн.</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('purchaseplanning.srednee_vremya_dostavki', 'Среднее время доставки')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('purchaseplanning.rekomenduemye_zakupki', '📋 Рекомендуемые закупки')}</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '250px' }} />
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('purchaseplanning.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('purchaseplanning.tovar', 'Товар')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('purchaseplanning.tekuschiy', 'Текущий')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('purchaseplanning.min_opt', 'Мин / Опт')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('purchaseplanning.spros_ned', 'Спрос/нед')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('purchaseplanning.postavschik', 'Поставщик')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('purchaseplanning.zakaz', 'Заказ')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('purchaseplanning.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('purchaseplanning.prioritet', 'Приоритет')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const priorityInfo = getPriorityInfo(item.priority);
                                const stockPercent = (item.current / item.optimal) * 100;

                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{item.product}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{item.sku}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}>
                                                <div style={{
                                                    width: '60px',
                                                    height: '8px',
                                                    background: '#e5e7eb',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        width: `${stockPercent}%`,
                                                        height: '100%',
                                                        background: stockPercent < 50 ? '#ef4444' : stockPercent < 80 ? '#f59e0b' : '#10b981',
                                                        borderRadius: '4px'
                                                    }} />
                                                </div>
                                                <span style={{ fontWeight: 'bold' }}>{item.current}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                                            {item.min} / {item.optimal}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <TrendingUp size={14} color="#10b981" />
                                                {item.demand}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{item.supplier}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>{item.lead_time} дней</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {item.order_qty} шт.
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(item.order_qty * item.unit_cost)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: priorityInfo.bg,
                                                color: priorityInfo.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {priorityInfo.label}
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

export default PurchasePlanning;
