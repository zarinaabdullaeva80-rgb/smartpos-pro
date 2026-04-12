import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Eye, ShoppingCart, CreditCard, ChevronRight, ArrowDownRight } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function ConversionFunnel() {
    const { t } = useI18n();
    const [data, setData] = useState({});
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await analyticsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setData(apiData.data || {});
        } catch (err) {
            console.warn('ConversionFunnel: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getConversionRate = (current, previous) => {
        if (!previous) return 100;
        return Math.round((current / previous) * 100);
    };

    return (
        <div className="conversion-funnel-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('conversionfunnel.voronka_konversiy', '📊 Воронка конверсий')}</h1>
                    <p className="text-muted">{t('conversionfunnel.analiz_puti_klienta_ot_vizita_do_pokupki', 'Анализ пути клиента от визита до покупки')}</p>
                </div>
                <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="week">{t('conversionfunnel.za_nedelyu', 'За неделю')}</option>
                    <option value="month">{t('conversionfunnel.za_mesyats', 'За месяц')}</option>
                    <option value="quarter">{t('conversionfunnel.za_kvartal', 'За квартал')}</option>
                </select>
            </div>

            {/* Ключевые метрики */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('conversionfunnel.obschaya_konversiya', 'Общая конверсия')}</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px' }}>
                        {data.overall_conversion}%
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('conversionfunnel.zakazov', 'Заказов')}</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{data.stages?.[4]?.count || 0}</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('conversionfunnel.sredniy_chek', 'Средний чек')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(data.avg_order_value)}</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ color: '#888', fontSize: '13px' }}>{t('conversionfunnel.problemnyy_etap', 'Проблемный этап')}</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444' }}>{data.top_drop_off}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>-{data.drop_off_rate}% конверсии</div>
                </div>
            </div>

            {/* Воронка */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 24px' }}>{t('conversionfunnel.etapy_voronki', '📈 Этапы воронки')}</h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>{t('conversionfunnel.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.stages?.map((stage, idx) => {
                            const prevCount = idx > 0 ? data.stages[idx - 1].count : stage.count;
                            const convRate = getConversionRate(stage.count, prevCount);
                            const widthPercent = (stage.count / data.stages[0].count) * 100;
                            const StageIcon = stage.icon;

                            return (
                                <div key={idx}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                        <div style={{
                                            width: '40px', height: '40px',
                                            borderRadius: '50%',
                                            background: `${stage.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <StageIcon size={20} color={stage.color} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{stage.name}</div>
                                            <div style={{ fontSize: '13px', color: '#888' }}>
                                                {stage.count.toLocaleString()} человек
                                            </div>
                                        </div>
                                        {idx > 0 && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: convRate >= 50 ? '#10b981' : convRate >= 30 ? '#f59e0b' : '#ef4444',
                                                fontWeight: 'bold'
                                            }}>
                                                <ArrowDownRight size={16} />
                                                {convRate}%
                                            </div>
                                        )}
                                    </div>
                                    <div style={{
                                        height: '32px',
                                        background: '#f3f4f6',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        marginBottom: idx < data.stages.length - 1 ? '8px' : 0
                                    }}>
                                        <div style={{
                                            width: `${widthPercent}%`,
                                            height: '100%',
                                            background: `linear-gradient(90deg, ${stage.color}, ${stage.color}80)`,
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            paddingLeft: '12px',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            fontSize: '13px',
                                            minWidth: '80px'
                                        }}>
                                            {Math.round(widthPercent)}%
                                        </div>
                                    </div>
                                    {idx < data.stages.length - 1 && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            color: '#888',
                                            fontSize: '12px',
                                            padding: '4px 0'
                                        }}>
                                            <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConversionFunnel;
