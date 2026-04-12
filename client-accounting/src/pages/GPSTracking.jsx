import React, { useState, useEffect } from 'react';
import { MapPin, Truck, Phone, Clock, Navigation, RefreshCw, Battery, Signal } from 'lucide-react';
import { deliveriesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function GPSTracking() {
    const { t } = useI18n();
    const toast = useToast();
    const [couriers, setCouriers] = useState([]);
    const [selectedCourier, setSelectedCourier] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await deliveriesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('GPSTracking.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('GPSTracking: не удалось загрузить данные', err.message);
        }

        setSelectedCourier(couriers[0] || null);
        setLoading(false);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            idle: { label: 'На базе', color: '#888', bg: '#f3f4f6' },
            delivering: { label: 'Доставляет', color: '#3b82f6', bg: '#dbeafe' },
            returning: { label: 'Возвращается', color: '#f59e0b', bg: '#fef3c7' },
            offline: { label: 'Офлайн', color: '#ef4444', bg: '#fee2e2' }
        };
        return statuses[status] || statuses.offline;
    };

    const getSignalColor = (signal) => {
        const colors = { strong: '#10b981', medium: '#f59e0b', weak: '#ef4444' };
        return colors[signal] || colors.weak;
    };

    const getBatteryColor = (battery) => {
        if (battery > 50) return '#10b981';
        if (battery > 20) return '#f59e0b';
        return '#ef4444';
    };

    const [message, setMessage] = useState(null);
    const handleRefresh = () => setMessage({ type: 'info', text: 'Обновление данных GPS...' });

    return (
        <div className="gps-tracking-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('gpstracking.treking_kurerov', '📍 GPS-трекинг курьеров')}</h1>
                    <p className="text-muted">{t('gpstracking.otslezhivanie_v_realnom_vremeni', 'Отслеживание в реальном времени')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleRefresh}>
                    <RefreshCw size={18} /> Обновить
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список курьеров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>🚗 Курьеры онлайн ({couriers.length})</h3>
                    </div>
                    <div>
                        {couriers.map(courier => {
                            const statusInfo = getStatusInfo(courier.status);

                            return (
                                <div
                                    key={courier.id}
                                    onClick={() => setSelectedCourier(courier)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedCourier?.id === courier.id ? 'var(--primary-light)' : 'transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{courier.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{courier.phone}</div>
                                        </div>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '2px 10px',
                                            borderRadius: '10px',
                                            fontSize: '11px'
                                        }}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Battery size={12} color={getBatteryColor(courier.battery)} />
                                            {courier.battery}%
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Signal size={12} color={getSignalColor(courier.signal)} />
                                            GPS
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            {courier.last_update}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Карта и детали */}
                <div>
                    {/* Карта (заглушка) */}
                    <div className="card" style={{
                        height: '350px',
                        marginBottom: '20px',
                        background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <MapPin size={64} color="#3b82f6" style={{ marginBottom: '16px' }} />
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{t('gpstracking.karta_tashkenta', 'Карта Ташкента')}</div>
                            <div style={{ fontSize: '13px', color: '#666' }}>{t('gpstracking.integratsiya_s', 'Интеграция с Google Maps / Yandex Maps')}</div>
                        </div>

                        {/* Маркеры курьеров */}
                        {couriers.map((courier, idx) => {
                            const statusInfo = getStatusInfo(courier.status);
                            return (
                                <div
                                    key={courier.id}
                                    style={{
                                        position: 'absolute',
                                        top: `${30 + idx * 80}px`,
                                        left: `${100 + idx * 150}px`,
                                        background: statusInfo.bg,
                                        border: `2px solid ${statusInfo.color}`,
                                        padding: '8px 12px',
                                        borderRadius: '20px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Truck size={14} color={statusInfo.color} />
                                    {courier.name.split(' ')[0]}
                                </div>
                            );
                        })}
                    </div>

                    {/* Детали курьера */}
                    {selectedCourier && (
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px' }}>{selectedCourier.name}</h3>
                                    <div style={{ color: '#888' }}>{selectedCourier.phone}</div>
                                </div>
                                <button className="btn btn-secondary" onClick={() => toast.info('Звонок курьеру...')}>
                                    <Phone size={16} /> Позвонить
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
                                    <MapPin size={20} color="#3b82f6" style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('gpstracking.tekuschaya_lokatsiya', 'Текущая локация')}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{selectedCourier.location.address}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
                                    <Navigation size={20} color="#10b981" style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('gpstracking.skorost', 'Скорость')}</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{selectedCourier.speed} км/ч</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
                                    <Truck size={20} color="#f59e0b" style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('gpstracking.marshrut', 'Маршрут')}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{selectedCourier.route || '-'}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', textAlign: 'center' }}>
                                    <Clock size={20} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('gpstracking.dostavleno_ostalos', 'Доставлено / Осталось')}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                        <span style={{ color: '#10b981' }}>{selectedCourier.completed}</span>
                                        {' / '}
                                        <span style={{ color: '#f59e0b' }}>{selectedCourier.remaining}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GPSTracking;
