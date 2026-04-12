import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Download, Building, Wallet, CreditCard } from 'lucide-react';
import { financeAPI,  analyticsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function BalanceSheet() {
    const { t } = useI18n();
    const toast = useToast();
    const [data, setData] = useState({});
    const [period, setPeriod] = useState('2026-01');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setData(apiData.data || {});
            setData(apiData.data || {});
        } catch (err) {
            console.warn('BalanceSheet: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const renderSection = (section, isAsset) => (
        <div key={section.name} style={{ marginBottom: '20px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: isAsset ? '#dcfce7' : '#fee2e2',
                borderRadius: '8px',
                fontWeight: 'bold',
                marginBottom: '8px'
            }}>
                <span>{section.name}</span>
                <span>{formatCurrency(section.total)}</span>
            </div>
            {section.items.map((item, idx) => (
                <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <div>
                        <span style={{
                            color: '#888',
                            fontSize: '12px',
                            marginRight: '8px'
                        }}>
                            {item.account}
                        </span>
                        {item.name}
                    </div>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(item.amount)}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="balance-sheet-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('balancesheet.balans_predpriyatiya', '📊 Баланс предприятия')}</h1>
                    <p className="text-muted">Бухгалтерский баланс на {data.date}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                    <button className="btn btn-primary" onClick={() => toast.info('Экспорт баланса...')}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* Итого */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Wallet size={32} />
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('balancesheet.aktivy', 'Активы')}</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(data.assets?.total)}</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CreditCard size={32} />
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('balancesheet.passivy', 'Пассивы')}</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(data.liabilities?.total)}</div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{
                    padding: '24px',
                    background: data.assets?.total === data.liabilities?.total
                        ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Building size={32} />
                        <div>
                            <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('balancesheet.balans', 'Баланс')}</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {data.assets?.total === data.liabilities?.total ? '✓ Сходится' : '⚠ Расхождение'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Баланс */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>{t('balancesheet.zagruzka', 'Загрузка...')}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Активы */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={20} /> АКТИВЫ
                        </h3>
                        {data.assets?.sections.map(section => renderSection(section, true))}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '16px',
                            background: '#10b981',
                            color: 'white',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>
                            <span>{t('balancesheet.itogo_aktivy', 'ИТОГО АКТИВЫ')}</span>
                            <span>{formatCurrency(data.assets?.total)}</span>
                        </div>
                    </div>

                    {/* Пассивы */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingDown size={20} /> ПАССИВЫ
                        </h3>
                        {data.liabilities?.sections.map(section => renderSection(section, false))}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '16px',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>
                            <span>{t('balancesheet.itogo_passivy', 'ИТОГО ПАССИВЫ')}</span>
                            <span>{formatCurrency(data.liabilities?.total)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BalanceSheet;
