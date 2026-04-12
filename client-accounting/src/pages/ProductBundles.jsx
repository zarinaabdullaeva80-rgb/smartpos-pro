import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Tag, DollarSign } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';


function ProductBundles() {
    const { t } = useI18n();
    const toast = useToast();
    const [bundles, setBundles] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedBundle, setSelectedBundle] = useState(null);

    useEffect(() => { loadBundles(); }, []);

    const loadBundles = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setBundles(apiData.bundles || []);
        } catch (err) {
            console.warn('ProductBundles: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const filteredBundles = bundles.filter(b =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="product-bundles-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('productbundles.komplekty_tovarov', '📦 Комплекты товаров')}</h1>
                    <p className="text-muted">{t('productbundles.prodazha_naborov_tovarov_so_skidkoy', 'Продажа наборов товаров со скидкой')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={18} /> Создать комплект
                </button>
            </div>

            {/* Поиск */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input
                        type="text"
                        placeholder="Поиск комплекта..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '40px', width: '100%' }}
                    />
                </div>
            </div>

            {/* Список комплектов */}
            {loading ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>{t('productbundles.zagruzka', 'Загрузка...')}</div>
            ) : filteredBundles.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Package size={64} style={{ color: '#ccc', marginBottom: '20px' }} />
                    <h3>{t('productbundles.komplekty_ne_naydeny', 'Комплекты не найдены')}</h3>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        Создать первый комплект
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                    {filteredBundles.map(bundle => (
                        <div key={bundle.id} className="card" style={{ overflow: 'hidden' }}>
                            {/* Заголовок */}
                            <div style={{
                                padding: '20px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px' }}>{bundle.name}</h3>
                                        <div style={{ opacity: 0.8, fontSize: '13px' }}>SKU: {bundle.sku}</div>
                                    </div>
                                    <span style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '14px'
                                    }}>
                                        -{bundle.discount_percent}%
                                    </span>
                                </div>
                            </div>

                            {/* Состав */}
                            <div style={{ padding: '16px' }}>
                                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>{t('productbundles.sostav_komplekta', 'Состав комплекта:')}</h4>
                                {bundle.items.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '8px 0',
                                        borderBottom: idx < bundle.items.length - 1 ? '1px dashed var(--border-color)' : 'none'
                                    }}>
                                        <span>{item.name} × {item.quantity}</span>
                                        <span style={{ color: '#888' }}>{formatCurrency(item.price)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Цены */}
                            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#888' }}>{t('productbundles.po_otdelnosti', 'По отдельности:')}</span>
                                    <span style={{ textDecoration: 'line-through', color: '#888' }}>
                                        {formatCurrency(bundle.components_price)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold' }}>{t('productbundles.tsena_komplekta', 'Цена комплекта:')}</span>
                                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                        {formatCurrency(bundle.price)}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'center', marginTop: '12px', padding: '8px', background: '#dcfce7', borderRadius: '8px', color: '#16a34a' }}>
                                    💰 Выгода: {formatCurrency(bundle.components_price - bundle.price)}
                                </div>
                            </div>

                            {/* Кнопки */}
                            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }}>
                                    <Edit2 size={16} /> Редактировать
                                </button>
                                <button className="btn btn-secondary" title={t('productbundles.udalit', 'Удалить')}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Модал создания */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{t('productbundles.novyy_komplekt', '📦 Новый комплект')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('productbundles.nazvanie_komplekta', 'Название комплекта')}</label>
                                <input type="text" placeholder="Набор 'Геймер'" />
                            </div>
                            <div className="form-group">
                                <label>SKU</label>
                                <input type="text" placeholder="BUNDLE-001" />
                            </div>
                            <div className="form-group">
                                <label>{t('productbundles.skidka_pct', 'Скидка (%)')}</label>
                                <input type="number" placeholder="10" min="0" max="100" />
                            </div>
                            <div className="form-group">
                                <label>{t('productbundles.tovary_v_komplekte', 'Товары в комплекте')}</label>
                                <p style={{ color: '#888', fontSize: '14px' }}>
                                    Добавьте товары после создания комплекта
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('productbundles.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => { setShowCreate(false); toast.success('Комплект создан!'); }}>
                                <Plus size={18} /> Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductBundles;
