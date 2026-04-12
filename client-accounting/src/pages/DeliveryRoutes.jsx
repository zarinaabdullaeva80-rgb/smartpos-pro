import React, { useState, useEffect } from 'react';
import { MapPin, Truck, Clock, Navigation, Plus, Eye, Play, Check, Package } from 'lucide-react';
import { deliveriesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DeliveryRoutes() {
    const { t } = useI18n();
    const toast = useToast();
    const [routes, setRoutes] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await deliveriesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setRoutes(apiData.routes || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('DeliveryRoutes: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            planned: { label: 'Запланирован', color: '#888', bg: '#f3f4f6' },
            active: { label: 'В пути', color: '#3b82f6', bg: '#dbeafe' },
            completed: { label: 'Завершён', color: '#10b981', bg: '#dcfce7' }
        };
        return statuses[status] || statuses.planned;
    };

    const getStopStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Ожидает', color: '#888', icon: Clock },
            in_transit: { label: 'В пути', color: '#3b82f6', icon: Truck },
            delivered: { label: 'Доставлен', color: '#10b981', icon: Check }
        };
        return statuses[status] || statuses.pending;
    };

    const [message, setMessage] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoute, setNewRoute] = useState({
        name: '',
        courier: '',
        orders: []
    });

    const handleCreateRoute = () => {
        if (!newRoute.name || !newRoute.courier) {
            setMessage({ type: 'error', text: 'Заполните все обязательные поля' });
            return;
        }

        const route = {
            id: `М-${String(routes.length + 1).padStart(3, '0')}`,
            name: newRoute.name,
            courier: newRoute.courier,
            status: 'planned',
            orders: 0,
            completed: 0,
            distance: 0,
            estimated_time: 0,
            actual_time: 0,
            stops: []
        };

        setRoutes([route, ...routes]);
        setShowCreateModal(false);
        setNewRoute({ name: '', courier: '', orders: [] });
        setMessage({ type: 'success', text: `Маршрут ${route.id} создан` });
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="delivery-routes-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('deliveryroutes.marshruty_dostavki', '🗺️ Маршруты доставки')}</h1>
                    <p className="text-muted">{t('deliveryroutes.optimizatsiya_marshrutov_kurerov', 'Оптимизация маршрутов курьеров')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} /> Новый маршрут
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '16px', textAlign: 'center', background: '#dbeafe' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.active}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{t('deliveryroutes.aktivnyh', 'Активных')}</div>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.planned}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{t('deliveryroutes.zaplanirovano', 'Запланировано')}</div>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center', background: '#dcfce7' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{stats.completed}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{t('deliveryroutes.zaversheno', 'Завершено')}</div>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total_orders}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{t('deliveryroutes.zakazov', 'Заказов')}</div>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{stats.delivered}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{t('deliveryroutes.dostavleno', 'Доставлено')}</div>
                </div>
            </div>

            {/* Маршруты */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {routes.map(route => {
                    const statusInfo = getStatusInfo(route.status);
                    const progress = (route.completed / route.orders) * 100;

                    return (
                        <div key={route.id} className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '48px', height: '48px',
                                        borderRadius: '12px',
                                        background: statusInfo.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Navigation size={24} color={statusInfo.color} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{route.id}</span>
                                            <span style={{ fontWeight: 'bold' }}>{route.name}</span>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '2px 10px',
                                                borderRadius: '10px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                                            <Truck size={14} style={{ marginRight: '4px' }} />{route.courier}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Просмотр маршрута ${route.id}`)}>
                                        <Eye size={14} /> Детали
                                    </button>
                                    {route.status === 'planned' && (
                                        <button className="btn btn-sm btn-primary" onClick={() => toast.info(`Запуск маршрута ${route.id}`)}>
                                            <Play size={14} /> Запустить
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Прогресс и статистика */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px 200px', gap: '16px', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                                        <span>Доставлено: {route.completed} из {route.orders}</span>
                                        <span style={{ fontWeight: 'bold' }}>{Math.round(progress)}%</span>
                                    </div>
                                    <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: progress === 100 ? '#10b981' : '#3b82f6',
                                            borderRadius: '4px'
                                        }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold' }}>{route.distance} км</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveryroutes.distantsiya', 'Дистанция')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold' }}>{route.estimated_time} мин</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveryroutes.raschyotnoe_vremya', 'Расчётное время')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: route.actual_time <= route.estimated_time ? '#10b981' : '#ef4444' }}>
                                        {route.actual_time > 0 ? `${route.actual_time} мин` : '-'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveryroutes.fakticheskoe', 'Фактическое')}</div>
                                </div>
                            </div>

                            {/* Остановки (для активного маршрута) */}
                            {route.status === 'active' && route.stops.length > 0 && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>{t('deliveryroutes.ostanovki', '📍 Остановки:')}</div>
                                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                                        {route.stops.map((stop, idx) => {
                                            const stopInfo = getStopStatusInfo(stop.status);
                                            const StopIcon = stopInfo.icon;

                                            return (
                                                <div key={idx} style={{
                                                    minWidth: '150px',
                                                    padding: '12px',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: '8px',
                                                    borderLeft: `3px solid ${stopInfo.color}`
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                        <StopIcon size={14} color={stopInfo.color} />
                                                        <span style={{ fontSize: '12px', color: stopInfo.color }}>{stopInfo.label}</span>
                                                    </div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>#{stop.order}</div>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>{stop.address}</div>
                                                    {stop.time && <div style={{ fontSize: '11px', color: '#10b981' }}>{stop.time}</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    padding: '12px 20px', borderRadius: '8px',
                    background: message.type === 'success' ? '#10b981' : message.type === 'error' ? '#ef4444' : '#3b82f6',
                    color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    {message.text}
                </div>
            )}

            {/* Модальное окно создания маршрута */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h2>{t('deliveryroutes.novyy_marshrut_dostavki', '🚚 Новый маршрут доставки')}</h2>
                        <div className="form-group">
                            <label>{t('deliveryroutes.nazvanie_marshruta', 'Название маршрута *')}</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newRoute.name}
                                onChange={e => setNewRoute({ ...newRoute, name: e.target.value })}
                                placeholder="Например: Юнусабад - Чиланзар"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('deliveryroutes.kurer', 'Курьер *')}</label>
                            <input
                                type="text"
                                className="form-input"
                                value={newRoute.courier}
                                onChange={e => setNewRoute({ ...newRoute, courier: e.target.value })}
                                placeholder="ФИО курьера"
                            />
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                Отмена
                            </button>
                            <button className="btn btn-primary" onClick={handleCreateRoute}>
                                <Plus size={16} /> Создать маршрут
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeliveryRoutes;
