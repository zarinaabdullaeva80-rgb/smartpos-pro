import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { productsAPI } from '../services/api';
import api from '../services/api';
import { generateBarcode, generateProductCode } from '../services/localStorageService';
import { Plus, Search, Edit, Trash2, Package, Save, Barcode, RefreshCw, FolderOpen, Folder, ChevronRight, PlusCircle, X, Check, CheckSquare, Square, Move, Power, ToggleLeft, ToggleRight, LayoutGrid, List, Grid3X3, ArrowUp, ArrowDown, Filter, AlertTriangle, ChevronLeft, Eye, Table2 } from 'lucide-react';
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
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [inlineEditId, setInlineEditId] = useState(null);
    const [inlineAddMode, setInlineAddMode] = useState(false); // inline-форма добавления
    const [selectedIds, setSelectedIds] = useState(new Set()); // групповое удаление
    const [moveCategoryId, setMoveCategoryId] = useState(''); // целевая категория для перемещения
    const [showMoveCategory, setShowMoveCategory] = useState(false); // показать выбор категории
    const [showDraftNotice, setShowDraftNotice] = useState(false);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);

    // ── Новые состояния: режимы, сортировка, пагинация, фильтры ──
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('products_viewMode') || 'table');
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(() => parseInt(localStorage.getItem('products_perPage')) || 50);
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState('products'); // 'products' | 'lowstock'
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [stockMin, setStockMin] = useState('');
    const [stockMax, setStockMax] = useState('');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
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
        minStock: 0,
        description: '',
        barcode: ''
    });
    const [categories, setCategories] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const { handleSuccess, handleError } = useActionHandler();

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Ref для прокрутки к форме inline-редактирования
    const inlineEditRef = useRef(null);
    const inlineAddRef = useRef(null);

    // Прокрутка к строке редактирования при открытии
    useEffect(() => {
        if (inlineEditId !== null && inlineEditRef.current) {
            inlineEditRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [inlineEditId]);

    // Прокрутка к форме добавления при открытии
    useEffect(() => {
        if (inlineAddMode && inlineAddRef.current) {
            inlineAddRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [inlineAddMode]);

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

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data?.categories || res.data || []);
        } catch (e) {
            console.log('[Products] Could not load categories');
        }
    };

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

    // Save viewMode to localStorage
    useEffect(() => { localStorage.setItem('products_viewMode', viewMode); }, [viewMode]);
    useEffect(() => { localStorage.setItem('products_perPage', itemsPerPage); }, [itemsPerPage]);

    // Reset page on filter change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategoryId, onlyInStock, priceMin, priceMax, dateFrom, dateTo, stockMin, stockMax, showLowStockOnly, sortField, sortDirection]);

    // Sort handler
    const handleSort = useCallback((field) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }, [sortField]);

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ArrowUp size={10} style={{ opacity: 0.2 }} />;
        return sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
    };

    // Clear all filters
    const clearFilters = () => {
        setPriceMin(''); setPriceMax(''); setDateFrom(''); setDateTo('');
        setStockMin(''); setStockMax(''); setShowLowStockOnly(false);
    };

    // Update min_stock inline
    const handleUpdateMinStock = async (productId, newMinStock) => {
        try {
            await api.post('/products/bulk-update-min-stock', { updates: [{ id: productId, min_stock: newMinStock }] });
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, min_stock: newMinStock } : p));
            toast.success('Мин. остаток обновлён');
        } catch (e) {
            toast.error('Ошибка обновления');
        }
    };

    // Фильтрация по категории, поиску, остаткам, ценам, датам
    const filteredProducts = useMemo(() => {
        let result = products;

        // Поиск по названию или коду
        if (searchTerm.trim()) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(p => 
                (p.name && p.name.toLowerCase().includes(lowSearch)) || 
                (p.code && p.code.toLowerCase().includes(lowSearch)) ||
                (p.barcode && p.barcode.includes(lowSearch))
            );
        }

        // Категория
        if (selectedCategoryId !== null) {
            if (selectedCategoryId === 0) {
                result = result.filter(p => !p.category_id);
            } else {
                result = result.filter(p => p.category_id === selectedCategoryId);
            }
        }

        // Только в наличии
        if (onlyInStock) {
            result = result.filter(p => (Number(p.quantity) || 0) > 0);
        }

        // Фильтр по цене продажи
        if (priceMin !== '') result = result.filter(p => (Number(p.price_sale) || 0) >= Number(priceMin));
        if (priceMax !== '') result = result.filter(p => (Number(p.price_sale) || 0) <= Number(priceMax));

        // Фильтр по дате добавления
        if (dateFrom) result = result.filter(p => p.created_at && p.created_at >= dateFrom);
        if (dateTo) result = result.filter(p => p.created_at && p.created_at.slice(0, 10) <= dateTo);

        // Фильтр по остаткам
        if (stockMin !== '') result = result.filter(p => (Number(p.quantity) || 0) >= Number(stockMin));
        if (stockMax !== '') result = result.filter(p => (Number(p.quantity) || 0) <= Number(stockMax));

        // Только с низкими остатками
        if (showLowStockOnly) {
            result = result.filter(p => {
                const ms = Number(p.min_stock) || 0;
                return ms > 0 && (Number(p.quantity) || 0) <= ms;
            });
        }

        // Сортировка
        if (sortField) {
            result = [...result].sort((a, b) => {
                let va = a[sortField], vb = b[sortField];
                if (['price_purchase', 'price_sale', 'price_retail', 'quantity', 'min_stock', 'vat_rate'].includes(sortField)) {
                    va = Number(va) || 0; vb = Number(vb) || 0;
                } else if (sortField === 'created_at') {
                    va = va || ''; vb = vb || '';
                } else {
                    va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase();
                }
                if (va < vb) return sortDirection === 'asc' ? -1 : 1;
                if (va > vb) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [products, selectedCategoryId, onlyInStock, searchTerm, priceMin, priceMax, dateFrom, dateTo, stockMin, stockMax, showLowStockOnly, sortField, sortDirection]);

    // Пагинация
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = useMemo(() => {
        if (itemsPerPage >= filteredProducts.length) return filteredProducts;
        const start = (currentPage - 1) * itemsPerPage;
        return filteredProducts.slice(start, start + itemsPerPage);
    }, [filteredProducts, currentPage, itemsPerPage]);

    // Подсчёт товаров по категориям
    const categoryCounts = useMemo(() => {
        const counts = { all: products.length, uncategorized: 0 };
        products.forEach(p => {
            if (!p.category_id) counts.uncategorized++;
            else counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        });
        return counts;
    }, [products]);

    // Количество товаров с низкими остатками (для badge)
    const lowStockCount = useMemo(() => {
        return products.filter(p => {
            const ms = Number(p.min_stock) || 0;
            return ms > 0 && (Number(p.quantity) || 0) <= ms;
        }).length;
    }, [products]);

    // Общая стоимость товаров
    const totalValues = useMemo(() => {
        const list = selectedCategoryId === null ? products : filteredProducts;
        let purchase = 0, sale = 0, qty = 0;
        list.forEach(p => {
            const q = Number(p.quantity) || 0;
            purchase += (Number(p.price_purchase) || 0) * q;
            sale += (Number(p.price_sale) || 0) * q;
            qty += q;
        });
        return { purchase, sale, qty, count: list.length };
    }, [products, filteredProducts, selectedCategoryId]);

    // Создание новой категории
    const handleCreateCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        try {
            const res = await api.post('/categories', { name });
            const newCat = res.data;
            setCategories(prev => [...prev, newCat]);
            setFormData({ ...formData, categoryId: newCat.id });
            setNewCategoryName('');
            toast.success(`Категория "${name}" создана`);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Ошибка создания категории');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingProduct) {
                await productsAPI.update(editingProduct.id, formData);
                handleSuccess('Товар успешно обновлён!');
            } else {
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
            setInlineEditId(null);
            setInlineAddMode(false);
            resetForm();
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('[PRODUCTS] Error saving:', error);
            handleError(error.response?.data?.error || 'Ошибка сохранения товара');
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setInlineEditId(product.id);
        setFormData({
            code: product.code,
            name: product.name,
            categoryId: product.category_id,
            unit: product.unit,
            pricePurchase: product.price_purchase,
            priceSale: product.price_sale,
            priceRetail: product.price_retail,
            vatRate: product.vat_rate,
            quantity: product.quantity || 0,
            minStock: product.min_stock || 0,
            supplier: product.supplier || '',
            description: product.description || '',
            barcode: product.barcode || '',
            isActive: product.is_active !== false
        });
    };

    const cancelInlineEdit = () => {
        setInlineEditId(null);
        setEditingProduct(null);
        resetForm();
    };

    const cancelInlineAdd = () => {
        setInlineAddMode(false);
        resetForm();
    };

    // ── Групповое удаление ──
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const [bulkDeleteProgress, setBulkDeleteProgress] = useState(null); // { total, done, deleting }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = window.confirm(
            `Вы уверены, что хотите удалить ${selectedIds.size} товар(ов)? Это действие необратимо.\n\nВсе связанные данные (остатки, продажи, закупки) также будут удалены.`
        );
        if (!confirmed) return;

        const idsArr = [...selectedIds];
        setBulkDeleteProgress({ total: idsArr.length, done: 0, deleting: true });

        try {
            const response = await api.post('/products/bulk-delete', { ids: idsArr });
            const data = response.data;

            setBulkDeleteProgress({ total: idsArr.length, done: data.deleted, deleting: false });
            setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());

            setTimeout(() => setBulkDeleteProgress(null), 2000);

            if (data.failed > 0) {
                toast.warning(`Удалено ${data.deleted} из ${idsArr.length}. Ошибок: ${data.failed}`);
            } else {
                toast.success(`Удалено ${data.deleted} товар(ов)`);
            }
            // Always refresh from server to ensure stats and lists are 100% sync
            loadProducts();
        } catch (error) {
            console.error('Ошибка группового удаления:', error);
            setBulkDeleteProgress(null);
            toast.error(error.response?.data?.error || 'Ошибка при удалении');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm('Вы уверены, что хотите удалить этот товар?');
        if (!confirmed) return;

        try {
            console.log('[PRODUCTS] Deleting product:', id);
            await productsAPI.delete(id);
            setProducts(prev => prev.filter(p => p.id !== id));
            setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            toast.success('Товар удален успешно');
        } catch (error) {
            console.error('Ошибка удаления товара:', error);
            toast.error(error.response?.data?.error || 'Ошибка удаления товара');
        }
    };

    // Callback после успешного импорта — перезагружаем список товаров
    const handleImportComplete = (result) => {
        console.log('[Products] Import complete:', result);
        setRefreshTrigger(prev => prev + 1);
        toast.success(`Импортировано: ${result.imported || 0}, обновлено: ${result.updated || 0}`);
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
            quantity: 0,
            minStock: 0,
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
            {/* ── Вкладки ── */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid var(--bg-secondary, #1e1e2e)' }}>
                <button onClick={() => setActiveTab('products')} style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'products' ? 700 : 400, color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-secondary, #aaa)', background: 'none', borderBottom: activeTab === 'products' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s' }}>
                    📦 {t('products.title')}
                </button>
                <button onClick={() => setActiveTab('lowstock')} style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'lowstock' ? 700 : 400, color: activeTab === 'lowstock' ? '#f59e0b' : 'var(--text-secondary, #aaa)', background: 'none', borderBottom: activeTab === 'lowstock' ? '2px solid #f59e0b' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.2s', position: 'relative' }}>
                    ⚠️ Мин. остатки
                    {lowStockCount > 0 && <span style={{ position: 'absolute', top: '4px', right: '2px', background: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{lowStockCount}</span>}
                </button>
            </div>

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
                        onImport={handleImportComplete}
                        buttonText="Импорт"
                    />
                    <button
                        className={`btn ${inlineAddMode ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => {
                            if (inlineAddMode) {
                                cancelInlineAdd();
                            } else {
                                setInlineEditId(null);
                                setEditingProduct(null);
                                setFormData({
                                    code: generateProductCode(),
                                    name: '',
                                    categoryId: selectedCategoryId > 0 ? selectedCategoryId : null,
                                    unit: 'шт',
                                    pricePurchase: 0,
                                    priceSale: 0,
                                    priceRetail: 0,
                                    vatRate: 12,
                                    quantity: 0,
                                    minStock: 0,
                                    description: '',
                                    barcode: generateBarcode()
                                });
                                setInlineAddMode(true);
                            }
                        }}
                    >
                        {inlineAddMode ? <X size={20} /> : <Plus size={20} />}
                        {inlineAddMode ? 'Отмена' : t('products.addProduct')}
                    </button>
                </div>
            </div>

            <div className="card mb-3">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '12px' }}>
                    <div className="search-bar" style={{ flex: 1, margin: 0, minWidth: '200px' }}>
                        <Search size={18} />
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }} onClick={() => setOnlyInStock(!onlyInStock)}>
                        <input type="checkbox" checked={onlyInStock} onChange={() => {}} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary, #aaa)' }}>В наличии</span>
                    </div>

                    {/* Кнопка фильтров */}
                    <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(!showFilters)} style={{ fontSize: '12px' }}>
                        <Filter size={14} /> Фильтры
                    </button>

                    {/* Переключатель режимов отображения (8 режимов) */}
                    <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '6px', padding: '2px', flexWrap: 'wrap' }}>
                        {[
                            { mode: 'icons-huge', icon: '🖼️', title: 'Огромные значки' },
                            { mode: 'icons-large', icon: '🔲', title: 'Крупные значки' },
                            { mode: 'icons', icon: <Grid3X3 size={14} />, title: 'Обычные значки' },
                            { mode: 'icons-small', icon: '▪️', title: 'Мелкие значки' },
                            { mode: 'list', icon: <List size={14} />, title: 'Список' },
                            { mode: 'table', icon: <Table2 size={14} />, title: 'Таблица' },
                            { mode: 'grid', icon: <LayoutGrid size={14} />, title: 'Плитка' },
                            { mode: 'content', icon: <Eye size={14} />, title: 'Содержимое' },
                        ].map(v => (
                            <button key={v.mode} onClick={() => setViewMode(v.mode)} title={v.title} style={{ padding: '5px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: viewMode === v.mode ? 'var(--primary)' : 'transparent', color: viewMode === v.mode ? '#fff' : 'var(--text-secondary, #aaa)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                                {v.icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Панель расширенных фильтров */}
                {showFilters && (
                    <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '3px' }}>Цена продажи</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input type="number" placeholder="от" value={priceMin} onChange={e => setPriceMin(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                                <input type="number" placeholder="до" value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '3px' }}>Дата добавления</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '3px' }}>Остаток</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input type="number" placeholder="от" value={stockMin} onChange={e => setStockMin(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                                <input type="number" placeholder="до" value={stockMax} onChange={e => setStockMax(e.target.value)} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#f59e0b' }}>
                                <input type="checkbox" checked={showLowStockOnly} onChange={e => setShowLowStockOnly(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                                ⚠️ Ниже минимума
                            </label>
                            <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ fontSize: '11px', marginLeft: 'auto' }}>
                                <X size={12} /> Сбросить
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {activeTab === 'products' && (<>
            {/* Категории — папки */}
            {categories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <button
                        onClick={() => setSelectedCategoryId(null)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: selectedCategoryId === null ? 700 : 400,
                            background: selectedCategoryId === null ? 'var(--primary)' : 'var(--bg-secondary, #1e1e2e)',
                            color: selectedCategoryId === null ? '#fff' : 'var(--text-secondary, #aaa)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FolderOpen size={14} /> Все ({categoryCounts.all})
                    </button>
                    <button
                        onClick={() => setSelectedCategoryId(0)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: selectedCategoryId === 0 ? 700 : 400,
                            background: selectedCategoryId === 0 ? 'var(--primary)' : 'var(--bg-secondary, #1e1e2e)',
                            color: selectedCategoryId === 0 ? '#fff' : 'var(--text-secondary, #aaa)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Folder size={14} /> Без категории ({categoryCounts.uncategorized})
                    </button>
                    {categories.map(cat => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            <button
                                onClick={() => setSelectedCategoryId(cat.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 28px 6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                    fontSize: '12px', fontWeight: selectedCategoryId === cat.id ? 700 : 400,
                                    background: selectedCategoryId === cat.id ? 'var(--primary)' : 'var(--bg-secondary, #1e1e2e)',
                                    color: selectedCategoryId === cat.id ? '#fff' : 'var(--text-secondary, #aaa)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Folder size={14} /> {cat.name} ({categoryCounts[cat.id] || 0})
                            </button>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!window.confirm(`Удалить категорию "${cat.name}"?\n\nТовары будут перемещены в "Без категории".`)) return;
                                    try {
                                        await api.delete(`/categories/${cat.id}`);
                                        setCategories(prev => prev.filter(c => c.id !== cat.id));
                                        if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
                                        setRefreshTrigger(prev => prev + 1);
                                        toast.success('Категория удалена');
                                    } catch (e) {
                                        toast.error(e.response?.data?.error || 'Ошибка удаления');
                                    }
                                }}
                                title="Удалить категорию"
                                style={{
                                    position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#ff6666', fontSize: '14px', fontWeight: 700,
                                    padding: '0 4px', lineHeight: 1, opacity: 0.6
                                }}
                                onMouseEnter={e => e.target.style.opacity = 1}
                                onMouseLeave={e => e.target.style.opacity = 0.6}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Общая стоимость */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', padding: '8px 14px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '8px', fontSize: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Товаров: <strong style={{ color: '#fff' }}>{totalValues.count}</strong></span>
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Остаток: <strong style={{ color: '#fff' }}>{totalValues.qty}</strong></span>
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Закупка: <strong style={{ color: '#f59e0b' }}>{formatCurrency(totalValues.purchase)}</strong></span>
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Продажа: <strong style={{ color: '#10b981' }}>{formatCurrency(totalValues.sale)}</strong></span>
                <span style={{ color: 'var(--text-secondary, #aaa)' }}>Прибыль: <strong style={{ color: totalValues.sale - totalValues.purchase >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(totalValues.sale - totalValues.purchase)}</strong></span>
            </div>

            {/* ── Панель группового удаления ── */}
            {selectedIds.size > 0 && (
                <div style={{
                    position: 'sticky', top: '60px', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, rgba(255,60,60,0.15), rgba(180,0,0,0.1))',
                    border: '1px solid rgba(255,80,80,0.4)',
                    borderRadius: '8px', padding: '10px 16px', marginBottom: '8px',
                    backdropFilter: 'blur(8px)'
                }}>
                    <span style={{ color: '#ff8080', fontWeight: 600, fontSize: '13px' }}>
                        ✓ Выбрано: <strong>{selectedIds.size}</strong> товар(ов)
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Перемещение в категорию */}
                        {showMoveCategory ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select
                                    value={moveCategoryId}
                                    onChange={e => setMoveCategoryId(e.target.value)}
                                    style={{ fontSize: '12px', padding: '4px 8px', minWidth: '140px' }}
                                >
                                    <option value="">Без категории</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: '12px' }}
                                    onClick={async () => {
                                        try {
                                            const res = await api.post('/products/bulk-move-category', {
                                                ids: [...selectedIds],
                                                categoryId: moveCategoryId ? parseInt(moveCategoryId) : null
                                            });
                                            toast.success(res.data.message);
                                            setSelectedIds(new Set());
                                            setShowMoveCategory(false);
                                            setRefreshTrigger(prev => prev + 1);
                                        } catch (e) {
                                            toast.error(e.response?.data?.error || 'Ошибка перемещения');
                                        }
                                    }}
                                >
                                    <Check size={12} /> Переместить
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowMoveCategory(false)} style={{ fontSize: '12px' }}>
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-info btn-sm"
                                onClick={() => setShowMoveCategory(true)}
                                style={{ fontSize: '12px' }}
                            >
                                <Move size={14} /> В категорию
                            </button>
                        )}
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedIds(new Set()); setShowMoveCategory(false); }}
                            style={{ fontSize: '12px' }}
                        >
                            <X size={14} /> Снять
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleBulkDelete}
                            style={{ fontSize: '12px', fontWeight: 600 }}
                        >
                            <Trash2 size={14} /> Удалить ({selectedIds.size})
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'table' && (
            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : (products.length === 0 && !inlineAddMode) ? (
                    <div className="empty-state">
                        <Package size={64} className="text-muted" />
                        <h3>{t('products.noProducts')}</h3>
                        <p className="text-muted">{t('products.addFirst', 'Добавьте первый товар для начала работы')}</p>
                    </div>
                ) : (
                    <table style={{ fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '32px', textAlign: 'center' }}>
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length} title="Выбрать все" style={{ cursor: 'pointer', width: '14px', height: '14px' }} />
                                </th>
                                <th>№</th>
                                <th onClick={() => handleSort('code')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.code')} <SortIcon field="code" /></th>
                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.name')} <SortIcon field="name" /></th>
                                <th onClick={() => handleSort('category_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.category')} <SortIcon field="category_name" /></th>
                                <th>{t('products.unit')}</th>
                                <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.quantity')} <SortIcon field="quantity" /></th>
                                <th onClick={() => handleSort('price_purchase')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.pricePurchase')} <SortIcon field="price_purchase" /></th>
                                <th onClick={() => handleSort('price_sale')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.priceSale')} <SortIcon field="price_sale" /></th>
                                <th onClick={() => handleSort('price_retail')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('products.priceRetail', 'Розница')} <SortIcon field="price_retail" /></th>
                                <th>{t('common.status')}</th>
                                <th>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ── Inline форма добавления нового товара ── */}
                            {inlineAddMode && (
                                <tr ref={inlineAddRef}>
                                    <td colSpan="12" style={{ padding: '12px 14px', background: 'rgba(0,255,136,0.06)', borderLeft: '3px solid #00ff88' }}>
                                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <strong style={{ fontSize: '13px', color: '#00ff88' }}>✚ Новый товар</strong>
                                                <button type="button" onClick={cancelInlineAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '2px' }}><X size={16} /></button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Код</label><input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Авто" style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Наименование *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Штрихкод</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Авто EAN-13" style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Цена закупки</label><input type="number" step="0.01" value={formData.pricePurchase} onChange={e => setFormData({...formData, pricePurchase: parseFloat(e.target.value)||0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Цена продажи</label><input type="number" step="0.01" value={formData.priceSale} onChange={e => setFormData({...formData, priceSale: parseFloat(e.target.value)||0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Розница</label><input type="number" step="0.01" value={formData.priceRetail} onChange={e => setFormData({...formData, priceRetail: parseFloat(e.target.value)||0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Кол-во</label><input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)||0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>НДС %</label><input type="number" value={formData.vatRate} onChange={e => setFormData({...formData, vatRate: parseFloat(e.target.value)||0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Категория</label>
                                                    <select value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value ? parseInt(e.target.value) : null})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }}>
                                                        <option value="">Без категории</option>
                                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Новая категория</label>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Название..." style={{ flex: 1, fontSize: '12px', padding: '4px 6px' }} />
                                                        <button type="button" className="btn btn-success btn-sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim()} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                                            <PlusCircle size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Ед. измерения</label>
                                                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }}>
                                                        <option value="шт">шт</option><option value="кг">кг</option><option value="л">л</option><option value="м">м</option><option value="упак">упак</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={cancelInlineAdd} style={{ fontSize: '12px', padding: '4px 12px' }}><X size={12} /> Отмена</button>
                                                <button type="submit" className="btn btn-success btn-sm" style={{ fontSize: '12px', padding: '4px 14px' }}><Check size={12} /> Создать товар</button>
                                            </div>
                                        </form>
                                    </td>
                                </tr>
                            )}
                            {paginatedProducts.map((product, idx) => (
                                <React.Fragment key={product.id}>
                                <tr style={{ lineHeight: '1.2', background: selectedIds.has(product.id) ? 'rgba(255,80,80,0.08)' : (!product.is_active ? 'rgba(255,255,255,0.03)' : undefined), opacity: product.is_active ? 1 : 0.5 }}>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => handleSelectOne(product.id)} style={{ cursor: 'pointer', width: '14px', height: '14px' }} />
                                    </td>
                                    <td style={{ padding: '6px 8px', color: '#666', fontSize: '11px' }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td style={{ padding: '6px 8px' }}><code style={{ fontSize: '11px' }}>{product.code}</code></td>
                                    <td style={{ padding: '6px 8px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}><strong>{product.name}</strong></td>
                                    <td style={{ padding: '6px 8px' }}>{product.category_name || '—'}</td>
                                    <td style={{ padding: '6px 8px' }}>{product.unit}</td>
                                    <td style={{ padding: '6px 8px' }}><strong>{product.quantity || 0}</strong></td>
                                    <td style={{ padding: '6px 8px' }}>{formatCurrency(product.price_purchase)}</td>
                                    <td style={{ padding: '6px 8px' }}>{formatCurrency(product.price_sale)}</td>
                                    <td style={{ padding: '6px 8px' }}>{formatCurrency(product.price_retail)}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                        <button
                                            className={`btn btn-sm ${product.is_active ? 'btn-success' : 'btn-danger'}`}
                                            onClick={async () => {
                                                try {
                                                    const res = await api.patch(`/products/${product.id}/toggle-active`);
                                                    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: res.data.product.is_active } : p));
                                                    toast.success(res.data.message);
                                                } catch (e) {
                                                    toast.error('Ошибка');
                                                }
                                            }}
                                            title={product.is_active ? 'Деактивировать' : 'Активировать'}
                                            style={{ padding: '2px 6px', fontSize: '10px' }}
                                        >
                                            {product.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        </button>
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                        <div className="action-buttons" style={{ gap: '3px' }}>
                                            <button className="btn btn-info btn-sm" onClick={() => { setSelectedProductForBarcode(product); setShowBarcodeModal(true); }} title="Штрихкод" style={{ padding: '3px 5px' }}><Barcode size={12} /></button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(product)} title="Редактировать" style={{ padding: '3px 5px' }}><Edit size={12} /></button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)} title="Удалить" style={{ padding: '3px 5px' }}><Trash2 size={12} /></button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Inline edit row */}
                                {inlineEditId === product.id && (
                                    <tr ref={inlineEditRef}>
                                        <td colSpan="12" style={{ padding: '10px 12px', background: 'var(--bg-secondary, #1a1a2e)', borderLeft: '3px solid var(--primary)' }}>
                                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <strong style={{ fontSize: '13px' }}>✏️ Редактирование: {product.name}</strong>
                                                    <button type="button" onClick={cancelInlineEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '2px' }}><X size={16} /></button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Код</label><input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Наименование</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Штрихкод</label><input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Цена закупки</label><input type="number" step="0.01" value={formData.pricePurchase} onChange={e => setFormData({...formData, pricePurchase: parseFloat(e.target.value)})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Цена продажи</label><input type="number" step="0.01" value={formData.priceSale} onChange={e => setFormData({...formData, priceSale: parseFloat(e.target.value)})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Розница</label><input type="number" step="0.01" value={formData.priceRetail} onChange={e => setFormData({...formData, priceRetail: parseFloat(e.target.value)})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>НДС %</label><input type="number" value={formData.vatRate} onChange={e => setFormData({...formData, vatRate: parseFloat(e.target.value)})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Кол-во (остаток)</label><input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Мин. остаток</label><input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseInt(e.target.value) || 0})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                    <div><label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Поставщик</label><input type="text" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Название поставщика" style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }} /></div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Категория</label>
                                                        <select value={formData.categoryId || ''} onChange={e => setFormData({...formData, categoryId: e.target.value ? parseInt(e.target.value) : null})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }}>
                                                            <option value="">Без категории</option>
                                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>Ед. измерения</label>
                                                        <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} style={{ width: '100%', fontSize: '12px', padding: '4px 6px' }}>
                                                            <option value="шт">шт</option><option value="кг">кг</option><option value="л">л</option><option value="м">м</option><option value="упак">упак</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                                    <button type="button" className="btn btn-secondary btn-sm" onClick={cancelInlineEdit} style={{ fontSize: '12px', padding: '4px 12px' }}><X size={12} /> Отмена</button>
                                                    <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: '12px', padding: '4px 12px' }}><Check size={12} /> Сохранить</button>
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            )}

            {/* ── Grid/List/Icons views ── */}
            {viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    {paginatedProducts.map(product => (
                        <div key={product.id} style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => handleEdit(product)}>
                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{product.code}</div>
                            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', lineHeight: 1.3 }}>{product.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                <span style={{ color: '#aaa' }}>Остаток</span>
                                <strong style={{ color: (Number(product.quantity)||0) <= (Number(product.min_stock)||0) && (Number(product.min_stock)||0) > 0 ? '#ef4444' : '#10b981' }}>{product.quantity || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#aaa' }}>Цена</span>
                                <strong style={{ color: '#f59e0b' }}>{formatCurrency(product.price_sale)}</strong>
                            </div>
                            {product.category_name && <div style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>📁 {product.category_name}</div>}
                        </div>
                    ))}
                </div>
            )}

            {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {paginatedProducts.map((product, idx) => (
                        <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 14px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '6px', fontSize: '13px' }}>
                            <span style={{ color: '#666', width: '30px', fontSize: '11px' }}>{(currentPage-1)*itemsPerPage+idx+1}</span>
                            <code style={{ fontSize: '11px', color: '#888', width: '80px' }}>{product.code}</code>
                            <strong style={{ flex: 1 }}>{product.name}</strong>
                            <span style={{ width: '60px', textAlign: 'right' }}>{product.quantity || 0}</span>
                            <span style={{ width: '100px', textAlign: 'right', color: '#f59e0b' }}>{formatCurrency(product.price_sale)}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(product)} style={{ padding: '2px 5px' }}><Edit size={12} /></button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(product.id)} style={{ padding: '2px 5px' }}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {viewMode === 'icons' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginTop: '8px' }}>
                    {paginatedProducts.map(product => (
                        <div key={product.id} style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => handleEdit(product)}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={28} style={{ color: 'var(--primary)' }} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(product.price_sale)}</div>
                            <div style={{ fontSize: '11px', color: (Number(product.quantity)||0) <= (Number(product.min_stock)||0) && (Number(product.min_stock)||0) > 0 ? '#ef4444' : '#888', marginTop: '4px' }}>Ост: {product.quantity || 0}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Огромные значки (256px) ── */}
            {viewMode === 'icons-huge' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginTop: '8px' }}>
                    {paginatedProducts.map(product => (
                        <div key={product.id} style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '16px', padding: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => handleEdit(product)}
                             onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.2)'; }}
                             onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                            <div style={{ width: '120px', height: '120px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={56} style={{ color: 'var(--primary)' }} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px', lineHeight: 1.3 }}>{product.name}</div>
                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>{product.code}</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>{formatCurrency(product.price_sale)}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', marginTop: '8px' }}>
                                <span style={{ color: '#aaa' }}>Ост: <strong style={{ color: (Number(product.quantity)||0) <= (Number(product.min_stock)||0) && (Number(product.min_stock)||0) > 0 ? '#ef4444' : '#10b981' }}>{product.quantity || 0}</strong></span>
                                {product.category_name && <span style={{ color: '#666' }}>📁 {product.category_name}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Крупные значки (128px) ── */}
            {viewMode === 'icons-large' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '8px' }}>
                    {paginatedProducts.map(product => (
                        <div key={product.id} style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s ease' }} onClick={() => handleEdit(product)}
                             onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                             onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={38} style={{ color: 'var(--primary)' }} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(product.price_sale)}</div>
                            <div style={{ fontSize: '11px', color: (Number(product.quantity)||0) <= (Number(product.min_stock)||0) && (Number(product.min_stock)||0) > 0 ? '#ef4444' : '#888', marginTop: '4px' }}>Ост: {product.quantity || 0}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Мелкие значки (32px) ── */}
            {viewMode === 'icons-small' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {paginatedProducts.map(product => (
                        <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.04)', transition: 'all 0.15s', minWidth: '180px', maxWidth: '260px' }} onClick={() => handleEdit(product)}
                             onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                             onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary, #1e1e2e)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Package size={12} style={{ color: 'var(--primary)' }} />
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{product.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Содержимое (детальный список) ── */}
            {viewMode === 'content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {paginatedProducts.map((product, idx) => (
                        <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleEdit(product)}
                             onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                             onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                            {/* Иконка */}
                            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Package size={24} style={{ color: 'var(--primary)' }} />
                            </div>
                            {/* Основная инфо */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                    <strong style={{ fontSize: '14px' }}>{product.name}</strong>
                                    <code style={{ fontSize: '10px', color: '#666', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' }}>{product.code}</code>
                                </div>
                                <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#888', flexWrap: 'wrap' }}>
                                    {product.category_name && <span>📁 {product.category_name}</span>}
                                    {product.barcode && <span>🏷️ {product.barcode}</span>}
                                    <span>📦 {product.unit}</span>
                                    {product.description && <span style={{ opacity: 0.7, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {product.description}</span>}
                                </div>
                            </div>
                            {/* Цены */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(product.price_sale)}</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>Закуп: {formatCurrency(product.price_purchase)}</div>
                            </div>
                            {/* Остаток */}
                            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '60px' }}>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: (Number(product.quantity)||0) <= (Number(product.min_stock)||0) && (Number(product.min_stock)||0) > 0 ? '#ef4444' : '#10b981' }}>{product.quantity || 0}</div>
                                <div style={{ fontSize: '10px', color: '#666' }}>остаток</div>
                            </div>
                            {/* Действия */}
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleEdit(product); }} style={{ padding: '4px 6px' }}><Edit size={12} /></button>
                                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} style={{ padding: '4px 6px' }}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Пагинация ── */}
            {filteredProducts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginTop: '8px', background: 'var(--bg-secondary, #1e1e2e)', borderRadius: '8px', fontSize: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ color: '#aaa' }}>Показано {Math.min((currentPage-1)*itemsPerPage+1, filteredProducts.length)}–{Math.min(currentPage*itemsPerPage, filteredProducts.length)} из <strong style={{ color: '#fff' }}>{filteredProducts.length}</strong></span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p-1)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}><ChevronLeft size={14} /></button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let page;
                            if (totalPages <= 7) page = i + 1;
                            else if (currentPage <= 4) page = i + 1;
                            else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                            else page = currentPage - 3 + i;
                            return (
                                <button key={page} onClick={() => setCurrentPage(page)} style={{ padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: currentPage === page ? 700 : 400, background: currentPage === page ? 'var(--primary)' : 'transparent', color: currentPage === page ? '#fff' : '#aaa' }}>{page}</button>
                            );
                        })}
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p+1)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}><ChevronRight size={14} /></button>
                    </div>
                    <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ fontSize: '12px', padding: '4px 8px' }}>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={99999}>Все</option>
                    </select>
                </div>
            )}
            </>)}

            {/* ── Вкладка «Мин. остатки» ── */}
            {activeTab === 'lowstock' && (
                <div className="card">
                    <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 style={{ margin: 0, fontSize: '15px' }}>⚠️ Мониторинг минимальных остатков</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#aaa' }}>Товары с установленным лимитом. Настройте мин. остаток для предупреждений.</p>
                    </div>
                    <table style={{ fontSize: '12px' }}>
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>Код</th>
                                <th>Наименование</th>
                                <th>Категория</th>
                                <th>Текущий остаток</th>
                                <th>Мин. остаток</th>
                                <th>Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product, idx) => {
                                const qty = Number(product.quantity) || 0;
                                const ms = Number(product.min_stock) || 0;
                                let status, statusColor;
                                if (ms === 0) { status = '—'; statusColor = '#666'; }
                                else if (qty <= ms) { status = '🔴 Ниже минимума'; statusColor = '#ef4444'; }
                                else if (qty <= ms * 1.2) { status = '🟡 На грани'; statusColor = '#f59e0b'; }
                                else { status = '🟢 Достаточно'; statusColor = '#10b981'; }
                                return (
                                    <tr key={product.id} style={{ background: ms > 0 && qty <= ms ? 'rgba(239,68,68,0.06)' : undefined }}>
                                        <td style={{ padding: '6px 8px', color: '#666' }}>{idx + 1}</td>
                                        <td style={{ padding: '6px 8px' }}><code style={{ fontSize: '11px' }}>{product.code}</code></td>
                                        <td style={{ padding: '6px 8px' }}><strong>{product.name}</strong></td>
                                        <td style={{ padding: '6px 8px' }}>{product.category_name || '—'}</td>
                                        <td style={{ padding: '6px 8px', fontWeight: 600, color: ms > 0 && qty <= ms ? '#ef4444' : '#fff' }}>{qty}</td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <input type="number" min="0" value={ms} onChange={e => handleUpdateMinStock(product.id, parseInt(e.target.value) || 0)} onBlur={e => handleUpdateMinStock(product.id, parseInt(e.target.value) || 0)} style={{ width: '70px', fontSize: '12px', padding: '3px 6px', textAlign: 'center' }} />
                                        </td>
                                        <td style={{ padding: '6px 8px', color: statusColor, fontSize: '11px', fontWeight: 500 }}>{status}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

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

                                <div className="form-group">
                                    <label>{t('products.category', 'Категория')}</label>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <select
                                            value={formData.categoryId || ''}
                                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? parseInt(e.target.value) : null })}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">{t('products.bez_kategorii', 'Без категории')}</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="Новая категория..."
                                            style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm"
                                            onClick={handleCreateCategory}
                                            disabled={!newCategoryName.trim()}
                                            title="Добавить категорию"
                                            style={{ padding: '6px 10px' }}
                                        >
                                            <PlusCircle size={14} /> Добавить
                                        </button>
                                    </div>
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

                                <div className="grid grid-2">
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
                                        <label>{t('products.min_stock', 'Мин. остаток')}</label>
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            value={formData.minStock}
                                            onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                        />
                                    </div>
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

            {/* Прогресс группового удаления */}
            {bulkDeleteProgress && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-primary, #1a1a2e)',
                        border: '1px solid rgba(255,80,80,0.4)',
                        borderRadius: '12px', padding: '32px 40px',
                        textAlign: 'center', minWidth: '340px',
                        boxShadow: '0 8px 32px rgba(255,0,0,0.2)'
                    }}>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                            {bulkDeleteProgress.deleting ? '🗑️' : '✅'}
                        </div>
                        <h3 style={{ margin: '0 0 8px', color: bulkDeleteProgress.deleting ? '#ff8080' : '#10b981' }}>
                            {bulkDeleteProgress.deleting ? 'Удаление товаров...' : 'Удаление завершено!'}
                        </h3>
                        <p style={{ color: '#aaa', margin: '0 0 16px', fontSize: '14px' }}>
                            {bulkDeleteProgress.deleting
                                ? `Удаляется ${bulkDeleteProgress.total} товар(ов)...`
                                : `Удалено ${bulkDeleteProgress.done} из ${bulkDeleteProgress.total}`
                            }
                        </p>
                        {bulkDeleteProgress.deleting && (
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #ff4444, #ff8800)',
                                    borderRadius: '3px',
                                    width: '60%',
                                    animation: 'bulkDeletePulse 1.5s ease-in-out infinite'
                                }} />
                            </div>
                        )}
                        <style>{`@keyframes bulkDeletePulse { 0%,100% { width: 30%; opacity: 0.7 } 50% { width: 90%; opacity: 1 } }`}</style>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Products;
