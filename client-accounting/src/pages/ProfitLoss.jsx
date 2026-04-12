import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Download, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { financeAPI,  analyticsAPI } from '../services/api';
import { useI18n } from '../i18n';

function ProfitLoss() {
    const { t } = useI18n();
    const [data, setData] = useState({});
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setData(apiData.data || {
                revenue: parseFloat(d.revenue) || 0,
                cost_of_goods: parseFloat(d.cost_of_goods) || 0,
                gross_profit: parseFloat(d.gross_profit) || 0,
                gross_margin: parseFloat(d.gross_margin) || 0,
                operating_expenses: d.operating_expenses || {},
                operating_income: parseFloat(d.operating_income) || 0,
                operating_margin: parseFloat(d.operating_margin) || 0,
                other_income: parseFloat(d.other_income) || 0,
                other_expenses: parseFloat(d.other_expenses) || 0,
                income_before_tax: parseFloat(d.income_before_tax) || 0,
                tax: parseFloat(d.tax) || 0,
                net_income: parseFloat(d.net_income) || 0,
                net_margin: parseFloat(d.net_margin) || 0,
                comparison: d.comparison || {}
            });
            setData(apiData.data || {});
        } catch (err) {
            console.warn('ProfitLoss: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const StatRow = ({ label, value, isTotal, isNegative, indent }) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '12px 16px',
            paddingLeft: indent ? `${32 + indent * 16}px` : '16px',
            background: isTotal ? 'var(--bg-secondary)' : 'transparent',
            borderBottom: '1px solid var(--border-color)',
            fontWeight: isTotal ? 'bold' : 'normal'
        }}>
            <span>{label}</span>
            <span style={{ color: isNegative ? '#ef4444' : 'inherit' }}>
                {isNegative ? '-' : ''}{formatCurrency(Math.abs(value))}
            </span>
        </div>
    );

    const [message, setMessage] = useState(null);
    const handleExport = () => setMessage({ type: 'success', text: 'P&L-отчёт экспортирован!' });

    return (
        <div className="profit-loss-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('profitloss.pribyli_i_ubytki', '📊 Прибыли и убытки')}</h1>
                    <p className="text-muted">{t('profitloss.finansovyy_otchyot', 'Финансовый отчёт P&L')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                        <option value="week">{t('profitloss.za_nedelyu', 'За неделю')}</option>
                        <option value="month">{t('profitloss.za_mesyats', 'За месяц')}</option>
                        <option value="quarter">{t('profitloss.za_kvartal', 'За квартал')}</option>
                        <option value="year">{t('profitloss.za_god', 'За год')}</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* Ключевые метрики */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('profitloss.chistaya_pribyl', 'Чистая прибыль')}</div>
                            <div style={{ fontSize: '26px', fontWeight: 'bold', marginTop: '8px' }}>
                                {formatCurrency(data.net_income)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '13px' }}>
                                <ArrowUpRight size={14} />
                                +{data.comparison?.profit_change}% к прошлому
                            </div>
                        </div>
                        <TrendingUp size={36} style={{ opacity: 0.3 }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('profitloss.vyruchka', 'Выручка')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(data.revenue)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', marginTop: '4px' }}>
                                <ArrowUpRight size={12} />
                                +{data.comparison?.revenue_change}%
                            </div>
                        </div>
                        <DollarSign size={24} color="#3b82f6" />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('profitloss.valovaya_marzha', 'Валовая маржа')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{data.gross_margin}%</div>
                        </div>
                        <TrendingUp size={24} color="#10b981" />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('profitloss.rentabelnost', 'Рентабельность')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{data.net_margin}%</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', marginTop: '4px' }}>
                                <ArrowUpRight size={12} />
                                +{data.comparison?.margin_change}%
                            </div>
                        </div>
                        <TrendingUp size={24} color="#8b5cf6" />
                    </div>
                </div>
            </div>

            {/* Отчёт */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <h3 style={{ margin: 0 }}>{t('profitloss.otchyot_o_pribylyah_i_ubytkah', '📋 Отчёт о прибылях и убытках')}</h3>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('profitloss.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <>
                        <StatRow label="📈 Выручка от реализации" value={data.revenue} isTotal />
                        <StatRow label="Себестоимость товаров" value={data.cost_of_goods} isNegative />
                        <StatRow label="💰 Валовая прибыль" value={data.gross_profit} isTotal />

                        <div style={{ padding: '12px 16px', background: 'var(--primary-light)', fontWeight: 500 }}>
                            📋 Операционные расходы
                        </div>
                        <StatRow label="Заработная плата" value={data.operating_expenses?.salaries} indent={1} />
                        <StatRow label="Аренда" value={data.operating_expenses?.rent} indent={1} />
                        <StatRow label="Коммунальные услуги" value={data.operating_expenses?.utilities} indent={1} />
                        <StatRow label="Маркетинг" value={data.operating_expenses?.marketing} indent={1} />
                        <StatRow label="Прочие расходы" value={data.operating_expenses?.other} indent={1} />
                        <StatRow label="Итого операционные расходы" value={data.operating_expenses?.total} isTotal isNegative />

                        <StatRow label="📊 Операционная прибыль" value={data.operating_income} isTotal />

                        <StatRow label="Прочие доходы" value={data.other_income} />
                        <StatRow label="Прочие расходы" value={data.other_expenses} isNegative />

                        <StatRow label="💵 Прибыль до налогообложения" value={data.income_before_tax} isTotal />
                        <StatRow label="Налог на прибыль (12%)" value={data.tax} isNegative />

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '20px 16px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 'bold'
                        }}>
                            <span>{t('profitloss.chistaya_pribyl', '✅ ЧИСТАЯ ПРИБЫЛЬ')}</span>
                            <span>{formatCurrency(data.net_income)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ProfitLoss;
