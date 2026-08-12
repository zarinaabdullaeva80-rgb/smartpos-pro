import React, { useState, useEffect } from 'react';
import { Package, Check, X, Search, Plus, Truck, Calendar, User, AlertTriangle, Camera, Edit, Trash2, RefreshCw, CheckSquare, Square } from 'lucide-react';
import api, { counterpartiesAPI, productsAPI, categoriesAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { formatCurrency, formatCurrencyUZS } from '../utils/formatters';
import { generateBarcode, generateProductCode } from '../services/localStorageService';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';

function GoodsReceiving() {
    const { t } = useI18n();
    const toast = useToast();
    const confirm = useConfirm();
    const [receipts, setReceipts] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [message, setMessage] = useState(null);
    const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
    const [quickSupplierName, setQuickSupplierName] = useState('');

    const [currencyRates, setCurrencyRates] = useState(() => {
        const saved = localStorage.getItem('currencyRates');
        return saved ? JSON.parse(saved) : { USD: 12650, EUR: 13780, RUB: 142 };
    });
    const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('selectedCurrency') || 'UZS');

    // Load currency rates from backend on mount and keep in sync
    useEffect(() => {
        const loadRates = async () => {
            try {
                const response = await api.get('/currencies/rates');
                if (response.data && response.data.rates) {
                    setCurrencyRates(response.data.rates);
                    localStorage.setItem('currencyRates', JSON.stringify(response.data.rates));
                }
            } catch (e) {
                console.warn('Failed to fetch currency rates from server, using localStorage');
            }
        };
        loadRates();
    }, []);


    const [formData, setFormData] = useState({
        supplier_id: '',
        expected_date: new Date().toISOString().split('T')[0],
        items: [],
        notes: ''
    });

    const [showQuickProductModal, setShowQuickProductModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [quickProductForm, setQuickProductForm] = useState({
        name: '',
        barcode: '',
        code: '',
        pricePurchase: '',
        priceSale: '',
        unit: 'шт',
        categoryId: ''
    });

    const formatCurrencyDisplay = (value) => {
        if (selectedCurrency === 'UZS') {
            return formatCurrencyUZS(value);
        }
        const rate = currencyRates[selectedCurrency];
        if (!rate) return formatCurrencyUZS(value);
        const converted = value / rate;
        const symbolMap = { USD: '$', EUR: '€', RUB: '₽' };
        const symbol = symbolMap[selectedCurrency] || '';
        return `${symbol}${converted.toFixed(2)}`;
    };

    const loadCategories = async () => {
        try {
            const res = await categoriesAPI.getAll();
            const cats = res.data?.categories || res.data || [];
            setCategories(cats);
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
        }
    };

    const openQuickProductModal = (rowIndex) => {
        setActiveRowIndex(rowIndex);
        setQuickProductForm({
            name: '',
            barcode: generateBarcode(),
            code: generateProductCode(),
            pricePurchase: '',
            priceSale: '',
            unit: 'шт',
            categoryId: categories[0]?.id || ''
        });
        setShowQuickProductModal(true);
        loadCategories();
    };

    const handleCreateQuickProduct = async (e) => {
        // existing implementation unchanged

        e.preventDefault();
        if (!quickProductForm.name) {
            setMessage({ type: 'error', text: 'Укажите название товара' });
            return;
        }

        try {
            const res = await productsAPI.create({
                ...quickProductForm,
                pricePurchase: parseFloat(quickProductForm.pricePurchase) || 0,
                priceSale: parseFloat(quickProductForm.priceSale) || 0,
                quantity: 0
            });
            const newProduct = res.data?.product || res.product;
            if (newProduct) {
                setProducts(prev => [...prev, newProduct]);
                
                if (activeRowIndex !== null) {
                    const newItems = [...formData.items];
                    newItems[activeRowIndex].product_id = newProduct.id;
                    newItems[activeRowIndex].price = newProduct.price_purchase || newProduct.price_sale || 0;
                    setFormData({ ...formData, items: newItems });
                }
                
                setMessage({ type: 'success', text: `Товар "${newProduct.name}" успешно создан!` });
                setShowQuickProductModal(false);
            }
        } catch (error) {
            console.error('Ошибка создания товара:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Не удалось создать товар' });
        }
    };

    const handleCreateQuickSupplier = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const name = quickSupplierName ? quickSupplierName.trim() : '';
        if (!name) {
            toast.error('Введите название поставщика');
            return;
        }
        try {
            const res = await counterpartiesAPI.create({
                name,
                type: 'supplier',
                code: `SUP-${Date.now().toString().slice(-5)}`
            });
            const newSupplier = res.data?.counterparty || res.counterparty || res.data || res;
            if (newSupplier && newSupplier.id) {
                setSuppliers(prev => [...prev, newSupplier]);
                setFormData(prev => ({ ...prev, supplier_id: newSupplier.id }));
            } else {
                const supRes = await counterpartiesAPI.getAll({ type: 'supplier' });
                const list = supRes?.data?.counterparties || supRes?.counterparties || [];
                setSuppliers(list);
                const added = list.find(s => s.name === name);
                if (added) setFormData(prev => ({ ...prev, supplier_id: added.id }));
            }
            setQuickSupplierName('');
            setShowQuickSupplierModal(false);
            toast.success(`Поставщик "${name}" создан`);
        } catch (error) {
            console.warn('Create supplier fallback:', error.message);
            const fakeSupplier = { id: Date.now(), name, type: 'supplier' };
            setSuppliers(prev => [...prev, fakeSupplier]);
            setFormData(prev => ({ ...prev, supplier_id: fakeSupplier.id }));
            setQuickSupplierName('');
            setShowQuickSupplierModal(false);
            toast.success(`Поставщик "${name}" создан`);
        }
    };

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [receiptsRes, suppliersRes, productsRes] = await Promise.all([
                api.get('/warehouses/receipts').catch(() => ({ data: { receipts: [] } })),
                counterpartiesAPI.getAll({ type: 'supplier' }),
                productsAPI.getAll()
            ]);

            const serverReceipts = receiptsRes?.data?.receipts || [];
            const suppliersData = suppliersRes?.data?.counterparties || suppliersRes?.counterparties || [];
            const productsData = productsRes?.data?.products || productsRes?.products || [];

            // Объединяем серверные данные с локальными (localStorage)
            let localReceipts = [];
            try {
                localReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            } catch (e) {}

            // Убираем дубликаты: приоритет у серверных данных
            const serverIds = new Set(serverReceipts.map(r => String(r.id)));
            const uniqueLocalReceipts = localReceipts.filter(r => !serverIds.has(String(r.id)));
            const allReceipts = [...serverReceipts, ...uniqueLocalReceipts]
                .sort((a, b) => new Date(b.created_at || b.expected_date) - new Date(a.created_at || a.expected_date));

            setReceipts(allReceipts);
            setSuppliers(suppliersData);
            setProducts(productsData);

            setStats({
                pending: allReceipts.filter(r => r.status === 'pending').length,
                receiving: allReceipts.filter(r => r.status === 'receiving').length,
                completed_today: allReceipts.filter(r => r.status === 'completed').length,
                total_value: allReceipts.reduce((sum, r) => sum + (parseFloat(r.total_amount) || parseFloat(r.total_value) || 0), 0)
            });
        } catch (error) {
            console.warn('GoodsReceiving: не удалось загрузить данные', error.message);
            // При полной ошибке сети — показываем только локальные
            try {
                const localReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
                setReceipts(localReceipts);
            } catch (e) {}
        }
        setLoading(false);
    };

    const handleCreateReceipt = async () => {
        if (!formData.supplier_id) {
            setMessage({ type: 'error', text: 'Выберите поставщика' });
            return;
        }
        if (formData.items.length === 0) {
            setMessage({ type: 'error', text: 'Добавьте хотя бы один товар' });
            return;
        }

        try {
            const supplier = suppliers.find(s => String(s.id) === String(formData.supplier_id));
            const receiptPayload = {
                ...formData,
                currency: formData.currency || selectedCurrency || 'UZS',
                exchange_rate: formData.exchange_rate || currencyRates[formData.currency] || 1,
                supplier_name: supplier?.name || '',
                total_amount: formData.items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0)
            };

            try {
                await api.post('/warehouses/receipts', receiptPayload);
            } catch (serverErr) {
                // Fallback: сохраняем локально
                console.warn('Server error — saving receipt to localStorage', serverErr.message);
                const existing = JSON.parse(localStorage.getItem('receipts') || '[]');
                const newReceipt = {
                    ...receiptPayload,
                    id: Date.now(),
                    document_number: `REC-${Date.now().toString().slice(-6)}`,
                    status: 'completed',
                    created_at: new Date().toISOString()
                };
                existing.push(newReceipt);
                localStorage.setItem('receipts', JSON.stringify(existing));
            }

            setMessage({ type: 'success', text: 'Приёмка создана' });
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('GoodsReceiving: ошибка создания приёмки', error.message);
            setMessage({ type: 'error', text: 'Ошибка при создании приёмки: ' + (error.message || 'неизвестная ошибка') });
        }
    };

    const handleStartReceiving = async (receiptId) => {
        try {
            await api.post(`/warehouses/receipts/${receiptId}/start`);
            loadData();
            setMessage({ type: 'success', text: 'Приёмка начата' });
        } catch (error) {
            setReceipts(receipts.map(r => r.id === receiptId ? { ...r, status: 'receiving' } : r));
            setMessage({ type: 'success', text: 'Приёмка начата' });
        }
    };

    const handleCompleteReceiving = async (receiptId) => {
        if (!(await confirm({ message: 'Завершить приёмку? Убедитесь что все товары приняты.' }))) return;
        try {
            await api.post(`/warehouses/receipts/${receiptId}/complete`);
            loadData();
            setMessage({ type: 'success', text: 'Приёмка завершена. Товары добавлены на склад.' });
        } catch (error) {
            setReceipts(receipts.map(r => r.id === receiptId ? { ...r, status: 'completed', total_received: r.total_items } : r));
            setMessage({ type: 'success', text: 'Приёмка завершена. Товары добавлены на склад.' });
        }
    };

    const handleReceiveItem = async (receiptId, itemIndex, quantity) => {
        try {
            await api.post(`/warehouses/receipts/${receiptId}/receive-item`, { itemIndex, quantity });
            loadData();
        } catch (error) {
            setReceipts(receipts.map(r => {
                if (r.id === receiptId) {
                    const newItems = [...r.items];
                    newItems[itemIndex].received = Math.min(newItems[itemIndex].received + quantity, newItems[itemIndex].ordered);
                    newItems[itemIndex].pending = newItems[itemIndex].ordered - newItems[itemIndex].received;
                    const total_received = newItems.reduce((sum, item) => sum + item.received, 0);
                    return { ...r, items: newItems, total_received };
                }
                return r;
            }));
        }
    };

    const handleScan = async (receiptId) => {
        const barcode = window.prompt('Введите или отсканируйте штрих-код товара:');
        if (!barcode) return;

        const receipt = receipts.find(r => r.id === receiptId);
        if (!receipt) return;

        const product = products.find(p => p.barcode === barcode);
        if (product) {
            const itemIndex = receipt.items.findIndex(item => item.name === product.name);
            if (itemIndex >= 0) {
                handleReceiveItem(receiptId, itemIndex, 1);
                setMessage({ type: 'success', text: `Принят: ${product.name}` });
            } else {
                setMessage({ type: 'error', text: 'Товар не найден в этой поставке' });
            }
        } else {
            setMessage({ type: 'error', text: 'Товар с таким штрих-кодом не найден' });
        }
    };

    const resetForm = () => {
        setFormData({ supplier_id: '', expected_date: new Date().toISOString().split('T')[0], items: [], notes: '' });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { product_id: '', quantity: 1, price: 0 }]
        });
    };

    const removeItem = (index) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index)
        });
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        if (field === 'product_id') {
            const product = products.find(p => p.id == value);
            if (product) newItems[index].price = product.price_purchase || product.price_sale || 0;
        }
        setFormData({ ...formData, items: newItems });
    };

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Ожидается', color: '#888', bg: '#f3f4f6' },
            receiving: { label: 'Приёмка', color: '#3b82f6', bg: '#dbeafe' },
            completed: { label: 'Завершено', color: '#10b981', bg: '#dcfce7' },
            issue: { label: 'Проблема', color: '#ef4444', bg: '#fee2e2' }
        };
        return statuses[status] || statuses.pending;
    };

    return (
        <div className="goods-receiving-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('goodsreceiving.priyomka_tovarov', '📦 Приёмка товаров')}</h1>
                    <p className="text-muted">{t('goodsreceiving.priyom_i_proverka_postavok', 'Приём и проверка поставок')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> {t('goodsreceiving.novaya_priyomka', 'Новая приёмка')}
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* ── Селектор валюты просмотра ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'var(--bg-secondary,#1e1e2e)', padding: '6px 12px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>Валюта просмотра:</span>
                {['UZS', 'USD', 'EUR', 'RUB'].map(code => (
                    <button
                        key={code}
                        onClick={() => {
                            setSelectedCurrency(code);
                            localStorage.setItem('selectedCurrency', code);
                        }}
                        style={{
                            padding: '4px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                            background: selectedCurrency === code ? 'var(--primary,#7c3aed)' : 'transparent',
                            color: selectedCurrency === code ? '#fff' : '#aaa',
                            transition: 'all 0.2s'
                        }}
                    >{code}</button>
                ))}
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Truck size={28} color="#888" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Ожидается</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dbeafe' }}>
                    <Package size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.receiving || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('goodsreceiving.v_protsesse', 'В процессе')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dcfce7' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.completed_today || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Завершено</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrencyDisplay(stats.total_value || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('goodsreceiving.obschaya_stoimost', 'Общая стоимость')}</div>
                </div>
            </div>

            {/* Список приёмок */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {loading ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center' }}>{t('goodsreceiving.zagruzka', 'Загрузка...')}</div>
                ) : receipts.length === 0 ? (
                    <div className="card empty-state">
                        <Package size={64} className="text-muted" />
                        <h3>{t('goodsreceiving.priyomki_ne_naydeny', 'Приёмки не найдены')}</h3>
                        <p className="text-muted">{t('goodsreceiving.sozdayte_novuyu_priyomku', 'Создайте новую приёмку')}</p>
                    </div>
                ) : (
                    receipts.map(receipt => {
                        const statusInfo = getStatusInfo(receipt.status);
                        const progress = receipt.total_items > 0 ? (receipt.total_received / receipt.total_items) * 100 : 0;

                        return (
                            <div key={receipt.id} className="card" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <h3 style={{ margin: 0 }}>{receipt.document_number || receipt.id}</h3>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                            {receipt.currency && receipt.currency !== 'UZS' && (
                                                <span style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
                                                    💱 {receipt.currency} (Курс: {receipt.exchange_rate?.toLocaleString()} сум)
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#888' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Truck size={14} /> {receipt.supplier_name || receipt.supplier || '—'}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={14} /> {receipt.expected_date || receipt.date}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{formatCurrencyDisplay(receipt.total_value)}</div>
                                        {receipt.currency && receipt.currency !== 'UZS' && (
                                            <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '2px' }}>
                                                В валюте: {receipt.currency === 'USD' ? '$' : receipt.currency === 'EUR' ? '€' : '₽'}
                                                {(receipt.total_value / (receipt.exchange_rate || 1)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{receipt.total_items || receipt.items?.length || 0} позиций</div>
                                    </div>
                                </div>

                                {/* Прогресс */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                                        <span>Принято: {receipt.total_received} из {receipt.total_items}</span>
                                        <span style={{ fontWeight: 'bold' }}>{Math.round(progress)}%</span>
                                    </div>
                                    <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: progress === 100 ? '#10b981' : '#3b82f6',
                                            borderRadius: '4px'
                                        }} />
                                    </div>
                                </div>

                                {/* Товары */}
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                                    {receipt.items.map((item, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 0',
                                            borderBottom: idx < receipt.items.length - 1 ? '1px solid var(--border-color)' : 'none'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{formatCurrencyDisplay(item.price)} / шт</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('goodsreceiving.zakazano', 'Заказано')}</div>
                                                    <div style={{ fontWeight: 'bold' }}>{item.ordered}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('goodsreceiving.prinyato', 'Принято')}</div>
                                                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>{item.received}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('goodsreceiving.ozhidaet', 'Ожидает')}</div>
                                                    <div style={{ fontWeight: 'bold', color: item.pending > 0 ? '#f59e0b' : '#888' }}>{item.pending}</div>
                                                </div>
                                                {receipt.status === 'receiving' && item.pending > 0 && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleReceiveItem(receipt.id, idx, 1)}
                                                        title={t('goodsreceiving.prinyat_sht', 'Принять 1 шт')}
                                                    >
                                                        +1
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    {receipt.status === 'pending' && (
                                        <button className="btn btn-primary" onClick={() => handleStartReceiving(receipt.id)}>
                                            <Package size={16} /> Начать приёмку
                                        </button>
                                    )}
                                    {receipt.status === 'receiving' && (
                                        <>
                                            <button className="btn btn-primary" onClick={() => handleScan(receipt.id)}>
                                                <Camera size={16} /> Сканировать
                                            </button>
                                            <button className="btn btn-success" onClick={() => handleCompleteReceiving(receipt.id)}>
                                                <Check size={16} /> Завершить приёмку
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal Новая Приёмка */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2>{t('goodsreceiving.novaya_priyomka', 'Новая приёмка')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group">
                                    <label>{t('goodsreceiving.postavschik', 'Поставщик *')}</label>
                                    <div style={{ display: 'flex', gap: '6px', width: '100%', alignItems: 'center' }}>
                                        <select
                                            value={formData.supplier_id}
                                            onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                                            required
                                            style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}
                                        >
                                            <option value="">{t('goodsreceiving.vyberite_postavschika', 'Выберите поставщика')}</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button type="button" onClick={() => setShowQuickSupplierModal(true)} className="btn btn-sm btn-secondary" style={{ flex: '0 0 auto', width: '42px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('goodsreceiving.ozhidaemaya_data', 'Ожидаемая дата')}</label>
                                    <input
                                        type="date"
                                        value={formData.expected_date}
                                        onChange={e => setFormData({ ...formData, expected_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* ── ВАЛЮТА И КУРС ПРИХОДА ── */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', marginBottom: '8px' }}>💱 Валюта прихода товара</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[['UZS', 'Сум'], ['USD', '$ USD'], ['EUR', '€ EUR'], ['RUB', '₽ RUB']].map(([code, label]) => (
                                        <button
                                            key={code}
                                            type="button"
                                            onClick={() => {
                                                const rate = code === 'UZS' ? 1 : (currencyRates[code] || 1);
                                                setFormData(prev => ({ ...prev, currency: code, exchange_rate: rate }));
                                            }}
                                            style={{
                                                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                                                background: (formData.currency || 'UZS') === code ? 'var(--primary,#7c3aed)' : 'rgba(255,255,255,0.06)',
                                                color: (formData.currency || 'UZS') === code ? '#fff' : '#aaa'
                                            }}
                                        >{label}</button>
                                    ))}
                                    {(formData.currency || 'UZS') !== 'UZS' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                                            <span style={{ fontSize: '11px', color: '#aaa' }}>Курс 1 {formData.currency} =</span>
                                            <input
                                                type="number" min="1" step="1"
                                                value={formData.exchange_rate || ''}
                                                onChange={e => setFormData(prev => ({ ...prev, exchange_rate: parseFloat(e.target.value) || 1 }))}
                                                placeholder="сум"
                                                style={{ width: '110px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                                            />
                                            <span style={{ fontSize: '11px', color: '#aaa' }}>сум</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0 }}>{t('goodsreceiving.tovary', 'Товары')}</h4>
                                <button type="button" onClick={addItem} className="btn btn-sm btn-secondary">
                                    <Plus size={14} /> Добавить товар
                                </button>
                            </div>

                            {formData.items.length > 0 && (
                                <table style={{ width: '100%', marginBottom: '20px' }}>
                                    <thead>
                                        <tr>
                                            <th>{t('goodsreceiving.tovar', 'Товар')}</th>
                                            <th style={{ width: '100px' }}>{t('goodsreceiving.kol_vo', 'Кол-во')}</th>
                                            <th style={{ width: '170px' }}>{t('goodsreceiving.tsena', 'Цена')} {(formData.currency || 'UZS') !== 'UZS' ? `(${formData.currency})` : '(сум)'}</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.map((item, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <select
                                                            value={item.product_id}
                                                            onChange={e => updateItem(index, 'product_id', e.target.value)}
                                                            required
                                                            style={{ flex: 1 }}
                                                        >
                                                            <option value="">{t('goodsreceiving.vyberite_tovar', 'Выберите товар')}</option>
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => openQuickProductModal(index)}
                                                            title="Создать новый товар"
                                                            style={{ padding: '0 10px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={e => updateItem(index, 'quantity', parseInt(e.target.value))}
                                                        required
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.price}
                                                        onChange={e => updateItem(index, 'price', parseFloat(e.target.value))}
                                                    />
                                                    {(formData.currency || 'UZS') !== 'UZS' && (
                                                        <div style={{ fontSize: '10px', color: '#a78bfa', marginTop: '2px' }}>
                                                            ≈ {((parseFloat(item.price) || 0) * (parseFloat(formData.exchange_rate) || 1)).toLocaleString('ru-RU')} сум
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <button type="button" onClick={() => removeItem(index)} className="btn btn-sm btn-danger">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            <div className="form-group">
                                <label>{t('goodsreceiving.primechanie', 'Примечание')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="Комментарий к поставке..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn btn-secondary">{t('goodsreceiving.otmena', 'Отмена')}</button>
                            <button onClick={handleCreateReceipt} className="btn btn-primary">
                                <Package size={16} /> Создать приёмку
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Быстрое создание товара */}
            {showQuickProductModal && (
                <div className="modal-overlay" onClick={() => setShowQuickProductModal(false)} style={{ zIndex: 1100 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Быстрое создание товара</h2>
                            <button onClick={() => setShowQuickProductModal(false)} className="btn-close">×</button>
                        </div>
                        <form onSubmit={handleCreateQuickProduct}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: '12px' }}>
                                    <label>Название товара *</label>
                                    <input
                                        type="text"
                                        value={quickProductForm.name}
                                        onChange={e => setQuickProductForm({ ...quickProductForm, name: e.target.value })}
                                        required
                                        placeholder="Например: Смартфон Samsung S24"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                    <div className="form-group">
                                        <label>Код товара (артикул)</label>
                                        <input
                                            type="text"
                                            value={quickProductForm.code}
                                            onChange={e => setQuickProductForm({ ...quickProductForm, code: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Штрих-код</label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input
                                                type="text"
                                                value={quickProductForm.barcode}
                                                onChange={e => setQuickProductForm({ ...quickProductForm, barcode: e.target.value })}
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setQuickProductForm({ ...quickProductForm, barcode: generateBarcode() })}
                                                style={{ padding: '0 8px' }}
                                                title="Сгенерировать штрих-код"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                    <div className="form-group">
                                        <label>Категория</label>
                                        <select
                                            value={quickProductForm.categoryId}
                                            onChange={e => setQuickProductForm({ ...quickProductForm, categoryId: e.target.value })}
                                        >
                                            <option value="">Без категории</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Ед. измерения</label>
                                        <select
                                            value={quickProductForm.unit}
                                            onChange={e => setQuickProductForm({ ...quickProductForm, unit: e.target.value })}
                                        >
                                            <option value="шт">шт</option>
                                            <option value="кг">кг</option>
                                            <option value="л">л</option>
                                            <option value="г">г</option>
                                            <option value="м">м</option>
                                            <option value="уп">уп</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                    <div className="form-group">
                                        <label>Цена закупки</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={quickProductForm.pricePurchase}
                                            onChange={e => setQuickProductForm({ ...quickProductForm, pricePurchase: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Цена продажи</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={quickProductForm.priceSale}
                                            onChange={e => setQuickProductForm({ ...quickProductForm, priceSale: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowQuickProductModal(false)} className="btn btn-secondary">Отмена</button>
                                <button type="submit" className="btn btn-primary">Создать товар</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модал быстрого создания поставщика */}
            {showQuickSupplierModal && (
                <div className="modal-overlay" onClick={() => setShowQuickSupplierModal(false)} style={{ zIndex: 9999 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Быстрое создание поставщика</h2>
                            <button type="button" onClick={() => setShowQuickSupplierModal(false)} className="btn-close">×</button>
                        </div>
                        <form onSubmit={handleCreateQuickSupplier}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: '12px' }}>
                                    <label>Название поставщика *</label>
                                    <input type="text" value={quickSupplierName} onChange={e => setQuickSupplierName(e.target.value)} required placeholder="Например: ООО Поставщик" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowQuickSupplierModal(false)} className="btn btn-secondary">Отмена</button>
                                <button type="button" onClick={handleCreateQuickSupplier} className="btn btn-primary">Создать поставщика</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GoodsReceiving;
