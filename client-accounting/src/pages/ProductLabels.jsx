import React, { useState, useEffect } from 'react';
import { Tag, Printer, Search, Check, Plus, Settings, Download, Grid, List } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useI18n } from '../i18n';

function ProductLabels() {
    const { t } = useI18n();
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState([]);
    const [template, setTemplate] = useState('standard');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('ProductLabels.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('ProductLabels: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const selectAll = () => {
        if (selected.length === products.length) {
            setSelected([]);
        } else {
            setSelected(products.map(p => p.id));
        }
    };

    const templates = [
        { id: 'standard', name: 'Стандартная', size: '58x40 мм' },
        { id: 'large', name: 'Большая', size: '100x50 мм' },
        { id: 'jewelry', name: 'Ювелирная', size: '25x10 мм' },
        { id: 'shelf', name: 'Полочная', size: '60x30 мм' }
    ];

    return (
        <div className="product-labels-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('productlabels.etiketki_tovarov', '🏷️ Этикетки товаров')}</h1>
                    <p className="text-muted">{t('productlabels.pechat_etiketok_so_shtrih_kodami', 'Печать этикеток со штрих-кодами')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" disabled={selected.length === 0}>
                        <Download size={18} /> Скачать PDF
                    </button>
                    <button className="btn btn-primary" disabled={selected.length === 0}>
                        <Printer size={18} /> Печать ({selected.length})
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Список товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input
                                type="checkbox"
                                checked={selected.length === products.length && products.length > 0}
                                onChange={selectAll}
                            />
                            <span style={{ fontWeight: 500 }}>{t('productlabels.vybrat_vse', 'Выбрать все')}</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '250px' }} />
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('productlabels.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {products.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => toggleSelect(product.id)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        cursor: 'pointer',
                                        background: selected.includes(product.id) ? 'var(--primary-light)' : 'transparent'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(product.id)}
                                        onChange={() => { }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{product.name}</div>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                            <span>SKU: {product.sku}</span>
                                            <span>Штрих-код: {product.barcode}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold' }}>{formatCurrency(product.price)}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{product.category}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Настройки и превью */}
                <div>
                    {/* Шаблоны */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('productlabels.shablon_etiketki', '📑 Шаблон этикетки')}</h3>
                        </div>
                        <div style={{ padding: '16px' }}>
                            {templates.map(t => (
                                <label
                                    key={t.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        border: `2px solid ${template === t.id ? 'var(--primary)' : 'var(--border-color)'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        background: template === t.id ? 'var(--primary-light)' : 'transparent'
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="template"
                                        checked={template === t.id}
                                        onChange={() => setTemplate(t.id)}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t.size}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Превью */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('productlabels.prevyu', '👁️ Превью')}</h3>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                width: template === 'large' ? '200px' : template === 'jewelry' ? '100px' : '150px',
                                padding: '16px',
                                border: '2px solid #000',
                                borderRadius: '4px',
                                background: 'white',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
                                    {selected.length > 0 ? products.find(p => p.id === selected[0])?.name : 'Название товара'}
                                </div>

                                {/* Штрих-код (SVG) */}
                                <svg width="120" height="40" style={{ margin: '8px 0' }}>
                                    {[...Array(30)].map((_, i) => (
                                        <rect
                                            key={i}
                                            x={i * 4}
                                            y="0"
                                            width={Math.random() > 0.5 ? 2 : 1}
                                            height="30"
                                            fill="black"
                                        />
                                    ))}
                                    <text x="60" y="38" textAnchor="middle" style={{ fontSize: '8px' }}>
                                        {selected.length > 0 ? products.find(p => p.id === selected[0])?.barcode : '4600000000000'}
                                    </text>
                                </svg>

                                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                    {selected.length > 0 ? formatCurrency(products.find(p => p.id === selected[0])?.price) : formatCurrency(0)}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <div className="form-group">
                                <label>{t('productlabels.kolichestvo_kopiy', 'Количество копий')}</label>
                                <input type="number" defaultValue={1} min={1} max={100} />
                            </div>
                            <div className="form-group">
                                <label>
                                    <input type="checkbox" defaultChecked /> Показывать цену
                                </label>
                            </div>
                            <div className="form-group">
                                <label>
                                    <input type="checkbox" defaultChecked /> Показывать SKU
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductLabels;
