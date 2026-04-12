import React, { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { generateBarcode, generateProductCode } from '../services/localStorageService';
import { Plus, Search, Edit, Trash2, Package, Save, Barcode, RefreshCw } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import { useAutosave } from '../hooks/useAutosave';
import useActionHandler from '../hooks/useActionHandler';
import BarcodeGenerator from '../components/BarcodeGenerator';
import ExportButton from '../components/ExportButton';
import ImportButton from '../components/ImportButton';
import { exportConfig } from '../config/exportConfig';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Products() {
    const toast = useToast();
    const { t } = useI18n();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showDraftNotice, setShowDraftNotice] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        categoryId: null,
        unit: 'шт',
        pricePurchase: 0,
        priceSale: 0,
        priceRetail: 0,
        vatRate: 12,
        quantity: 0,
        description: '',
        barcode: ''
    });

    const { handleSuccess, handleError } = useActionHandler();

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Autosave hook for product form
    const { hasSavedDraft, draftData, clearDraft, restoreDraft } = useAutosave('new_product', formData);

    // Show draft restore notification when modal opens
    useEffect(() => {
        if (showModal && !editingProduct && hasSavedDraft && draftData) {
            setShowDraftNotice(true);
        }
    }, [showModal, editingProduct, hasSavedDraft, draftData]);

    const handleRestoreDraft = () => {
        const draft = restoreDraft();
        if (draft) {
            setFormData(draft);
            setShowDraftNotice(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [refreshTrigger]);

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll({ search: searchTerm });
            setProducts(response.data.products);
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('[PRODUCTS] handleSubmit called');
        console.log('[PRODUCTS] Form data:', formData);

        try {
            if (editingProduct) {
                await productsAPI.update(editingProduct.id, formData);
                handleSuccess('Товар успешно обновлён!');
            } else {
                // Автогенерация кода и штрих-кода если не указаны
                const dataToSend = {
                    ...formData,
                    code: formData.code || generateProductCode(),
                    barcode: formData.barcode || generateBarcode()
                };
                await productsAPI.create(dataToSend);
                clearDraft();
                setShowDraftNotice(false);
                handleSuccess('Товар успешно создан!');
            }
            setShowModal(false);
            setEditingProduct(null);
            resetForm();
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('[PRODUCTS] Error saving:', error);
            handleError(error.response?.data?.error || 'Ошибка сохранения товара');
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            code: product.code,
            name: product.name,
            categoryId: product.category_id,
            unit: product.unit,
            pricePurchase: product.price_purchase,
            priceSale: product.price_sale,
            priceRetail: product.price_retail,
            vatRate: product.vat_rate,
            description: product.description || '',
            barcode: product.barcode || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm('Вы уверены, что хотите удалить этот товар?');
        if (!confirmed) return;

        try {
            console.log('[PRODUCTS] Deleting product:', id);
            await productsAPI.delete(id);
            setProducts(prev => prev.filter(p => p.id !== id));
            toast.success('Товар удален успешно');
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            toast.error(error.response?.data?.error || 'Ошибка удаления товара');
        }
    };

    // Validate imported product row
    const validateProductRow = (row, index) => {
        // Check required fields
        if (!row['Код'] || !row['Наименование']) {
            return {
                valid: false,
                error: 'Обязательные поля: Код, Наименование'
            };
        }

        // Validate numeric fields
        const numericFields = ['Цена закупки', 'Цена продажи', 'Цена розница', 'Остатки'];
        for (const field of numericFields) {
            if (row[field] && isNaN(parseFloat(row[field]))) {
                return {
                    valid: false,
                    error: `${field}: должно быть числом`
                };
            }
        }

        return { valid: true };
    };

    // Handle product import from Excel
    const handleImportProducts = async (importedData) => {
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const row of importedData) {
                try {
                    const productData = {
                        code: row['Код'] || '',
                        name: row['Наименование'] || '',
                        unit: row['Ед. изм.'] || 'шт',
                        pricePurchase: parseFloat(row['Цена закупки']) || 0,
                        priceSale: parseFloat(row['Цена продажи']) || 0,
                        priceRetail: parseFloat(row['Цена розница']) || 0,
                        quantity: parseInt(row['Остатки']) || 0,
                        barcode: row['Штрих код'] || '',
                        vatRate: parseFloat(row['НДС %']) || 12,
                        description: row['Описание'] || ''
                    };

                    await productsAPI.create(productData);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to import row:`, row, error);
                    errorCount++;
                }
            }

            handleSuccess(`Импортировано ${successCount} товаров${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Import error:', error);
            handleError('Ошибка импорта товаров');
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            categoryId: null,
            unit: 'шт',
            pricePurchase: 0,
            priceSale: 0,
            priceRetail: 0,
            vatRate: 12,
            description: '',
            barcode: ''
        });
    };

    // Автогенерация штрих-кода
    const handleGenerateBarcode = () => {
        setFormData({ ...formData, barcode: generateBarcode() });
    };

    // Автогенерация кода товара
    const handleGenerateCode = () => {
        setFormData({ ...formData, code: generateProductCode() });
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    return (
        <div className="products-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('products.title')}</h1>
                    <p className="text-muted">{t('products.subtitle', 'Управление номенклатурой')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={products}
                        filename="Товары"
                        sheetName="Товары"
                        folder="products"
                        columns={{
                            code: 'Код',
                            name: 'Наименование',
                            category_name: 'Категория',
                            unit: 'Ед. изм.',
                            price_purchase: 'Цена закупки',
                            price_sale: 'Цена продажи',
                            price_retail: 'Цена розница',
                            barcode: 'Штрихкод',
                            is_active: 'Активен'
                        }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        title={t('products.obnovit_spisok', 'Обновить список')}
                    >
                        🔄 {t('common.apply', 'Обновить')}
                    </button>
                    <ImportButton
                        onImport={handleImportProducts}
                        validateRow={validateProductRow}
                        buttonText="Импорт"
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            console.log('[PRODUCTS] New product button clicked');
                            setEditingProduct(null);
                            resetForm();
                            setShowModal(true);
                            console.log('[PRODUCTS] Modal should be open');
                        }}
                    >
                        <Plus size={20} />
                        {t('products.addProduct')}
                    </button>
                </div>
            </div>

            <div className="card mb-3">
                <div className="search-bar">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder={t('products.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyUp={(e) => e.key === 'Enter' && loadProducts()}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={loadProducts}>
                        {t('common.search')}
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="empty-state">
                        <Package size={64} className="text-muted" />
                        <h3>{t('products.noProducts')}</h3>
                        <p className="text-muted">{t('products.addFirst', 'Добавьте первый товар для начала работы')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('products.code')}</th>
                                <th>{t('products.name')}</th>
                                <th>{t('products.category')}</th>
                                <th>{t('products.unit')}</th>
                                <th>{t('products.pricePurchase')}</th>
                                <th>{t('products.priceSale')}</th>
                                <th>{t('products.priceRetail', 'Цена розница')}</th>
                                <th>{t('products.quantity')}</th>
                                <th>{t('common.status')}</th>
                                <th>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id}>
                                    <td><code>{product.code}</code></td>
                                    <td><strong>{product.name}</strong></td>
                                    <td>{product.category_name || '—'}</td>
                                    <td>{product.unit}</td>
                                    <td>{formatCurrency(product.price_purchase)}</td>
                                    <td>{formatCurrency(product.price_sale)}</td>
                                    <td>{formatCurrency(product.price_retail)}</td>
                                    <td><strong>{product.quantity || 0}</strong></td>
                                    <td>
                                        {product.is_active ? (
                                            <span className="badge badge-success">{t('products.active')}</span>
                                        ) : (
                                            <span className="badge badge-danger">{t('products.inactive')}  </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn btn-info btn-sm"
                                                onClick={() => {
                                                    setSelectedProductForBarcode(product);
                                                    setShowBarcodeModal(true);
                                                }}
                                                title={t('products.pechat_shtrihkoda', 'Печать штрихкода')}
                                            >
                                                <Barcode size={16} />
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleEdit(product)}
                                                title={t('products.redaktirovat', 'Редактировать')}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(product.id)}
                                                title={t('products.udalit', 'Удалить')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal glass" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingProduct ? t('products.editProduct') : t('products.addProduct')}</h2>
                            {!editingProduct && (
                                <span style={{ fontSize: '12px', color: '#666', marginLeft: 'auto' }}>
                                    <Save size={14} style={{ marginRight: '4px' }} />
                                    Автосохранение
                                </span>
                            )}
                        </div>
                        {/* Draft Restore Notification */}
                        {showDraftNotice && !editingProduct && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#fff3cd',
                                borderBottom: '1px solid #ffc107',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span>{t('products.nayden_sohranyonnyy_chernovik_tovara', '📝 Найден сохранённый черновик товара')}</span>
                                <div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={handleRestoreDraft}
                                        style={{ marginRight: '8px' }}
                                    >
                                        Восстановить
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => { setShowDraftNotice(false); clearDraft(); }}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="grid grid-2">
                                    <div className="form-group">
                                        <label>{t('products.code')} *</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={formData.code}
                                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                placeholder="Авто-генерация"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={handleGenerateCode}
                                                title={t('products.sgenerirovat_kod', 'Сгенерировать код')}
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('products.barcode')} (EAN-13)</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                value={formData.barcode}
                                                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                                placeholder="Авто-генерация"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={handleGenerateBarcode}
                                                title={t('products.sgenerirovat', 'Сгенерировать EAN-13')}
                                            >
                                                <Barcode size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('products.name')} *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-2">
                                    <div className="form-group">
                                        <label>{t('products.unit')}</label>
                                        <select
                                            value={formData.unit}
                                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        >
                                            <option value="шт">{t('products.sht', 'шт')}</option>
                                            <option value="кг">{t('products.kg', 'кг')}</option>
                                            <option value="л">л</option>
                                            <option value="м">м</option>
                                            <option value="упак">{t('products.upak', 'упак')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('products.vatRate', 'Ставка НДС')} (%)</label>
                                        <input
                                            type="number"
                                            value={formData.vatRate}
                                            onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-3">
                                    <div className="form-group">
                                        <label>{t('products.pricePurchase')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.pricePurchase}
                                            onChange={(e) => setFormData({ ...formData, pricePurchase: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('products.priceSale')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.priceSale}
                                            onChange={(e) => setFormData({ ...formData, priceSale: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('products.priceRetail', 'Цена розница')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.priceRetail}
                                            onChange={(e) => setFormData({ ...formData, priceRetail: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('products.quantity')}</label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{t('products.description')}</label>
                                    <textarea
                                        rows="3"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingProduct ? t('common.save') : t('products.create', 'Создать')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Barcode Generator Modal */}
            <BarcodeGenerator
                product={selectedProductForBarcode}
                isOpen={showBarcodeModal}
                onClose={() => {
                    setShowBarcodeModal(false);
                    setSelectedProductForBarcode(null);
                }}
            />
        </div>
    );
}

export default Products;
