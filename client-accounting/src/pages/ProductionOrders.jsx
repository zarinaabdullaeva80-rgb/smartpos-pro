import React, { useState, useEffect } from 'react';
import { Factory, Plus, Calendar, Clock, Check, Play, Pause, Package } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useI18n } from '../i18n';

function ProductionOrders() {
    const { t } = useI18n();
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setOrders(apiData.orders || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('ProductionOrders: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            planned: { label: 'Запланирован', color: '#888', bg: '#f3f4f6', icon: Calendar },
            in_progress: { label: 'В работе', color: '#3b82f6', bg: '#dbeafe', icon: Play },
            paused: { label: 'Пауза', color: '#f59e0b', bg: '#fef3c7', icon: Pause },
            completed: { label: 'Завершён', color: '#10b981', bg: '#dcfce7', icon: Check }
        };
        return statuses[status] || statuses.planned;
    };

    const getPriorityInfo = (priority) => {
        const priorities = {
            high: { label: '🔴 Высокий', color: '#ef4444' },
            normal: { label: '🟡 Обычный', color: '#f59e0b' },
            low: { label: '🟢 Низкий', color: '#10b981' }
        };
        return priorities[priority] || priorities.normal;
    };

    const [message, setMessage] = useState(null);
    const handleNewOrder = () => setMessage({ type: 'info', text: 'Создание нового производственного заказа...' });

    return (
        <div className="production-orders-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('productionorders.proizvodstvennye_zakazy', '🏭 Производственные заказы')}</h1>
                    <p className="text-muted">{t('productionorders.planirovanie_i_otslezhivanie_proizvodstva', 'Планирование и отслеживание производства')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewOrder}>
                    <Plus size={18} /> Новый заказ
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dbeafe' }}>
                    <Play size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.in_progress}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>В работе</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Calendar size={28} color="#888" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.planned}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('productionorders.zaplanirovano', 'Запланировано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dcfce7' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.completed_today}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('productionorders.zaversheno_segodnya', 'Завершено сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_units}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('productionorders.edinits_k_proizvodstvu', 'Единиц к производству')}</div>
                </div>
            </div>

            {/* Таблица заказов */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('productionorders.proizvodstvennye_zakazy', '📋 Производственные заказы')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('productionorders.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('productionorders.zakaz', 'Заказ')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('productionorders.retseptura', 'Рецептура')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('productionorders.kol_vo', 'Кол-во')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('productionorders.progress', 'Прогресс')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('productionorders.sroki', 'Сроки')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('productionorders.prioritet', 'Приоритет')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('productionorders.status', 'Статус')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => {
                                const statusInfo = getStatusInfo(order.status);
                                const priorityInfo = getPriorityInfo(order.priority);
                                const StatusIcon = statusInfo.icon;
                                const progress = (order.completed / order.qty) * 100;

                                return (
                                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ fontWeight: 500, color: 'var(--primary)' }}>{order.id}</span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{order.recipe}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{order.qty}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${progress}%`,
                                                        height: '100%',
                                                        background: progress === 100 ? '#10b981' : '#3b82f6',
                                                        borderRadius: '4px'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '50px' }}>
                                                    {order.completed}/{order.qty}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '13px' }}>{order.planned}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>до {order.due}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>
                                            {priorityInfo.label}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
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

export default ProductionOrders;
