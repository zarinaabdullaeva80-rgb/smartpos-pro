import React, { useState, useEffect, useRef } from 'react';
import { Printer, Package, Search, Plus, Trash2, Settings, Download, Eye, Tag, Barcode } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useI18n } from '../i18n';

function PriceTagPrinter() {
    const { t } = useI18n();
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [tagSettings, setTagSettings] = useState({
        size: 'medium', // small, medium, large
        showBarcode: true,
        showSKU: true,
        showOldPrice: true,
        showStoreName: true,
        storeName: localStorage.getItem('priceTagStoreName') || '',
        storeNamePosition: 'top', // top, bottom
        nameFontSize: 10, // px
        priceFontSize: 15, // px
        columns: 3
    });

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setProducts(apiData.products || []);
        } catch (err) {
            console.warn('PriceTagPrinter: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const addProduct = (product) => {
        const existing = selectedProducts.find(p => p.id === product.id);
        if (existing) {
            setSelectedProducts(selectedProducts.map(p =>
                p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
            ));
        } else {
            setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
        }
    };

    const removeProduct = (productId) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeProduct(productId);
        } else {
            setSelectedProducts(selectedProducts.map(p =>
                p.id === productId ? { ...p, quantity } : p
            ));
        }
    };

    const totalTags = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm)
    );

    // Генерация SVG штрих-кода (EAN-13 simplified)
    const generateBarcodeSVG = (barcode) => {
        const encoding = barcode.split('').map(c => {
            const patterns = {
                '0': '3211', '1': '2221', '2': '2122', '3': '1411', '4': '1132',
                '5': '1231', '6': '1114', '7': '1312', '8': '1213', '9': '3112'
            };
            return patterns[c] || '1111';
        }).join('');

        let x = 0;
        const bars = [];
        let isBlack = true;

        for (const width of encoding.split('')) {
            const w = parseInt(width);
            if (isBlack) {
                bars.push(`<rect x="${x}" y="0" width="${w}" height="40" fill="#000"/>`);
            }
            x += w;
            isBlack = !isBlack;
        }

        return `<svg viewBox="0 0 ${x} 50" xmlns="http://www.w3.org/2000/svg">
            ${bars.join('')}
            <text x="${x / 2}" y="48" text-anchor="middle" font-size="8" font-family="monospace">${barcode}</text>
        </svg>`;
    };

    const printTags = () => {
        const printWindow = window.open('', '_blank');
        const tagSize = {
            small: { width: '40mm', height: '25mm', barcodeHeight: '20px' },
            medium: { width: '58mm', height: '40mm', barcodeHeight: '30px' },
            large: { width: '80mm', height: '50mm', barcodeHeight: '40px' }
        }[tagSettings.size];

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>{t('pricetagprinter.pechat_tsennikov', 'Печать ценников')}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    
                    /* Скрыть URL, дату и нумерацию страниц при печати */
                    @page { 
                        size: A4; 
                        margin: 5mm;
                    }
                    
                    @media print {
                        html, body { margin: 0 !important; padding: 0 !important; }
                        /* Скрыть системные колонтитулы браузера */
                        @page { margin: 5mm 5mm 5mm 5mm; }
                    }
                    
                    .tags-container {
                        display: grid;
                        grid-template-columns: repeat(${tagSettings.columns}, 1fr);
                        gap: 2mm;
                        padding: 5mm;
                    }
                    .price-tag {
                        width: ${tagSize.width};
                        height: ${tagSize.height};
                        border: 1px solid #000;
                        padding: 2mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                    }
                    .tag-name {
                        font-weight: bold;
                        font-size: ${tagSettings.nameFontSize}px;
                        line-height: 1.2;
                        max-height: 2.4em;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .tag-store-name {
                        font-size: ${Math.max(tagSettings.nameFontSize - 2, 7)}px;
                        color: #333;
                        text-align: center;
                        font-weight: 600;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 2px;
                        margin-bottom: 2px;
                    }
                    .tag-store-name-bottom {
                        font-size: ${Math.max(tagSettings.nameFontSize - 2, 7)}px;
                        color: #333;
                        text-align: center;
                        font-weight: 600;
                        border-top: 1px solid #ddd;
                        padding-top: 2px;
                        margin-top: 2px;
                    }
                    .tag-sku {
                        font-size: ${Math.max(tagSettings.nameFontSize - 2, 7)}px;
                        color: #666;
                    }
                    .tag-barcode {
                        text-align: center;
                        height: ${tagSize.barcodeHeight};
                    }
                    .tag-barcode svg {
                        height: 100%;
                        width: auto;
                    }
                    .tag-price {
                        font-size: ${tagSettings.priceFontSize}px;
                        font-weight: bold;
                        text-align: center;
                    }
                    .tag-old-price {
                        font-size: ${Math.max(tagSettings.priceFontSize - 3, 8)}px;
                        text-decoration: line-through;
                        color: #999;
                        text-align: center;
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="padding: 10px; background: #eee; margin-bottom: 10px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">{t('pricetagprinter.pechat', '🖨️ Печать')}</button>
                    <span style="margin-left: 20px;">Всего ценников: ${totalTags}</span>
                </div>
                <div class="tags-container">
                    ${selectedProducts.flatMap(product =>
            Array(product.quantity).fill(null).map(() => `
                            <div class="price-tag">
                                ${tagSettings.showStoreName && tagSettings.storeName && tagSettings.storeNamePosition === 'top' ? `<div class="tag-store-name">${tagSettings.storeName}</div>` : ''}
                                <div class="tag-name">${product.name}</div>
                                ${tagSettings.showSKU ? `<div class="tag-sku">Арт: ${product.sku}</div>` : ''}
                                ${tagSettings.showBarcode ? `<div class="tag-barcode">${generateBarcodeSVG(product.barcode)}</div>` : ''}
                                ${tagSettings.showOldPrice && product.old_price ? `<div class="tag-old-price">${formatCurrency(product.old_price)}</div>` : ''}
                                <div class="tag-price">${formatCurrency(product.price)}</div>
                                ${tagSettings.showStoreName && tagSettings.storeName && tagSettings.storeNamePosition === 'bottom' ? `<div class="tag-store-name-bottom">${tagSettings.storeName}</div>` : ''}
                            </div>
                        `)
        ).join('')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="price-tag-printer-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('pricetagprinter.pechat_tsennikov', '🏷️ Печать ценников')}</h1>
                    <p className="text-muted">{t('pricetagprinter.generatsiya_i_pechat_tsennikov_so_shtrih_kod', 'Генерация и печать ценников со штрих-кодами')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowPreview(true)} disabled={selectedProducts.length === 0}>
                        <Eye size={18} /> Предпросмотр
                    </button>
                    <button className="btn btn-primary" onClick={printTags} disabled={selectedProducts.length === 0}>
                        <Printer size={18} /> Печать ({totalTags} шт)
                    </button>
                </div>
            </div>

            {/* Настройки */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings size={18} />
                        <strong>{t('pricetagprinter.nastroyki', 'Настройки:')}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{t('pricetagprinter.razmer', 'Размер:')}</span>
                        <select value={tagSettings.size} onChange={(e) => setTagSettings({ ...tagSettings, size: e.target.value })}>
                            <option value="small">{t('pricetagprinter.malenkiy_mm', 'Маленький (40×25мм)')}</option>
                            <option value="medium">{t('pricetagprinter.sredniy_mm', 'Средний (58×40мм)')}</option>
                            <option value="large">{t('pricetagprinter.bolshoy_mm', 'Большой (80×50мм)')}</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{t('pricetagprinter.kolonok', 'Колонок:')}</span>
                        <select value={tagSettings.columns} onChange={(e) => setTagSettings({ ...tagSettings, columns: parseInt(e.target.value) })}>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={tagSettings.showBarcode} onChange={(e) => setTagSettings({ ...tagSettings, showBarcode: e.target.checked })} />
                        {t('pricetagprinter.shtrih_kod', 'Штрих-код')}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={tagSettings.showSKU} onChange={(e) => setTagSettings({ ...tagSettings, showSKU: e.target.checked })} />
                        Артикул
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={tagSettings.showOldPrice} onChange={(e) => setTagSettings({ ...tagSettings, showOldPrice: e.target.checked })} />
                        Старая цена
                    </label>
                </div>
                {/* Второй ряд: название магазина и размеры шрифтов */}
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={tagSettings.showStoreName} onChange={(e) => setTagSettings({ ...tagSettings, showStoreName: e.target.checked })} />
                        Магазин
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="Название магазина"
                            value={tagSettings.storeName}
                            onChange={(e) => {
                                setTagSettings({ ...tagSettings, storeName: e.target.value });
                                localStorage.setItem('priceTagStoreName', e.target.value);
                            }}
                            style={{ width: '200px', padding: '4px 8px', fontSize: '13px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Позиция:</span>
                        <select value={tagSettings.storeNamePosition} onChange={(e) => setTagSettings({ ...tagSettings, storeNamePosition: e.target.value })}>
                            <option value="top">Сверху</option>
                            <option value="bottom">Снизу</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Шрифт названия:</span>
                        <input
                            type="range" min="7" max="20" value={tagSettings.nameFontSize}
                            onChange={(e) => setTagSettings({ ...tagSettings, nameFontSize: parseInt(e.target.value) })}
                            style={{ width: '80px' }}
                        />
                        <span style={{ fontSize: '12px', minWidth: '30px' }}>{tagSettings.nameFontSize}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Шрифт цены:</span>
                        <input
                            type="range" min="10" max="30" value={tagSettings.priceFontSize}
                            onChange={(e) => setTagSettings({ ...tagSettings, priceFontSize: parseInt(e.target.value) })}
                            style={{ width: '80px' }}
                        />
                        <span style={{ fontSize: '12px', minWidth: '30px' }}>{tagSettings.priceFontSize}px</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Список товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск по названию, артикулу или штрих-коду..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('pricetagprinter.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('pricetagprinter.tovar', 'Товар')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('pricetagprinter.shtrih_kod', 'Штрих-код')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('pricetagprinter.tsena', 'Цена')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('pricetagprinter.dobavit', 'Добавить')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{product.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>Арт: {product.sku}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{product.barcode}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <div style={{ fontWeight: 'bold' }}>{formatCurrency(product.price)}</div>
                                            {product.old_price && (
                                                <div style={{ fontSize: '12px', textDecoration: 'line-through', color: '#888' }}>
                                                    {formatCurrency(product.old_price)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => addProduct(product)}>
                                                <Plus size={14} /> {t('pricetagprinter.dobavit', 'Добавить')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Выбранные товары */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('pricetagprinter.k_pechati', '🛒 К печати')}</h3>
                        <span style={{
                            background: selectedProducts.length > 0 ? '#dcfce7' : '#f3f4f6',
                            color: selectedProducts.length > 0 ? '#16a34a' : '#888',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontWeight: 'bold'
                        }}>
                            {totalTags} ценников
                        </span>
                    </div>
                    {selectedProducts.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <Tag size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                            <p style={{ color: '#888' }}>{t('pricetagprinter.dobavte_tovary_dlya_pechati_tsennikov', 'Добавьте товары для печати ценников')}</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {selectedProducts.map(product => (
                                <div key={product.id} style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{product.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{formatCurrency(product.price)}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => updateQuantity(product.id, product.quantity - 1)}
                                        >−</button>
                                        <span style={{ width: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {product.quantity}
                                        </span>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => updateQuantity(product.id, product.quantity + 1)}
                                        >+</button>
                                    </div>
                                    <button className="btn btn-sm btn-secondary" onClick={() => removeProduct(product.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {selectedProducts.length > 0 && (
                        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedProducts([])}>
                                <Trash2 size={16} /> Очистить
                            </button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={printTags}>
                                <Printer size={16} /> Печать
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Предпросмотр ценника */}
            {showPreview && selectedProducts.length > 0 && (
                <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{t('pricetagprinter.predprosmotr_tsennika', '👁️ Предпросмотр ценника')}</h2>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <div style={{
                                width: tagSettings.size === 'small' ? '160px' : tagSettings.size === 'medium' ? '230px' : '320px',
                                padding: '16px',
                                border: '2px solid #000',
                                borderRadius: '4px',
                                background: 'white'
                            }}>
                                {tagSettings.showStoreName && tagSettings.storeName && tagSettings.storeNamePosition === 'top' && (
                                    <div style={{ fontSize: `${Math.max(tagSettings.nameFontSize - 2, 7)}px`, fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '4px', color: '#333' }}>
                                        {tagSettings.storeName}
                                    </div>
                                )}
                                <div style={{ fontWeight: 'bold', fontSize: `${tagSettings.nameFontSize}px`, marginBottom: '8px' }}>
                                    {selectedProducts[0].name}
                                </div>
                                {tagSettings.showSKU && (
                                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
                                        Арт: {selectedProducts[0].sku}
                                    </div>
                                )}
                                {tagSettings.showBarcode && (
                                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                        <Barcode size={48} />
                                        <div style={{ fontFamily: 'monospace', fontSize: '10px' }}>{selectedProducts[0].barcode}</div>
                                    </div>
                                )}
                                {tagSettings.showOldPrice && selectedProducts[0].old_price && (
                                    <div style={{ textAlign: 'center', textDecoration: 'line-through', color: '#888', fontSize: '14px' }}>
                                        {formatCurrency(selectedProducts[0].old_price)}
                                    </div>
                                )}
                                <div style={{ textAlign: 'center', fontSize: `${tagSettings.priceFontSize}px`, fontWeight: 'bold' }}>
                                    {formatCurrency(selectedProducts[0].price)}
                                </div>
                                {tagSettings.showStoreName && tagSettings.storeName && tagSettings.storeNamePosition === 'bottom' && (
                                    <div style={{ fontSize: `${Math.max(tagSettings.nameFontSize - 2, 7)}px`, fontWeight: 600, textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: '4px', marginTop: '4px', color: '#333' }}>
                                        {tagSettings.storeName}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>{t('pricetagprinter.zakryt', 'Закрыть')}</button>
                            <button className="btn btn-primary" onClick={printTags}>
                                <Printer size={18} /> Печать ({totalTags} шт)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PriceTagPrinter;
