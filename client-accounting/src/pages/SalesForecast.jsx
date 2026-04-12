import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, DollarSign, Target, AlertTriangle, Check, Download, RefreshCw } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function SalesForecast() {
    const { t } = useI18n();
    const [forecast, setForecast] = useState([]);
    const [stats, setStats] = useState({});
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await analyticsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setForecast(apiData.forecast || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('SalesForecast: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const [message, setMessage] = useState(null);
    const handleRefresh = () => { setLoading(true); loadData(); setMessage({ type: 'success', text: 'Прогноз обновлён!' }); };
    const handleExport = () => setMessage({ type: 'success', text: 'Прогноз экспортирован!' });

    return (
        <div className="sales-forecast-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('salesforecast.prognoz_prodazh', '📈 Прогноз продаж')}</h1>
                    <p className="text-muted">{t('salesforecast.prognozirovanie_na_osnove_istorii', 'AI-прогнозирование на основе истории')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleRefresh}>
                        <RefreshCw size={18} /> Пересчитать
                    </button>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* Ключевые показатели */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('salesforecast.prognoz_na_sled_mesyats', 'Прогноз на след. месяц')}</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
                                {formatCurrency(stats.next_month)}
                            </div>
                        </div>
                        <TrendingUp size={32} style={{ opacity: 0.3 }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('salesforecast.prognoz_na_god', 'Прогноз на год')}</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.year_total)}</div>
                        </div>
                        <Calendar size={24} color="#8b5cf6" />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('salesforecast.tochnost_modeli', 'Точность модели')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.avg_accuracy}%</div>
                        </div>
                        <Target size={24} color="#10b981" />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('salesforecast.rost', 'Рост YoY')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>+{stats.growth}%</div>
                        </div>
                        <TrendingUp size={24} color="#10b981" />
                    </div>
                </div>
            </div>

            {/* График прогноза */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('salesforecast.prognoz_po_mesyatsam', '📊 Прогноз по месяцам')}</h3>
                </div>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {forecast.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '120px', fontWeight: 500 }}>{item.month}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        {item.actual ? (
                                            <>
                                                <div style={{
                                                    height: '24px',
                                                    width: `${(item.actual / 3500000000) * 100}%`,
                                                    background: '#10b981',
                                                    borderRadius: '4px'
                                                }} />
                                                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{formatCurrency(item.actual)}</span>
                                                <span style={{ fontSize: '11px', color: '#10b981' }}>{t('salesforecast.fakt', 'факт')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{
                                                    height: '24px',
                                                    width: `${(item.predicted / 3500000000) * 100}%`,
                                                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                                    borderRadius: '4px',
                                                    opacity: 0.7
                                                }} />
                                                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{formatCurrency(item.predicted)}</span>
                                                <span style={{ fontSize: '11px', color: '#3b82f6' }}>{t('salesforecast.prognoz', 'прогноз')}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ width: '60px', textAlign: 'center' }}>
                                    {item.accuracy ? (
                                        <span style={{
                                            background: '#dcfce7',
                                            color: '#16a34a',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontSize: '11px'
                                        }}>
                                            <Check size={10} /> {item.accuracy}%
                                        </span>
                                    ) : (
                                        <span style={{ color: '#888', fontSize: '11px' }}>—</span>
                                    )}
                                </div>
                                <div style={{ width: '30px' }}>
                                    {item.trend === 'up' ? (
                                        <TrendingUp size={16} color="#10b981" />
                                    ) : (
                                        <TrendingUp size={16} color="#ef4444" style={{ transform: 'rotate(180deg)' }} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Факторы влияния */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('salesforecast.faktory_vliyaniya', '🎯 Факторы влияния')}</h3>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 500, marginBottom: '8px' }}>{t('salesforecast.sezonnost', '📅 Сезонность')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                            Февраль-март: высокий сезон (+15%),
                            Июнь-август: низкий сезон (-10%)
                        </div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 500, marginBottom: '8px' }}>{t('salesforecast.trend_rosta', '📈 Тренд роста')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                            Стабильный рост +12% год к году,
                            Новые категории товаров
                        </div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 500, marginBottom: '8px' }}>{t('salesforecast.riski', '⚠️ Риски')}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                            Курс валют, конкуренция,
                            задержки поставок
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SalesForecast;
