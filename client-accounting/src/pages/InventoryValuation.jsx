import React, { useState, useEffect } from 'react';
import { Package, DollarSign, TrendingUp, TrendingDown, Calendar, Download, BarChart3 } from 'lucide-react';
import { inventoryAPI } from '../services/api';
import { useI18n } from '../i18n';

function InventoryValuation() {
    const { t } = useI18n();
    const [data, setData] = useState({});
    const [method, setMethod] = useState('fifo');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [method]);

    const loadData = async () => {
        try {
            const apiRes = await inventoryAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setData(apiData.data || {});
        } catch (err) {
            console.warn('InventoryValuation: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    return (
        <div className="inventory-valuation-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('inventoryvaluation.otsenka_zapasov', '📦 Оценка запасов')}</h1>
                    <p className="text-muted">{t('inventoryvaluation.stoimost_tovarnyh_zapasov', 'Стоимость товарных запасов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="fifo">FIFO</option>
                        <option value="lifo">LIFO</option>
                        <option value="avg">{t('inventoryvaluation.srednyaya_stoimost', 'Средняя стоимость')}</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => {
                        // Экспорт в CSV
                        const headers = ['Товар', 'Количество', 'Средняя цена', 'Стоимость'];
                        const rows = data.top_items?.map(item => [
                            item.name,
                            item.qty,
                            item.avg_cost,
                            item.value
                        ]) || [];

                        const csvContent = [
                            `Оценка запасов (${method.toUpperCase()})`,
                            `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
                            `Общая стоимость: ${data.total_value}`,
                            '',
                            headers.join(','),
                            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');

                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `inventory_valuation_${method}_${new Date().toISOString().split('T')[0]}.csv`;
                        link.click();
                    }}>
                        <Download size={18} /> Экспорт
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div className="card" style={{
                marginBottom: '20px',
                padding: '24px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('inventoryvaluation.obschaya_stoimost_zapasov', 'Общая стоимость запасов')}</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '8px' }}>
                            {formatCurrency(data.total_value)}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
                            {data.total_items} позиций • {data.total_units} единиц
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('inventoryvaluation.metod_otsenki', 'Метод оценки')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
                            {method.toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* По категориям */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('inventoryvaluation.po_kategoriyam', '📊 По категориям')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('inventoryvaluation.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div style={{ padding: '16px' }}>
                            {data.categories?.map((cat, idx) => (
                                <div key={idx} style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                        <span style={{ fontWeight: 'bold' }}>{formatCurrency(cat.value)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            flex: 1,
                                            height: '8px',
                                            background: '#e5e7eb',
                                            borderRadius: '4px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${cat.share}%`,
                                                height: '100%',
                                                background: `hsl(${260 - idx * 30}, 70%, 50%)`,
                                                borderRadius: '4px'
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '13px', color: '#888', minWidth: '40px' }}>{cat.share}%</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                        {cat.items} позиций • {cat.units} единиц
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Топ товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('inventoryvaluation.top_po_stoimosti', '🏆 Топ по стоимости')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('inventoryvaluation.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('inventoryvaluation.tovar', 'Товар')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('inventoryvaluation.kol_vo', 'Кол-во')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('inventoryvaluation.sr_tsena', 'Ср. цена')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('inventoryvaluation.stoimost', 'Стоимость')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.top_items?.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    width: '24px', height: '24px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary-light)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    color: 'var(--primary)'
                                                }}>
                                                    {idx + 1}
                                                </span>
                                                <span style={{ fontWeight: 500 }}>{item.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{item.qty}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px' }}>
                                            {formatCurrency(item.avg_cost)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(item.value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InventoryValuation;
