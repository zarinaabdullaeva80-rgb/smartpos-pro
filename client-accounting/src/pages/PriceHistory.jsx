import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, Search, Filter, Download, DollarSign, BarChart2 } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function PriceHistory() {
    const { t } = useI18n();
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('PriceHistory.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('PriceHistory: не удалось загрузить данные', err.message);
        }


        setSelectedProduct(1);
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU');

    const productHistory = history.filter(h => h.product_id === selectedProduct);
    const selectedProductData = products.find(p => p.id === selectedProduct);

    return (
        <div className="price-history-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('pricehistory.istoriya_tsen', '📈 История цен')}</h1>
                    <p className="text-muted">{t('pricehistory.otslezhivanie_izmeneniy_tsen_na_tovary', 'Отслеживание изменений цен на товары')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.info('Экспорт истории цен...')}>
                    <Download size={18} /> Экспорт
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск товара..." style={{ paddingLeft: '40px', width: '100%' }} />
                        </div>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {products.map(product => (
                            <div
                                key={product.id}
                                onClick={() => setSelectedProduct(product.id)}
                                style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedProduct === product.id ? 'var(--primary-light)' : 'transparent'
                                }}
                            >
                                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{product.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#888', fontSize: '13px' }}>{product.sku}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(product.current_price)}</span>
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                    <span style={{
                                        background: '#dbeafe',
                                        color: '#1d4ed8',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px'
                                    }}>
                                        {product.changes} изменений
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* История изменений */}
                <div className="card">
                    {selectedProductData && (
                        <>
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                <h3 style={{ margin: '0 0 8px' }}>{selectedProductData.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('pricehistory.tekuschaya_tsena', 'Текущая цена')}</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(selectedProductData.current_price)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('pricehistory.vsego_izmeneniy', 'Всего изменений')}</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{productHistory.length}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Таймлайн */}
                            <div style={{ padding: '20px' }}>
                                <h4 style={{ margin: '0 0 16px' }}>{t('pricehistory.istoriya_izmeneniy', '📅 История изменений')}</h4>
                                {productHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                                        Нет истории изменений
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative', paddingLeft: '30px' }}>
                                        {/* Вертикальная линия */}
                                        <div style={{
                                            position: 'absolute',
                                            left: '10px',
                                            top: '0',
                                            bottom: '0',
                                            width: '2px',
                                            background: 'var(--border-color)'
                                        }} />

                                        {productHistory.map((item, idx) => {
                                            const isIncrease = item.change > 0;
                                            return (
                                                <div key={item.id} style={{
                                                    position: 'relative',
                                                    marginBottom: '24px',
                                                    paddingBottom: idx < productHistory.length - 1 ? '24px' : 0
                                                }}>
                                                    {/* Точка на линии */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '-26px',
                                                        top: '4px',
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '50%',
                                                        background: isIncrease ? '#ef4444' : '#10b981',
                                                        border: '3px solid white',
                                                        boxShadow: '0 0 0 2px var(--border-color)'
                                                    }} />

                                                    <div style={{
                                                        padding: '16px',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {isIncrease ? (
                                                                    <TrendingUp size={20} color="#ef4444" />
                                                                ) : (
                                                                    <TrendingDown size={20} color="#10b981" />
                                                                )}
                                                                <span style={{
                                                                    fontWeight: 'bold',
                                                                    color: isIncrease ? '#ef4444' : '#10b981'
                                                                }}>
                                                                    {isIncrease ? '+' : ''}{item.change.toFixed(2)}%
                                                                </span>
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: '#888' }}>
                                                                {formatDate(item.changed_at)}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#888' }}>{t('pricehistory.bylo', 'Было')}</div>
                                                                <div style={{ textDecoration: 'line-through', color: '#888' }}>
                                                                    {formatCurrency(item.old_price)}
                                                                </div>
                                                            </div>
                                                            <span>→</span>
                                                            <div>
                                                                <div style={{ fontSize: '11px', color: '#888' }}>{t('pricehistory.stalo', 'Стало')}</div>
                                                                <div style={{ fontWeight: 'bold' }}>
                                                                    {formatCurrency(item.new_price)}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ fontSize: '13px', color: '#666' }}>
                                                            <strong>{t('pricehistory.prichina', 'Причина:')}</strong> {item.reason}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                                            Изменил: {item.changed_by}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PriceHistory;
