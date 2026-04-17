import React, { useState, useEffect } from 'react';
import { salesAPI, productsAPI, counterpartiesAPI, warehousesAPI } from '../services/api';
import api from '../services/api';
import { Plus, ShoppingCart, Trash2, X, Package, Star, Printer, QrCode, RotateCcw, Minus } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import ReceiptPrinter from '../components/ReceiptPrinter';
import QRPaymentModal from '../components/QRPaymentModal';
import ProductSearchInput from '../components/ProductSearchInput';
import { useActionHandler } from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Sales() {
    const toast = useToast();
    const { t } = useI18n();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [editingSale, setEditingSale] = useState(null);
    const [counterparties, setCounterparties] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [defaultWarehouseId, setDefaultWarehouseId] = useState(() => {
        return localStorage.getItem('defaultWarehouseId') || '';
    });
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [saleForReceipt, setSaleForReceipt] = useState(null);
    const [showQRPayment, setShowQRPayment] = useState(false);
    const [qrPaymentData, setQRPaymentData] = useState({ amount: 0, orderId: '' });

    // Возврат товаров
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnItems, setReturnItems] = useState([{ product_id: '', quantity: 1, price: 0 }]);
    const [returnReason, setReturnReason] = useState('');
    const [returnNotes, setReturnNotes] = useState('');

    const [formData, setFormData] = useState({
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
        counterpartyId: '',
        warehouseId: '',
        notes: '',
        items: []
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        loadSales();
        loadFormData();
    }, [refreshTrigger]);

    const loadSales = async () => {
        try {
            const response = await salesAPI.getAll({});
            setSales(response.data.sales);
        } catch (error) {
            handleError('Ошибка загрузки продаж');
        } finally {
            setLoading(false);
        }
    };

    const loadFormData = async () => {
        try {
            const [prodRes, cpRes, whRes] = await Promise.all([
                productsAPI.getAll(),
                counterpartiesAPI.getAll({ type: 'customer' }),
                warehousesAPI.getAll()
            ]);
            setProducts(prodRes.data.products || []);
            setCounterparties(cpRes.data.counterparties || []);
            setWarehouses(whRes.data.warehouses || []);

            // Set default warehouse: use saved default or first available
            const savedDefault = localStorage.getItem('defaultWarehouseId');
            const defaultWh = savedDefault || (whRes.data.warehouses?.length > 0 ? whRes.data.warehouses[0].id : '');
            if (defaultWh) {
                setFormData(prev => ({ ...prev, warehouseId: parseInt(defaultWh) }));
            }
        } catch (error) {
            handleError('Ошибка загрузки данных');
        }
    };

    const handleSetDefaultWarehouse = (warehouseId) => {
        if (defaultWarehouseId === String(warehouseId)) {
            // Clear default
            localStorage.removeItem('defaultWarehouseId');
            setDefaultWarehouseId('');
        } else {
            // Set new default
            localStorage.setItem('defaultWarehouseId', String(warehouseId));
            setDefaultWarehouseId(String(warehouseId));
        }
    };

    const handleCreateNew = () => {
        console.log('[SALES] handleCreateNew clicked');
        console.log('[SALES] Counterparties:', counterparties);
        console.log('[SALES] Warehouses:', warehouses);

        // Use default warehouse if set, otherwise first available
        const warehouseToUse = defaultWarehouseId
            ? parseInt(defaultWarehouseId)
            : (warehouses[0]?.id || '');

        setFormData({
            documentNumber: `ПРД-${Date.now()}`,
            documentDate: new Date().toISOString().split('T')[0],
            counterpartyId: '',  // Optional - no default buyer
            warehouseId: warehouseToUse,
            notes: '',
            items: []
        });
        setShowModal(true);
        console.log('[SALES] Modal should be open now');
    };

    // Autocomplete: добавить товар из поиска (или +1 если уже есть)
    const handleProductSelect = (product) => {
        const existingIndex = formData.items.findIndex(i => String(i.productId) === String(product.id));
        if (existingIndex >= 0) {
            // Товар уже в списке — +1 к количеству
            const newItems = [...formData.items];
            newItems[existingIndex].quantity += 1;
            setFormData({ ...formData, items: newItems });
        } else {
            // Новый товар
            setFormData({
                ...formData,
                items: [
                    ...formData.items,
                    {
                        productId: product.id,
                        productName: product.name,
                        quantity: 1,
                        price: product.price_sale || product.price || 0,
                        vatRate: 20
                    }
                ]
            });
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    productId: '',
                    quantity: 1,
                    price: 0,
                    vatRate: 20
                }
            ]
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'productId') {
            const product = products.find(p => p.id === parseInt(value));
            if (product) {
                newItems[index].price = product.price_sale || 0;
                newItems[index].productName = product.name;
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const handleQuantityChange = (index, delta) => {
        const newItems = [...formData.items];
        const newQty = newItems[index].quantity + delta;
        if (newQty <= 0) {
            // Удалить строку при 0
            setFormData({ ...formData, items: newItems.filter((_, i) => i !== index) });
        } else {
            newItems[index].quantity = newQty;
            setFormData({ ...formData, items: newItems });
        }
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('[SALES] handleSubmit called');
        console.log('[SALES] Form data:', formData);

        if (formData.items.length === 0) {
            console.warn('[SALES] No items in form');
            toast.info('Добавьте хотя бы один товар');
            return;
        }

        try {
            console.log('[SALES] Sending create request...');
            const response = await salesAPI.create(formData);
            console.log('[SALES] Create response:', response);

            const saleId = response.data.sale.id;
            const createdSale = response.data.sale;

            // Auto-confirm the sale
            try {
                await salesAPI.confirm(saleId);
                console.log('[SALES] Sale auto-confirmed:', saleId);

                // Load full sale details for receipt
                try {
                    const saleDetails = await salesAPI.getById(saleId);
                    setSaleForReceipt(saleDetails.data.sale);
                    setShowReceiptModal(true);
                } catch (loadErr) {
                    console.error('[SALES] Error loading sale details:', loadErr);
                    // Use basic data if can't load full details
                    setSaleForReceipt({
                        ...createdSale,
                        items: formData.items.map(item => ({
                            ...item,
                            product_name: products.find(p => p.id === parseInt(item.productId))?.name || 'Товар'
                        }))
                    });
                    setShowReceiptModal(true);
                }

                toast.success('Продажа создана и проведена успешно!');
            } catch (confirmError) {
                console.error('[SALES] Error confirming sale:', confirmError);
                toast.success('Продажа создана, но не проведена. Проверьте черновики.');
            }

            setShowModal(false);
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
        } catch (error) {
            console.error('[SALES] Error saving:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Ошибка сохранения';
            toast.info(errorMessage);
        }
    };



    const handleEdit = async (sale) => {
        setEditingSale(sale);
        // Load sale details
        try {
            const response = await salesAPI.getById(sale.id);
            const saleData = response.data.sale;
            setFormData({
                documentNumber: saleData.document_number,
                documentDate: new Date(saleData.document_date).toISOString().split('T')[0],
                counterpartyId: saleData.counterparty_id,
                warehouseId: saleData.warehouse_id,
                notes: saleData.notes || '',
                items: saleData.items.map(item => ({
                    productId: item.product_id,
                    quantity: parseFloat(item.quantity),
                    price: parseFloat(item.price),
                    vatRate: item.vat_rate || 20
                }))
            });
            setShowModal(true);
        } catch (error) {
            console.error('Ошибка загрузки продажи:', error);
            toast.error('Ошибка загрузки данных продажи');
        }
    };

    const handleConfirm = async (id) => {
        if (!confirm('Провести документ продажи?')) return;
        try {
            await salesAPI.confirm(id);
            setRefreshTrigger(prev => prev + 1);
            toast.success('Документ проведен успешно');
        } catch (error) {
            console.error('Ошибка проведения:', error);
            toast.info(error.response?.data?.error || 'Ошибка проведения');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить документ продажи?')) return;
        try {
            await salesAPI.delete(id);
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
            toast.success('Документ удален успешно');
        } catch (error) {
            console.error('Ошибка удаления:', error);
            toast.info(error.response?.data?.error || 'Ошибка удаления');
        }
    };

    // Обработка отдельного возврата
    const handleStandaloneReturn = async () => {
        const validItems = returnItems.filter(i => i.product_id && i.quantity > 0 && i.price > 0);
        if (validItems.length === 0) {
            toast.info('Добавьте хотя бы одну позицию с товаром, количеством и ценой');
            return;
        }
        try {
            await api.post('/returns/standalone', {
                items: validItems.map(i => ({
                    product_id: parseInt(i.product_id),
                    quantity: parseInt(i.quantity),
                    price: parseFloat(i.price)
                })),
                reason: returnReason || 'Возврат товара',
                notes: returnNotes
            });
            toast.success('✅ Возврат успешно оформлен!');
            setShowReturnModal(false);
            setReturnItems([{ product_id: '', quantity: 1, price: 0 }]);
            setReturnReason('');
            setReturnNotes('');
            loadSales();
        } catch (error) {
            toast.error('❌ ' + (error.response?.data?.error || 'Ошибка оформления возврата'));
        }
    };

    const addReturnItem = () => {
        setReturnItems([...returnItems, { product_id: '', quantity: 1, price: 0 }]);
    };

    const updateReturnItem = (index, field, value) => {
        const updated = [...returnItems];
        updated[index][field] = value;
        if (field === 'product_id' && value) {
            const product = products.find(p => p.id === parseInt(value));
            if (product) updated[index].price = product.price || 0;
        }
        setReturnItems(updated);
    };

    const removeReturnItem = (index) => {
        setReturnItems(returnItems.filter((_, i) => i !== index));
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getStatusBadge = (status) => {
        const statuses = {
            draft: { label: t('sales.draft', 'Черновик'), class: 'badge-warning' },
            confirmed: { label: t('sales.confirmed', 'Проведен'), class: 'badge-success' },
            shipped: { label: t('sales.shipped', 'Отгружен'), class: 'badge-primary' },
            paid: { label: t('sales.paid', 'Оплачен'), class: 'badge-success' }
        };
        const s = statuses[status] || { label: status, class: 'badge-secondary' };
        return <span className={`badge ${s.class}`}>{s.label}</span>;
    };

    return (
        <div className="sales-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('sales.title')}</h1>
                    <p className="text-muted">{t('sales.subtitle', 'Управление документами продаж')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={sales}
                        filename="Продажи"
                        sheetName="Продажи"
                        folder="sales"
                        columns={{
                            document_number: 'Номер',
                            document_date: 'Дата',
                            counterparty_name: 'Контрагент',
                            warehouse_name: 'Склад',
                            final_amount: 'Сумма',
                            status: 'Статус'
                        }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        title={t('sales.obnovit_spisok', 'Обновить список')}
                    >
                        🔄 {t('common.apply', 'Обновить')}
                    </button>
                    <button className="btn btn-warning" onClick={() => setShowReturnModal(true)} style={{ color: '#fff' }}>
                        <RotateCcw size={20} />
                        {t('sales.return', 'Возврат')}
                    </button>
                    <button className="btn btn-primary" onClick={handleCreateNew}>
                        <Plus size={20} />
                        {t('sales.newSale')}
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : sales.length === 0 ? (
                    <div className="empty-state">
                        <ShoppingCart size={64} className="text-muted" />
                        <h3>{t('sales.noSales', 'Продажи не найдены')}</h3>
                        <p className="text-muted">{t('sales.createFirst', 'Создайте первый документ продажи')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('sales.number', 'Номер')}</th>
                                <th>{t('sales.date', 'Дата')}</th>
                                <th>{t('sales.counterparty', 'Контрагент')}</th>
                                <th>{t('sales.warehouse', 'Склад')}</th>
                                <th>{t('sales.amount', 'Сумма')}</th>
                                <th>{t('common.status')}</th>
                                <th style={{ width: '150px' }}>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((sale) => (
                                <tr key={sale.id}>
                                    <td><code>{sale.document_number}</code></td>
                                    <td>{new Date(sale.document_date).toLocaleDateString('ru-RU')}</td>
                                    <td>{sale.counterparty_name || '—'}</td>
                                    <td>{sale.warehouse_name || '—'}</td>
                                    <td><strong>{formatCurrency(sale.final_amount)}</strong></td>
                                    <td>{getStatusBadge(sale.status)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {sale.status === 'draft' && (
                                                <>
                                                    <button
                                                        className="btn btn-warning btn-sm"
                                                        onClick={() => handleEdit(sale)}
                                                        title={t('sales.redaktirovat', 'Редактировать')}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => handleConfirm(sale.id)}
                                                        title={t('sales.provesti', 'Провести')}
                                                    >
                                                        ✓
                                                    </button>
                                                </>
                                            )}
                                            {sale.status === 'confirmed' && (
                                                <button
                                                    className="btn btn-info btn-sm"
                                                    onClick={async () => {
                                                        try {
                                                            const res = await salesAPI.getById(sale.id);
                                                            setSaleForReceipt(res.data.sale);
                                                            setShowReceiptModal(true);
                                                        } catch (err) {
                                                            console.error('Error loading sale:', err);
                                                            toast.error('Ошибка загрузки чека');
                                                        }
                                                    }}
                                                    title={t('sales.pechat_cheka', 'Печать чека')}
                                                >
                                                    <Printer size={16} />
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(sale.id)}
                                                title={t('sales.udalit', 'Удалить')}
                                                disabled={sale.status !== 'draft'}
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

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '860px' }}>
                        <div className="modal-header" style={{ padding: '12px 20px' }}>
                            <h2 style={{ fontSize: '18px', margin: 0 }}>{editingSale ? t('sales.editSale', 'Редактирование продажи') : t('sales.newSale')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body" style={{ padding: '12px 20px' }}>
                                {/* Compact header: дата + покупатель + склад в одну строку */}
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr auto', gap: '10px', marginBottom: '12px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px', marginBottom: '4px' }}>{t('sales.date')}</label>
                                        <input
                                            type="date"
                                            value={formData.documentDate}
                                            onChange={e => setFormData({ ...formData, documentDate: e.target.value })}
                                            required
                                            style={{ height: '36px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px', marginBottom: '4px' }}>{t('sales.pokupatel', 'Покупатель')}</label>
                                        <select
                                            value={formData.counterpartyId}
                                            onChange={e => setFormData({ ...formData, counterpartyId: e.target.value })}
                                            style={{ height: '36px', fontSize: '13px' }}
                                        >
                                            <option value="">{t('sales.roznichnyy_pokupatel', '— Розничный —')}</option>
                                            {counterparties.map(cp => (
                                                <option key={cp.id} value={cp.id}>{cp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px', marginBottom: '4px' }}>
                                            Склад {defaultWarehouseId && <Star size={10} style={{ color: '#ffc107', fill: '#ffc107' }} />}
                                        </label>
                                        <select
                                            value={formData.warehouseId}
                                            onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                            required
                                            style={{ height: '36px', fontSize: '13px' }}
                                        >
                                            <option value="">{t('sales.vyberite_sklad', 'Склад')}</option>
                                            {warehouses.map(wh => (
                                                <option key={wh.id} value={wh.id}>
                                                    {wh.name} {defaultWarehouseId === String(wh.id) ? '⭐' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${defaultWarehouseId === String(formData.warehouseId) ? 'btn-warning' : 'btn-secondary'}`}
                                        onClick={() => handleSetDefaultWarehouse(formData.warehouseId)}
                                        title={defaultWarehouseId === String(formData.warehouseId) ? 'Убрать из умолчания' : 'По умолчанию'}
                                        disabled={!formData.warehouseId}
                                        style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Star size={14} />
                                    </button>
                                </div>

                                {/* Поиск товара — autocomplete */}
                                <div style={{ marginBottom: '10px' }}>
                                    <ProductSearchInput
                                        products={products}
                                        onSelect={handleProductSelect}
                                        placeholder="🔍 Поиск товара: название, код или штрихкод..."
                                        warehouseId={formData.warehouseId}
                                    />
                                </div>

                                {/* Компактная таблица товаров */}
                                {formData.items.length > 0 && (
                                    <div style={{ maxHeight: '320px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                        <table style={{ margin: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '6px 10px', fontSize: '12px' }}>{t('sales.tovar', 'Товар')}</th>
                                                    <th style={{ width: '130px', padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{t('sales.kolichestvo', 'Кол-во')}</th>
                                                    <th style={{ width: '120px', padding: '6px 10px', fontSize: '12px' }}>{t('sales.tsena', 'Цена')}</th>
                                                    <th style={{ width: '110px', padding: '6px 10px', fontSize: '12px', textAlign: 'right' }}>{t('sales.summa', 'Сумма')}</th>
                                                    <th style={{ width: '40px', padding: '6px 4px' }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.items.map((item, index) => {
                                                    const product = products.find(p => p.id === parseInt(item.productId));
                                                    return (
                                                        <tr key={index}>
                                                            <td style={{ padding: '5px 10px', fontSize: '13px' }}>
                                                                {item.productName || product?.name || (
                                                                    <select
                                                                        value={item.productId}
                                                                        onChange={e => handleItemChange(index, 'productId', e.target.value)}
                                                                        required
                                                                        style={{ height: '30px', fontSize: '12px' }}
                                                                    >
                                                                        <option value="">Выберите…</option>
                                                                        {products.map(p => (
                                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '5px 10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                                                    <button type="button" onClick={() => handleQuantityChange(index, -1)}
                                                                        style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-secondary, #f1f5f9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                        <Minus size={12} />
                                                                    </button>
                                                                    <input
                                                                        type="number" min="0.001" step="0.001"
                                                                        value={item.quantity}
                                                                        onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                                        required
                                                                        style={{ width: '50px', height: '28px', textAlign: 'center', fontSize: '13px', padding: '2px 4px' }}
                                                                    />
                                                                    <button type="button" onClick={() => handleQuantityChange(index, 1)}
                                                                        style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-secondary, #f1f5f9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                        <Plus size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '5px 10px' }}>
                                                                <input
                                                                    type="number" min="0" step="0.01"
                                                                    value={item.price}
                                                                    onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                                                    required
                                                                    style={{ height: '28px', fontSize: '13px', padding: '2px 6px' }}
                                                                />
                                                            </td>
                                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '13px', padding: '5px 10px' }}>
                                                                {formatCurrency(item.quantity * item.price)}
                                                            </td>
                                                            <td style={{ padding: '5px 4px' }}>
                                                                <button type="button" onClick={() => handleRemoveItem(index)}
                                                                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                    <X size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {formData.items.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #94a3b8)', fontSize: '14px' }}>
                                        <Package size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                        <p style={{ margin: 0 }}>Найдите и выберите товар в поиске выше</p>
                                    </div>
                                )}

                                {/* Итого */}
                                {formData.items.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '10px 14px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formData.items.length} {formData.items.length === 1 ? 'позиция' : 'позиций'}</span>
                                        <strong style={{ fontSize: '18px' }}>Итого: {formatCurrency(calculateTotal())}</strong>
                                    </div>
                                )}

                                {/* Комментарий — свёрнутый */}
                                <details style={{ marginTop: '8px' }}>
                                    <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>💬 Комментарий</summary>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        rows="1"
                                        placeholder="Заметки к продаже..."
                                        style={{ marginTop: '6px', fontSize: '13px' }}
                                    />
                                </details>
                            </div>

                            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', padding: '10px 20px' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ fontSize: '13px' }}>{t('common.cancel')}</button>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {formData.items.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-info"
                                            style={{ fontSize: '13px' }}
                                            onClick={() => {
                                                setQRPaymentData({
                                                    amount: calculateTotal(),
                                                    orderId: formData.documentNumber
                                                });
                                                setShowQRPayment(true);
                                            }}
                                        >
                                            <QrCode size={14} /> QR
                                        </button>
                                    )}
                                    <button type="submit" className="btn btn-primary" style={{ fontSize: '13px' }}>
                                        {editingSale ? t('common.save') : '✓ Продать'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Receipt Printer Modal */}
            <ReceiptPrinter
                sale={saleForReceipt}
                isOpen={showReceiptModal}
                onClose={() => {
                    setShowReceiptModal(false);
                    setSaleForReceipt(null);
                }}
            />

            {/* QR Payment Modal */}
            <QRPaymentModal
                isOpen={showQRPayment}
                onClose={() => setShowQRPayment(false)}
                amount={qrPaymentData.amount}
                orderId={qrPaymentData.orderId}
                onPaymentConfirmed={(payment) => {
                    console.log('[SALES] QR Payment confirmed:', payment);
                    setFormData(prev => ({
                        ...prev,
                        notes: `${prev.notes} | Оплата через ${payment.system.toUpperCase()}`
                    }));
                    toast.info(`✅ Оплата через ${payment.system.toUpperCase()} подтверждена!`);
                }}
            />

            {/* Standalone Return Modal */}
            {showReturnModal && (
                <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2>{t('sales.vozvrat_tovarov', '🔄 Возврат товаров')}</h2>
                            <button className="btn-icon" onClick={() => setShowReturnModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('sales.prichina_vozvrata', 'Причина возврата')}</label>
                                <select value={returnReason} onChange={e => setReturnReason(e.target.value)}>
                                    <option value="">{t('sales.vyberite_prichinu', 'Выберите причину')}</option>
                                    <option value="Брак">{t('sales.brak', 'Брак')}</option>
                                    <option value="Не подошёл товар">{t('sales.ne_podoshyol_tovar', 'Не подошёл товар')}</option>
                                    <option value="Ошибка кассира">{t('sales.oshibka_kassira', 'Ошибка кассира')}</option>
                                    <option value="Другое">{t('sales.drugoe', 'Другое')}</option>
                                </select>
                            </div>

                            <h4>{t('sales.pozitsii_vozvrata', 'Позиции возврата')}</h4>
                            {returnItems.map((item, index) => (
                                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 40px', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{t('sales.tovar', 'Товар')}</label>
                                        <select value={item.product_id} onChange={e => updateReturnItem(index, 'product_id', e.target.value)}>
                                            <option value="">{t('sales.vyberite_tovar', 'Выберите товар')}</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{t('sales.kol_vo', 'Кол-во')}</label>
                                        <input type="number" min="1" value={item.quantity} onChange={e => updateReturnItem(index, 'quantity', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '12px' }}>{t('sales.tsena', 'Цена')}</label>
                                        <input type="number" min="0" value={item.price} onChange={e => updateReturnItem(index, 'price', e.target.value)} />
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => removeReturnItem(index)} style={{ height: '36px' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button className="btn btn-secondary btn-sm" onClick={addReturnItem} style={{ marginTop: '8px' }}>
                                <Plus size={14} /> Добавить позицию
                            </button>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>{t('sales.zametki', 'Заметки')}</label>
                                <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Дополнительные заметки..." rows={2} />
                            </div>

                            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <strong>{t('sales.itogo_k_vozvratu', 'Итого к возврату:')} </strong>
                                {formatCurrency(returnItems.reduce((sum, i) => sum + (i.quantity * i.price), 0))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>{t('sales.otmena', 'Отмена')}</button>
                            <button className="btn btn-warning" style={{ color: '#fff' }} onClick={handleStandaloneReturn}>
                                <RotateCcw size={16} /> Оформить возврат
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Sales;
