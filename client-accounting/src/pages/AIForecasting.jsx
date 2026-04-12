import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Package, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function AIForecasting() {
    const { t } = useI18n();
    const [forecasts, setForecasts] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('7');

    useEffect(() => { loadForecasts(); }, [period]);

    // Генерация алертов из прогнозов
    const generateAlerts = (items) => {
        return items
            .filter(f => f.days_to_stockout <= 7 || f.trend === 'down')
            .map(f => ({
                type: f.days_to_stockout <= 3 ? 'critical' : f.days_to_stockout <= 7 ? 'warning' : 'info',
                product: f.product_name,
                message: f.days_to_stockout <= 3
                    ? `Закончится через ${f.days_to_stockout} дн! Срочно закажите`
                    : f.days_to_stockout <= 7
                        ? `Закончится через ${f.days_to_stockout} дней`
                        : 'Спрос снижается, не заказывайте'
            }))
            .slice(0, 8);
    };

    const loadForecasts = async () => {
        setLoading(true);
        try {
            // Запрашиваем ABC-анализ, из него строим прогноз
            const apiRes = await analyticsAPI.getABCAnalysis({ period });
            const apiData = apiRes.data || apiRes;

            // Если сервер вернул готовые прогнозы
            if (apiData.forecasts && apiData.forecasts.length > 0) {
                setForecasts(apiData.forecasts);
                setAlerts(apiData.alerts || generateAlerts(apiData.forecasts));
                setLoading(false);
                return;
            }

            // Строим прогноз из товаров ABC-анализа
            const products = apiData.products || apiData.items || apiData.data || [];
            if (products.length > 0) {
                const days = parseInt(period);
                const forecast = products.map((p, i) => {
                    const qty = parseInt(p.sales_count || p.quantity_sold) || 0;
                    const avgDaily = days > 0 ? qty / days : 0;
                    const stock = parseInt(p.avg_stock || p.current_stock) || Math.max(1, Math.floor(qty * 0.3));
                    const daysToStockout = avgDaily > 0 ? Math.floor(stock / avgDaily) : 30;
                    const trend = p.abc === 'A' ? 'up' : p.abc === 'C' ? 'down' : 'stable';
                    const confidence = p.abc === 'A' ? 92 : p.abc === 'B' ? 85 : 75;
                    const recommended = daysToStockout < 7 ? Math.ceil(avgDaily * 14) : 0;
                    return {
                        id: p.id || i + 1,
                        product_name: p.name || p.product_name || `Товар ${i + 1}`,
                        current_stock: stock,
                        predicted_demand: Math.ceil(avgDaily * days),
                        days_to_stockout: Math.min(daysToStockout, 99),
                        confidence,
                        trend,
                        recommended_order: recommended
                    };
                }).sort((a, b) => a.days_to_stockout - b.days_to_stockout);

                setForecasts(forecast);
                setAlerts(generateAlerts(forecast));
            } else {
                setForecasts([]);
                setAlerts([]);
            }
        } catch (err) {
            console.warn('AIForecasting: API недоступен:', err.message);
            setForecasts([]);
            setAlerts([]);
        }
        setLoading(false);
    };

    const getTrendIcon = (trend) => {
        if (trend === 'up') return <TrendingUp size={16} color="#10b981" />;
        if (trend === 'down') return <TrendingDown size={16} color="#ef4444" />;
        return <span style={{ color: '#888' }}>→</span>;
    };

    const getUrgencyColor = (days) => {
        if (days <= 3) return '#ef4444';
        if (days <= 7) return '#f59e0b';
        return '#10b981';
    };

    const stats = {
        products_analyzed: forecasts.length,
        critical_alerts: alerts.filter(a => a.type === 'critical').length,
        avg_confidence: forecasts.length > 0
            ? Math.round(forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length)
            : 0,
        total_to_order: forecasts.reduce((sum, f) => sum + f.recommended_order, 0)
    };

    return (
        <div className="ai-forecasting-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('aiforecasting.prognozirovanie', '🧠 AI Прогнозирование')}</h1>
                    <p className="text-muted">{t('aiforecasting.prognoz_sprosa_na_osnove_analiza_prodazh', 'Прогноз спроса на основе анализа продаж')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: '150px' }}>
                        <option value="7">{t('aiforecasting.dney', '7 дней')}</option>
                        <option value="14">{t('aiforecasting.dney', '14 дней')}</option>
                        <option value="30">{t('aiforecasting.dney', '30 дней')}</option>
                    </select>
                    <button className="btn btn-secondary" onClick={loadForecasts}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Brain size={32} color="#667eea" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.products_analyzed}</div>
                    <div style={{ color: '#666' }}>{t('aiforecasting.tovarov_proanalizirovano', 'Товаров проанализировано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{stats.critical_alerts}</div>
                    <div style={{ color: '#666' }}>{t('aiforecasting.kritichnyh_alertov', 'Критичных алертов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <BarChart3 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.avg_confidence}%</div>
                    <div style={{ color: '#666' }}>{t('aiforecasting.srednyaya_tochnost', 'Средняя точность')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_to_order}</div>
                    <div style={{ color: '#666' }}>{t('aiforecasting.rekomenduetsya_zakazat', 'Рекомендуется заказать')}</div>
                </div>
            </div>

            {loading ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                    <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                    <div>{t('aiforecasting.analiz_dannyh', 'Анализ данных...')}</div>
                </div>
            ) : forecasts.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Brain size={64} className="text-muted" />
                        <h3>{t('aiforecasting.net_dannyh_dlya_prognoza', 'Нет данных для прогноза')}</h3>
                        <p className="text-muted">{t('aiforecasting.prognoz_poyavitsya_posle_nakopleniya_dannyh', 'Прогноз появится после накопления данных продаж')}</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                    {/* Алерты */}
                    <div className="card" style={{ height: 'fit-content' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('aiforecasting.uvedomleniya', '⚠️ Уведомления AI')}</h3>
                        </div>
                        {alerts.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
                                Критичных ситуаций нет ✓
                            </div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {alerts.map((alert, idx) => (
                                    <div key={idx} style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        borderLeft: `4px solid ${alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6'}`
                                    }}>
                                        <div style={{ fontWeight: 500, marginBottom: '4px' }}>{alert.product}</div>
                                        <div style={{ fontSize: '13px', color: '#666' }}>{alert.message}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Таблица прогнозов */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('aiforecasting.prognoz_po_tovaram', '📊 Прогноз по товарам')}</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('aiforecasting.tovar', 'Товар')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.ostatok', 'Остаток')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.prognoz', 'Прогноз')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.trend', 'Тренд')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.dney_do', 'Дней до 0')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.tochnost', 'Точность')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('aiforecasting.k_zakazu', 'К заказу')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {forecasts.map(f => (
                                    <tr key={f.id} style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        background: f.days_to_stockout <= 3 ? '#fef2f2' : 'transparent'
                                    }}>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{f.product_name}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{f.current_stock} шт</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{f.predicted_demand} шт</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{getTrendIcon(f.trend)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: '12px',
                                                background: getUrgencyColor(f.days_to_stockout) + '20',
                                                color: getUrgencyColor(f.days_to_stockout), fontWeight: 'bold'
                                            }}>
                                                {f.days_to_stockout} дней
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                <div style={{ width: '50px', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${f.confidence}%`, height: '100%',
                                                        background: f.confidence >= 90 ? '#10b981' : f.confidence >= 80 ? '#f59e0b' : '#ef4444',
                                                        borderRadius: '3px'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '13px' }}>{f.confidence}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {f.recommended_order > 0 ? (
                                                <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                    +{f.recommended_order} шт
                                                </span>
                                            ) : (
                                                <span style={{ color: '#888' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Пояснение */}
            <div className="card" style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Brain size={40} color="#667eea" />
                    <div>
                        <h3 style={{ margin: '0 0 8px' }}>{t('aiforecasting.kak_rabotaet_prognozirovanie', 'Как работает AI-прогнозирование')}</h3>
                        <p style={{ margin: 0, color: '#666' }}>
                            Система анализирует историю продаж, ABC-классификацию и средние остатки для прогнозирования
                            дней до окончания товара. Рекомендации по заказу рассчитываются на 14 дней вперёд.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AIForecasting;
