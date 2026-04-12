import React, { useState, useEffect } from 'react';
import { MapPin, Clock, DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function SalesHeatmap() {
    const { t } = useI18n();
    const [data, setData] = useState({});
    const [view, setView] = useState('hourly');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [view]);

    const loadData = async () => {
        try {
            const apiRes = await analyticsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setData(apiData.data || {});
        } catch (err) {
            console.warn('SalesHeatmap: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getHeatColor = (value) => {
        if (value >= 80) return '#10b981';
        if (value >= 60) return '#22c55e';
        if (value >= 40) return '#fbbf24';
        if (value >= 20) return '#f97316';
        return '#ef4444';
    };

    const getHeatBg = (value) => {
        const opacity = Math.min(value / 100, 1);
        if (value >= 60) return `rgba(16, 185, 129, ${opacity})`;
        if (value >= 40) return `rgba(251, 191, 36, ${opacity})`;
        return `rgba(239, 68, 68, ${opacity})`;
    };

    return (
        <div className="sales-heatmap-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('salesheatmap.teplovaya_karta_prodazh', '🔥 Тепловая карта продаж')}</h1>
                    <p className="text-muted">{t('salesheatmap.analiz_aktivnosti_prodazh_po_vremeni', 'Анализ активности продаж по времени')}</p>
                </div>
                <select value={view} onChange={(e) => setView(e.target.value)}>
                    <option value="hourly">{t('salesheatmap.po_chasam', 'По часам')}</option>
                    <option value="daily">{t('salesheatmap.po_dnyam', 'По дням')}</option>
                    <option value="monthly">{t('salesheatmap.po_mesyatsam', 'По месяцам')}</option>
                </select>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                        <TrendingUp size={16} style={{ marginRight: '4px' }} />
                        Пик продаж
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>{data.peak_time}</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>{formatCurrency(data.peak_sales)}</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                        <Clock size={16} style={{ marginRight: '4px' }} />
                        Минимум продаж
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#ef4444' }}>{data.low_time}</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                        <DollarSign size={16} style={{ marginRight: '4px' }} />
                        Средняя за час
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{formatCurrency(data.avg_per_hour)}</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>
                        <Users size={16} style={{ marginRight: '4px' }} />
                        Лучший день
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{t('salesheatmap.subbota', 'Суббота')}</div>
                </div>
            </div>

            {/* Тепловая карта */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('salesheatmap.karta_aktivnosti', '📊 Карта активности')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('salesheatmap.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ padding: '20px', overflow: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(12, 1fr)', gap: '4px' }}>
                            {/* Заголовок часов */}
                            <div></div>
                            {data.hours?.map(hour => (
                                <div key={hour} style={{
                                    textAlign: 'center',
                                    fontSize: '12px',
                                    color: '#888',
                                    padding: '8px 0'
                                }}>
                                    {hour}:00
                                </div>
                            ))}

                            {/* Строки по дням */}
                            {data.days?.map((day, dayIdx) => (
                                <React.Fragment key={day}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: dayIdx >= 5 ? '#3b82f6' : 'inherit'
                                    }}>
                                        {day}
                                    </div>
                                    {data.hours?.map((hour, hourIdx) => {
                                        const cell = data.hourly?.find(h => h.dayIdx === dayIdx && h.hourIdx === hourIdx);
                                        const value = cell?.value || 0;

                                        return (
                                            <div
                                                key={`${day}-${hour}`}
                                                style={{
                                                    background: getHeatBg(value),
                                                    borderRadius: '4px',
                                                    padding: '12px',
                                                    textAlign: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    color: value > 50 ? 'white' : '#333',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.2s'
                                                }}
                                                title={`${day} ${hour}:00 - ${value}%`}
                                            >
                                                {value}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Легенда */}
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666' }}>
                <span>{t('salesheatmap.aktivnost', 'Активность:')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '24px', height: '16px', background: 'rgba(239, 68, 68, 0.3)', borderRadius: '2px' }} />
                    <span>{t('salesheatmap.nizkaya', 'Низкая')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '24px', height: '16px', background: 'rgba(251, 191, 36, 0.6)', borderRadius: '2px' }} />
                    <span>{t('salesheatmap.srednyaya', 'Средняя')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '24px', height: '16px', background: 'rgba(16, 185, 129, 0.9)', borderRadius: '2px' }} />
                    <span>{t('salesheatmap.vysokaya', 'Высокая')}</span>
                </div>
            </div>
        </div>
    );
}

export default SalesHeatmap;
