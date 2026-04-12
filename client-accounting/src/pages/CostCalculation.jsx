import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, Package, TrendingUp, TrendingDown, PieChart, Download } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CostCalculation() {
    const { t } = useI18n();
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAccounts();
            const apiData = apiRes.data || apiRes;
            console.log('CostCalculation.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('CostCalculation: не удалось загрузить данные', err.message);
        }

        setSelectedProduct(products[0] || null);
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const costItems = [
        { key: 'materials', label: 'Материалы', color: '#3b82f6', icon: Package },
        { key: 'labor', label: 'Труд', color: '#10b981', icon: TrendingUp },
        { key: 'overhead', label: 'Накладные', color: '#f59e0b', icon: TrendingDown },
        { key: 'packaging', label: 'Упаковка', color: '#8b5cf6', icon: Package }
    ];

    return (
        <div className="cost-calculation-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('costcalculation.kalkulyatsiya_sebestoimosti', '📊 Калькуляция себестоимости')}</h1>
                    <p className="text-muted">{t('costcalculation.raschyot_zatrat_na_proizvodstvo', 'Расчёт затрат на производство')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.info('Экспорт калькуляции...')}>
                    <Download size={18} /> Экспорт
                </button>
            </div>

            {/* Список продуктов */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {products.map(product => (
                    <div
                        key={product.id}
                        className="card"
                        onClick={() => setSelectedProduct(product)}
                        style={{
                            padding: '20px',
                            cursor: 'pointer',
                            border: selectedProduct?.id === product.id ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                        }}
                    >
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{product.name}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{product.sku}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#888' }}>{t('costcalculation.sebestoimost', 'Себестоимость:')}</span>
                            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{formatCurrency(product.cost_breakdown.total)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#888' }}>{t('costcalculation.tsena_prodazhi', 'Цена продажи:')}</span>
                            <span style={{ fontWeight: 'bold' }}>{formatCurrency(product.selling_price)}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px',
                            background: '#dcfce7',
                            borderRadius: '8px',
                            marginTop: '8px'
                        }}>
                            <span style={{ color: '#10b981' }}>{t('costcalculation.marzha', 'Маржа:')}</span>
                            <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                                {formatCurrency(product.margin)} ({product.margin_percent}%)
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Детальная калькуляция */}
            {selectedProduct && (
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px' }}>📋 Детальная калькуляция: {selectedProduct.name}</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                        {/* Структура затрат */}
                        <div>
                            <h4 style={{ margin: '0 0 16px' }}>{t('costcalculation.struktura_zatrat', 'Структура затрат')}</h4>
                            {costItems.map(item => {
                                const value = selectedProduct.cost_breakdown[item.key];
                                const percent = (value / selectedProduct.cost_breakdown.total) * 100;
                                const ItemIcon = item.icon;

                                return (
                                    <div key={item.key} style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ItemIcon size={16} color={item.color} />
                                                <span>{item.label}</span>
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 'bold' }}>{formatCurrency(value)}</span>
                                                <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>({percent.toFixed(1)}%)</span>
                                            </div>
                                        </div>
                                        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: item.color,
                                                borderRadius: '4px'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Итого */}
                            <div style={{
                                marginTop: '24px',
                                padding: '16px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 'bold' }}>{t('costcalculation.itogo_sebestoimost', 'Итого себестоимость:')}</span>
                                    <span style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '18px' }}>
                                        {formatCurrency(selectedProduct.cost_breakdown.total)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span>{t('costcalculation.tsena_prodazhi', 'Цена продажи:')}</span>
                                    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
                                        {formatCurrency(selectedProduct.selling_price)}
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '12px',
                                    borderTop: '2px solid var(--border-color)'
                                }}>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>{t('costcalculation.valovaya_pribyl', 'Валовая прибыль:')}</span>
                                    <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '18px' }}>
                                        {formatCurrency(selectedProduct.margin)} ({selectedProduct.margin_percent}%)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Диаграмма */}
                        <div style={{
                            padding: '20px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <h4 style={{ margin: '0 0 16px' }}>{t('costcalculation.struktura', '📊 Структура')}</h4>
                            <div style={{
                                width: '200px',
                                height: '200px',
                                borderRadius: '50%',
                                background: `conic-gradient(
                                    #3b82f6 0deg ${(selectedProduct.cost_breakdown.materials / selectedProduct.cost_breakdown.total) * 360}deg,
                                    #10b981 ${(selectedProduct.cost_breakdown.materials / selectedProduct.cost_breakdown.total) * 360}deg ${((selectedProduct.cost_breakdown.materials + selectedProduct.cost_breakdown.labor) / selectedProduct.cost_breakdown.total) * 360}deg,
                                    #f59e0b ${((selectedProduct.cost_breakdown.materials + selectedProduct.cost_breakdown.labor) / selectedProduct.cost_breakdown.total) * 360}deg ${((selectedProduct.cost_breakdown.materials + selectedProduct.cost_breakdown.labor + selectedProduct.cost_breakdown.overhead) / selectedProduct.cost_breakdown.total) * 360}deg,
                                    #8b5cf6 ${((selectedProduct.cost_breakdown.materials + selectedProduct.cost_breakdown.labor + selectedProduct.cost_breakdown.overhead) / selectedProduct.cost_breakdown.total) * 360}deg 360deg
                                )`,
                                margin: '0 auto 16px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('costcalculation.sebestoimost', 'Себестоимость')}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>100%</div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'left', fontSize: '13px' }}>
                                {costItems.map(item => (
                                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color }} />
                                        <span>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CostCalculation;
