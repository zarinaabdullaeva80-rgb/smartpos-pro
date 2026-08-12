import React, { useState, useEffect } from 'react';
import api, { purchasesAPI, productsAPI, counterpartiesAPI, warehousesAPI } from '../services/api';
import { Plus, Package, CheckCircle, XCircle, Trash2, X, RefreshCw } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import ExportButton from '../components/ExportButton';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';
import { useShortcutAction } from '../hooks/useKeyboardShortcuts';

function Purchases() {
    const toast = useToast();
    const { t } = useI18n();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [currencyRates, setCurrencyRates] = useState(() => {
        const saved = localStorage.getItem('currencyRates');
        return saved ? JSON.parse(saved) : { USD: 12004, EUR: 13800, RUB: 142 };
    });
    const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('selectedCurrency') || 'UZS');

    const [formData, setFormData] = useState({
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
        counterpartyId: '',
        warehouseId: '',
        notes: '',
        currency: 'UZS',
        exchangeRate: 1,
        items: []
    });

    useEffect(() => {
        loadPurchases();
        loadFormData();
    }, []);

    // ── Горячие клавиши ──
    useShortcutAction('new', () => setShowModal(true));
    useShortcutAction('escape', () => { if (showModal) setShowModal(false); });
    useShortcutAction('search', () => {
        const el = document.querySelector('input[placeholder*="Поиск"], input[placeholder*="оиск"]');
        if (el) el.focus();
    });

    const loadPurchases = async () => {
        setLoading(true);
        try {
            const [purchasesRes, receiptsRes] = await Promise.all([
                purchasesAPI.getAll().catch(() => ({ data: { purchases: [] } })),
                api.get('/warehouses/receipts').catch(() => ({ data: { receipts: [] } }))
            ]);

            const list1 = purchasesRes?.data?.purchases || [];
            const rawReceipts = receiptsRes?.data?.receipts || [];
            
            // Format warehouse receipts into purchase items format
            const convertedReceipts = rawReceipts.map(r => ({
                id: `rec-${r.id}`,
                document_number: r.document_number || `REC-${r.id}`,
                document_date: r.expected_date || r.created_at || new Date(),
                counterparty_name: r.supplier_name || r.supplier || '—',
                warehouse_name: 'Основной склад',
                final_amount: r.total_value || 0,
                currency: r.currency || 'UZS',
                exchange_rate: r.exchange_rate || 1,
                status: r.status === 'completed' ? 'confirmed' : 'draft',
                source: 'receipt'
            }));

            // Merge and sort descending
            const merged = [...list1, ...convertedReceipts].sort((a, b) => new Date(b.document_date) - new Date(a.document_date));
            setPurchases(merged);
        } catch (error) {
            console.error('Ошибка загрузки закупок:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFormData = async () => {
        try {
            const [prodRes, cpRes, whRes] = await Promise.all([
                productsAPI.getAll(),
                counterpartiesAPI.getAll({ type: 'supplier' }),
                warehousesAPI.getWarehouses ? warehousesAPI.getWarehouses() : warehousesAPI.getAll()
            ]);
            setProducts(prodRes?.data?.products || prodRes?.products || []);
            setCounterparties(cpRes?.data?.counterparties || cpRes?.counterparties || []);
            setWarehouses(whRes?.data?.warehouses || whRes?.warehouses || []);

            const whList = whRes?.data?.warehouses || whRes?.warehouses || [];
            if (whList.length > 0) {
                setFormData(prev => ({ ...prev, warehouseId: whList[0].id }));
            }
        } catch (error) {
            console.error('Ошибка загрузки данных для формы:', error);
        }
    };

    const handleCreateNew = () => {
        setFormData({
            documentNumber: `ЗАК-${Date.now().toString().slice(-6)}`,
            documentDate: new Date().toISOString().split('T')[0],
            counterpartyId: counterparties[0]?.id || '',
            warehouseId: warehouses[0]?.id || '',
            notes: '',
            currency: 'UZS',
            exchangeRate: 1,
            items: []
        });
        setShowModal(true);
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
            const product = products.find(p => p.id === parseInt(value) || p.id === value);
            if (product) {
                newItems[index].price = product.price_purchase || product.pricePurchase || 0;
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.items.length === 0) {
            toast.info('Добавьте хотя бы один товар');
            return;
        }

        try {
            const rate = formData.currency === 'UZS' ? 1 : (formData.exchangeRate || 1);
            // Convert prices if entered in foreign currency
            const preparedItems = formData.items.map(item => ({
                ...item,
                price: formData.currency !== 'UZS' ? item.price * rate : item.price
            }));

            await purchasesAPI.create({
                ...formData,
                items: preparedItems,
                currency: formData.currency,
                exchange_rate: rate
            });

            toast.success('Закупка создана');
            setShowModal(false);
            loadPurchases();
        } catch (error) {
            console.error('[PURCHASES] Error saving:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Ошибка сохранения';
            toast.info(errorMessage);
        }
    };

    const handleConfirm = async (id) => {
        if (typeof id === 'string' && id.startsWith('rec-')) {
            toast.info('Приёмка уже проведена через склад');
            return;
        }
        if (!confirm('Провести документ закупки? Остатки на складе будут увеличены.')) return;

        try {
            await purchasesAPI.confirm(id);
            loadPurchases();
            toast.success('Документ проведен');
        } catch (error) {
            console.error('Ошибка проведения:', error);
            toast.info(error.response?.data?.error || 'Ошибка проведения');
        }
    };

    const handleCancel = async (id) => {
        if (!confirm('Отменить проведение закупки?')) return;
        try {
            await purchasesAPI.cancel(id);
            loadPurchases();
        } catch (error) {
            console.error('Ошибка отмены:', error);
            toast.info(error.response?.data?.error || 'Ошибка отмены');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить закупку?')) return;
        try {
            await purchasesAPI.delete(id);
            loadPurchases();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            toast.info(error.response?.data?.error || 'Ошибка удаления');
        }
    };

    const formatCurrencyDisplay = (amountInUZS, itemCurrency, itemRate) => {
        const val = Number(amountInUZS) || 0;
        const targetCurr = selectedCurrency;
        
        if (targetCurr === 'UZS') return formatCurrencyUZS(val);

        const rate = (itemCurrency === targetCurr && itemRate) ? itemRate : (currencyRates[targetCurr] || 1);
        const symbolMap = { USD: '$', EUR: '€', RUB: '₽' };
        const symbol = symbolMap[targetCurr] || '';
        return `${symbol}${(val / rate).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getStatusBadge = (status) => {
        const statuses = {
            draft: { label: t('sales.draft', 'Черновик'), class: 'badge-warning' },
            confirmed: { label: t('sales.confirmed', 'Проведен'), class: 'badge-success' },
            received: { label: t('purchases.received', 'Получен'), class: 'badge-primary' },
            paid: { label: t('sales.paid', 'Оплачен'), class: 'badge-success' }
        };
        const s = statuses[status] || { label: status, class: 'badge-secondary' };
        return <span className={`badge ${s.class}`}>{s.label}</span>;
    };

    return (
        <div className="purchases-page fade-in">
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h1>{t('purchases.title', 'Закупки и приходы')}</h1>
                    <p className="text-muted">{t('purchases.subtitle', 'История закупок и оприходования товаров в разных валютах')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <ExportButton
                        data={purchases}
                        filename="Закупки"
                        sheetName="Закупки"
                        columns={{
                            document_number: 'Номер',
                            document_date: 'Дата',
                            counterparty_name: 'Поставщик',
                            warehouse_name: 'Склад',
                            final_amount: 'Сумма',
                            status: 'Статус'
                        }}
                    />
                    <button className="btn btn-primary" onClick={handleCreateNew}>
                        <Plus size={20} />
                        {t('purchases.newPurchase', 'Новая закупка')}
                    </button>
                </div>
            </div>

            {/* ── Переключатель валюты просмотра ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: 'var(--bg-secondary,#1e1e2e)', padding: '8px 14px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '13px', color: '#aaa' }}>Валюта просмотра истории:</span>
                {['UZS', 'USD', 'EUR', 'RUB'].map(code => (
                    <button
                        key={code}
                        onClick={() => {
                            setSelectedCurrency(code);
                            localStorage.setItem('selectedCurrency', code);
                        }}
                        style={{
                            padding: '4px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                            background: selectedCurrency === code ? 'var(--primary,#7c3aed)' : 'transparent',
                            color: selectedCurrency === code ? '#fff' : '#aaa',
                            transition: 'all 0.2s'
                        }}
                    >{code}</button>
                ))}
            </div>

            <div className="card">
                {loading ? (
                    <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : purchases.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
                        <Package size={64} className="text-muted" />
                        <h3>{t('purchases.noPurchases', 'Закупки не найдены')}</h3>
                        <p className="text-muted">{t('purchases.createFirst', 'Создайте первый документ закупки')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('sales.number', 'Номер')}</th>
                                <th>{t('sales.date', 'Дата')}</th>
                                <th>{t('purchases.supplier', 'Поставщик')}</th>
                                <th>{t('sales.warehouse', 'Склад')}</th>
                                <th>{t('sales.amount', 'Сумма')}</th>
                                <th>{t('common.status', 'Статус')}</th>
                                <th>{t('common.actions', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((purchase) => (
                                <tr key={purchase.id}>
                                    <td>
                                        <code style={{ fontSize: '13px', fontWeight: 600 }}>{purchase.document_number}</code>
                                        {purchase.currency && purchase.currency !== 'UZS' && (
                                            <span style={{ marginLeft: '6px', background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                                {purchase.currency}
                                            </span>
                                        )}
                                    </td>
                                    <td>{new Date(purchase.document_date).toLocaleDateString('ru-RU')}</td>
                                    <td>{purchase.counterparty_name || '—'}</td>
                                    <td>{purchase.warehouse_name || 'Основной склад'}</td>
                                    <td>
                                        <strong>{formatCurrencyDisplay(purchase.final_amount, purchase.currency, purchase.exchange_rate)}</strong>
                                        {purchase.currency && purchase.currency !== 'UZS' && (
                                            <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '2px' }}>
                                                {purchase.currency === 'USD' ? '$' : purchase.currency === 'EUR' ? '€' : '₽'}
                                                {(purchase.final_amount / (purchase.exchange_rate || 1)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </td>
                                    <td>{getStatusBadge(purchase.status)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {purchase.status === 'draft' && (
                                                <>
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => handleConfirm(purchase.id)}
                                                        title={t('purchases.provesti', 'Провести')}
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDelete(purchase.id)}
                                                        title={t('purchases.udalit', 'Удалить')}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {purchase.status === 'confirmed' && (
                                                <button
                                                    className="btn btn-warning btn-sm"
                                                    onClick={() => handleCancel(purchase.id)}
                                                    title={t('purchases.otmenit_provedenie', 'Отменить проведение')}
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно создания закупки */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h2>{t('purchases.newPurchase', 'Новая закупка')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('purchases.nomer_dokumenta', 'Номер документа')}</label>
                                        <input
                                            type="text"
                                            value={formData.documentNumber}
                                            onChange={e => setFormData({ ...formData, documentNumber: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('purchases.data', 'Дата')}</label>
                                        <input
                                            type="date"
                                            value={formData.documentDate}
                                            onChange={e => setFormData({ ...formData, documentDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Поставщик</label>
                                        <select
                                            value={formData.counterpartyId}
                                            onChange={e => setFormData({ ...formData, counterpartyId: e.target.value })}
                                            required
                                        >
                                            <option value="">{t('purchases.vyberite_postavschika', 'Выберите поставщика')}</option>
                                            {counterparties.map(cp => (
                                                <option key={cp.id} value={cp.id}>{cp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Склад</label>
                                        <select
                                            value={formData.warehouseId}
                                            onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                                            required
                                        >
                                            <option value="">{t('purchases.vyberite_sklad', 'Выберите склад')}</option>
                                            {warehouses.map(wh => (
                                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* ── ВАЛЮТА ЗАКУПКИ ── */}
                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', marginBottom: '8px' }}>💱 Валюта документа закупки</div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {[['UZS', 'Сум'], ['USD', '$ USD'], ['EUR', '€ EUR'], ['RUB', '₽ RUB']].map(([code, label]) => (
                                            <button
                                                key={code}
                                                type="button"
                                                onClick={() => {
                                                    const rate = code === 'UZS' ? 1 : (currencyRates[code] || 1);
                                                    setFormData(prev => ({ ...prev, currency: code, exchangeRate: rate }));
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
                                                    value={formData.exchangeRate || ''}
                                                    onChange={e => setFormData(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 1 }))}
                                                    placeholder="сум"
                                                    style={{ width: '110px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                                                />
                                                <span style={{ fontSize: '11px', color: '#aaa' }}>сум</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('purchases.primechaniya', 'Примечания')}</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        rows="2"
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
                                    <h3>{t('purchases.tovary', 'Товары')}</h3>
                                    <button type="button" onClick={handleAddItem} className="btn btn-secondary btn-sm">
                                        <Plus size={16} /> Добавить строку
                                    </button>
                                </div>

                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t('purchases.tovar', 'Товар')}</th>
                                                <th style={{ width: '120px' }}>{t('purchases.kolichestvo', 'Количество')}</th>
                                                <th style={{ width: '150px' }}>{t('purchases.tsena_zakup', 'Цена закуп.')} {(formData.currency || 'UZS') !== 'UZS' ? `(${formData.currency})` : '(сум)'}</th>
                                                <th style={{ width: '150px' }}>{t('purchases.summa', 'Сумма')}</th>
                                                <th style={{ width: '50px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <select
                                                            value={item.productId}
                                                            onChange={e => handleItemChange(index, 'productId', e.target.value)}
                                                            required
                                                        >
                                                            <option value="">{t('purchases.vyberite_tovar', 'Выберите товар')}</option>
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name} ({p.code || p.barcode || ''})</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={item.quantity}
                                                            onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                                            required
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.price}
                                                            onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value))}
                                                            required
                                                        />
                                                        {(formData.currency || 'UZS') !== 'UZS' && (
                                                            <div style={{ fontSize: '10px', color: '#a78bfa', marginTop: '2px' }}>
                                                                ≈ {((item.price || 0) * (formData.exchangeRate || 1)).toLocaleString('ru-RU')} сум
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        {formData.currency !== 'UZS' ? (
                                                            <span>
                                                                {formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : '₽'}
                                                                {(item.quantity * item.price).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        ) : (
                                                            formatCurrencyUZS(item.quantity * item.price)
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button type="button" onClick={() => handleRemoveItem(index)} className="btn btn-danger btn-sm">
                                                            <X size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {formData.items.length > 0 && (
                                    <div style={{ textAlign: 'right', marginTop: '15px', fontSize: '1.2rem' }}>
                                        <strong>
                                            Итого к оплате:{' '}
                                            {formData.currency !== 'UZS' ? (
                                                <span style={{ color: '#a78bfa' }}>
                                                    {formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : '₽'}
                                                    {calculateTotal().toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    <span style={{ fontSize: '0.9rem', color: '#aaa', marginLeft: '8px' }}>
                                                        (≈ {formatCurrencyUZS(calculateTotal() * (formData.exchangeRate || 1))})
                                                    </span>
                                                </span>
                                            ) : (
                                                formatCurrencyUZS(calculateTotal())
                                            )}
                                        </strong>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{t('common.cancel', 'Отмена')}</button>
                                <button type="submit" className="btn btn-primary">{t('purchases.createPurchase', 'Создать закупку')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Purchases;
