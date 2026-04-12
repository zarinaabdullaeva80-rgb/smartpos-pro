import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit, Trash2, DollarSign, Clock, Truck, Check, Search } from 'lucide-react';
import { deliveriesAPI } from '../services/api';
import { useI18n } from '../i18n';

function DeliveryZones() {
    const { t } = useI18n();
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await deliveriesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('DeliveryZones.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('DeliveryZones: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const [message, setMessage] = useState(null);
    const handleAddZone = () => setMessage({ type: 'info', text: 'Добавление новой зоны доставки...' });

    return (
        <div className="delivery-zones-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('deliveryzones.zony_dostavki', '🗺️ Зоны доставки')}</h1>
                    <p className="text-muted">{t('deliveryzones.tarify_po_rayonam', 'Тарифы по районам')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddZone}>
                    <Plus size={18} /> Добавить зону
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Карта зон */}
                <div className="card" style={{
                    minHeight: '500px',
                    background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    padding: '20px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <MapPin size={64} color="#3b82f6" style={{ marginBottom: '16px' }} />
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{t('deliveryzones.karta_zon_dostavki', 'Карта зон доставки')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>{t('deliveryzones.vizualizatsiya_zon_na_karte', 'Визуализация зон на карте')}</div>
                    </div>

                    {/* Заглушки зон */}
                    {zones.filter(z => z.active).map((zone, idx) => (
                        <div
                            key={zone.id}
                            onClick={() => setSelectedZone(zone)}
                            style={{
                                position: 'absolute',
                                top: `${100 + idx * 60}px`,
                                left: `${50 + idx * 80}px`,
                                width: '120px',
                                height: '80px',
                                background: `${zone.color}20`,
                                border: `2px solid ${zone.color}`,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                color: zone.color
                            }}
                        >
                            {zone.name}
                        </div>
                    ))}
                </div>

                {/* Список зон */}
                <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('deliveryzones.zony_i_tarify', '📋 Зоны и тарифы')}</h3>
                        </div>
                        <div>
                            {zones.map(zone => (
                                <div
                                    key={zone.id}
                                    onClick={() => setSelectedZone(zone)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedZone?.id === zone.id ? 'var(--primary-light)' : 'transparent',
                                        opacity: zone.active ? 1 : 0.5
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '12px', height: '12px',
                                                borderRadius: '50%',
                                                background: zone.color
                                            }} />
                                            <span style={{ fontWeight: 'bold' }}>{zone.name}</span>
                                            {!zone.active && (
                                                <span style={{ fontSize: '11px', color: '#888', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Неактивна
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-sm btn-secondary" style={{ padding: '4px 8px' }}>
                                                <Edit size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                        {zone.areas.join(', ')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <DollarSign size={12} color="#10b981" />
                                            {formatCurrency(zone.price)}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} color="#f59e0b" />
                                            {zone.time}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Детали зоны */}
                    {selectedZone && (
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '48px', height: '48px',
                                    borderRadius: '12px',
                                    background: `${selectedZone.color}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MapPin size={24} color={selectedZone.color} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>{selectedZone.name}</h3>
                                    <div style={{ color: '#888', fontSize: '13px' }}>{selectedZone.areas.join(', ')}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span>{t('deliveryzones.stoimost_dostavki', 'Стоимость доставки:')}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(selectedZone.price)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span>{t('deliveryzones.besplatno_ot', 'Бесплатно от:')}</span>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(selectedZone.free_from)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span>{t('deliveryzones.vremya_dostavki', 'Время доставки:')}</span>
                                    <span style={{ fontWeight: 'bold' }}>{selectedZone.time}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span>{t('deliveryzones.status', 'Статус:')}</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: selectedZone.active ? '#10b981' : '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {selectedZone.active ? <><Check size={14} /> {t('deliveryzones.aktivna', 'Активна')}</> : 'Неактивна'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DeliveryZones;
