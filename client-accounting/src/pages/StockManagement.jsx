import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus, RefreshCw, Search, ArrowUpCircle, ArrowDownCircle, Settings } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';

const StockManagement = () => {
    const { t } = useI18n();
    const toast = useToast();
    const confirm = useConfirm();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('receipt'); // receipt, writeoff, adjustment
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [formData, setFormData] = useState({ quantity: '', reason: '' });

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const response = await productsAPI.getAllStock({ search: search || undefined });
            setProducts(response.data?.products || []);
        } catch (error) {
            console.error('Ошибка загрузки остатков:', error);
            // Fallback: load regular products
            try {
                const resp = await productsAPI.getAll({ search: search || undefined });
                setProducts((resp.data?.products || []).map(p => ({ ...p, total_stock: 0 })));
            } catch (e2) {
                toast.error('Не удалось загрузить товары');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    useEffect(() => {
        const timer = setTimeout(() => loadProducts(), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const openStockModal = (product, type) => {
        setSelectedProduct(product);
        setModalType(type);
        setFormData({ quantity: '', reason: '' });
        setShowModal(true);
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
            toast.error('Укажите количество больше 0');
            return;
        }

        if (modalType === 'writeoff') {
            const currentStock = parseFloat(selectedProduct.total_stock || 0);
            if (parseFloat(formData.quantity) > currentStock) {
                toast.error(`Нельзя списать больше, чем есть на складе (${currentStock} ${selectedProduct.unit})`);
                return;
            }
        }

        try {
            const res = await productsAPI.updateStock(selectedProduct.id, {
                quantity: parseFloat(formData.quantity),
                type: modalType,
                reason: formData.reason
            });
            toast.success(res.data?.message || 'Остаток обновлён');
            setShowModal(false);
            loadProducts();
        } catch (error) {
            toast.error('Ошибка: ' + (error.response?.data?.error || error.message));
        }
    };

    const totalProducts = products.length;
    const inStock = products.filter(p => parseFloat(p.total_stock) > 0).length;
    const outOfStock = products.filter(p => parseFloat(p.total_stock) <= 0).length;
    const lowStock = products.filter(p => parseFloat(p.total_stock) > 0 && parseFloat(p.total_stock) < 5).length;

    const typeLabels = {
        receipt: { title: '📦 Приход товара', icon: <ArrowUpCircle size={20} />, color: 'text-green-600', btnClass: 'btn-success' },
        writeoff: { title: '📤 Списание товара', icon: <ArrowDownCircle size={20} />, color: 'text-red-600', btnClass: 'btn-danger' },
        adjustment: { title: '⚙️ Корректировка остатка', icon: <Settings size={20} />, color: 'text-blue-600', btnClass: 'btn-primary' }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Package className="page-icon" />
                        Остатки товаров
                    </h1>
                    <p className="page-subtitle">{t('stockmanagement.upravlenie_skladskimi_ostatkami_prihod', 'Управление складскими остатками — приход, списание, корректировка')}</p>
                </div>
                <button className="btn btn-secondary" onClick={loadProducts} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    Обновить
                </button>
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('stockmanagement.vsego_tovarov', 'Всего товаров')}</span>
                        <Package className="stat-icon text-blue-500" size={24} />
                    </div>
                    <div className="stat-value">{totalProducts}</div>
                </div>
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('stockmanagement.v_nalichii', 'В наличии')}</span>
                        <ArrowUpCircle className="stat-icon text-green-500" size={24} />
                    </div>
                    <div className="stat-value">{inStock}</div>
                </div>
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('stockmanagement.malo_na_sklade', 'Мало на складе')}</span>
                        <ArrowDownCircle className="stat-icon text-orange-500" size={24} />
                    </div>
                    <div className="stat-value">{lowStock}</div>
                </div>
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('stockmanagement.net_v_nalichii', 'Нет в наличии')}</span>
                        <Minus className="stat-icon text-red-500" size={24} />
                    </div>
                    <div className="stat-value">{outOfStock}</div>
                </div>
            </div>

            {/* Поиск */}
            <div className="card glass mb-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Search size={20} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="input"
                        placeholder="Поиск по названию, коду или штрих-коду..."
                        value={search}
                        onChange={handleSearch}
                        style={{ flex: 1 }}
                    />
                </div>
            </div>

            {/* Таблица */}
            <div className="content-section">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('stockmanagement.kod', 'Код')}</th>
                                <th>{t('stockmanagement.nazvanie', 'Название')}</th>
                                <th>{t('stockmanagement.kategoriya', 'Категория')}</th>
                                <th>{t('stockmanagement.ed_izm', 'Ед. изм.')}</th>
                                <th style={{ textAlign: 'right' }}>{t('stockmanagement.zakup_tsena', 'Закуп. цена')}</th>
                                <th style={{ textAlign: 'right' }}>{t('stockmanagement.prod_tsena', 'Прод. цена')}</th>
                                <th style={{ textAlign: 'center' }}>{t('stockmanagement.ostatok', 'Остаток')}</th>
                                <th>{t('stockmanagement.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('stockmanagement.zagruzka', 'Загрузка...')}</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('stockmanagement.net_tovarov', 'Нет товаров')}</td></tr>
                            ) : products.map(product => {
                                const stock = parseFloat(product.total_stock || 0);
                                const stockClass = stock <= 0 ? 'text-red-600' : stock < 5 ? 'text-orange-500' : 'text-green-600';
                                return (
                                    <tr key={product.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{product.code}</td>
                                        <td className="font-medium">{product.name}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{product.category_name || '—'}</td>
                                        <td>{product.unit || 'шт'}</td>
                                        <td style={{ textAlign: 'right' }}>{parseFloat(product.price_purchase || 0).toLocaleString('ru-RU')} сум</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{parseFloat(product.price_sale || 0).toLocaleString('ru-RU')} сум</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`font-semibold ${stockClass}`} style={{ fontSize: '16px' }}>
                                                {stock} {product.unit || 'шт'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button
                                                    className="btn btn-xs btn-success"
                                                    onClick={() => openStockModal(product, 'receipt')}
                                                    title={t('stockmanagement.prihod', 'Приход')}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-danger"
                                                    onClick={() => openStockModal(product, 'writeoff')}
                                                    title={t('stockmanagement.spisanie', 'Списание')}
                                                    disabled={stock <= 0}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-secondary"
                                                    onClick={() => openStockModal(product, 'adjustment')}
                                                    title={t('stockmanagement.korrektirovka', 'Корректировка')}
                                                >
                                                    <Settings size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && selectedProduct && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{typeLabels[modalType]?.title}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleStockSubmit}>
                            <div className="modal-body">
                                <div className="card glass mb-4" style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div className="font-medium">{selectedProduct.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Код: {selectedProduct.code}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('stockmanagement.tekuschiy_ostatok', 'Текущий остаток')}</div>
                                            <div className="font-semibold" style={{ fontSize: '18px' }}>
                                                {parseFloat(selectedProduct.total_stock || 0)} {selectedProduct.unit || 'шт'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label className="label required">Количество ({selectedProduct.unit || 'шт'})</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min="0.01"
                                        step="0.01"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        placeholder="Введите количество"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="label">{t('stockmanagement.prichina_kommentariy', 'Причина / комментарий')}</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.reason}
                                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                        placeholder={modalType === 'receipt' ? 'Закупка от поставщика' : modalType === 'writeoff' ? 'Порча, истек срок' : 'Результат пересчёта'}
                                    />
                                </div>

                                {formData.quantity && (
                                    <div className="card glass mt-4" style={{ padding: '12px', background: 'var(--bg-tertiary)' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('stockmanagement.novyy_ostatok_budet', 'Новый остаток будет:')}</div>
                                        <div className="font-semibold" style={{ fontSize: '20px' }}>
                                            {modalType === 'writeoff'
                                                ? (parseFloat(selectedProduct.total_stock || 0) - parseFloat(formData.quantity || 0)).toFixed(2)
                                                : modalType === 'adjustment'
                                                    ? parseFloat(formData.quantity || 0).toFixed(2)
                                                    : (parseFloat(selectedProduct.total_stock || 0) + parseFloat(formData.quantity || 0)).toFixed(2)
                                            } {selectedProduct.unit || 'шт'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className={`btn ${typeLabels[modalType]?.btnClass || 'btn-primary'}`}>
                                    {modalType === 'receipt' ? '📦 Оформить приход' : modalType === 'writeoff' ? '📤 Списать' : '⚙️ Скорректировать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManagement;
