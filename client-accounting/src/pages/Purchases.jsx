import React, { useState, useEffect } from 'react';
import { purchasesAPI, productsAPI, counterpartiesAPI, warehousesAPI } from '../services/api';
import { Plus, Package, CheckCircle, XCircle, Trash2, X } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import ExportButton from '../components/ExportButton';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Purchases() {
    const toast = useToast();
    const { t } = useI18n();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [formData, setFormData] = useState({
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
        counterpartyId: '',
        warehouseId: '',
        notes: '',
        items: []
    });

    useEffect(() => {
        loadPurchases();
        loadFormData();
    }, []);

    const loadPurchases = async () => {
        try {
            const response = await purchasesAPI.getAll();
            setPurchases(response.data.purchases);
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
            setProducts(prodRes.data.products || []);
            setCounterparties(cpRes.data.counterparties || []);
            setWarehouses(whRes.data.warehouses || []);

            if (whRes.data.warehouses?.length > 0) {
                setFormData(prev => ({ ...prev, warehouseId: whRes.data.warehouses[0].id }));
            }
        } catch (error) {
            console.error('Ошибка загрузки данных для формы:', error);
        }
    };

    const handleCreateNew = () => {
        console.log('[PURCHASES] handleCreateNew clicked');
        console.log('[PURCHASES] Counterparties:', counterparties);
        console.log('[PURCHASES] Warehouses:', warehouses);

        setFormData({
            documentNumber: `ЗАК-${Date.now()}`,
            documentDate: new Date().toISOString().split('T')[0],
            counterpartyId: counterparties[0]?.id || '',
            warehouseId: warehouses[0]?.id || '',
            notes: '',
            items: []
        });
        setShowModal(true);
        console.log('[PURCHASES] Modal should be open now');
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
                newItems[index].price = product.price_purchase || 0;
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateTotal = () => {
        return formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('[PURCHASES] handleSubmit called');
        console.log('[PURCHASES] Form data:', formData);

        if (formData.items.length === 0) {
            console.warn('[PURCHASES] No items in form');
            toast.info('Добавьте хотя бы один товар');
            return;
        }

        try {
            console.log('[PURCHASES] Sending create request...');
            const response = await purchasesAPI.create(formData);
            console.log('[PURCHASES] Create response:', response);
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
        if (!confirm('Провести документ закупки? Остатки на складе будут увеличены.')) return;

        try {
            await purchasesAPI.confirm(id);
            loadPurchases();
            toast.info('Документ проведен');
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

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
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
            <div className="page-header">
                <div>
                    <h1>{t('purchases.title')}</h1>
                    <p className="text-muted">{t('purchases.subtitle', 'Управление документами закупок')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
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
                        {t('purchases.newPurchase')}
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : purchases.length === 0 ? (
                    <div className="empty-state">
                        <Package size={64} className="text-muted" />
                        <h3>{t('purchases.noPurchases', 'Закупки не найдены')}</h3>
                        <p className="text-muted">{t('purchases.createFirst', 'Создайте первый документ закупки')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('sales.number')}</th>
                                <th>{t('sales.date')}</th>
                                <th>{t('purchases.supplier', 'Поставщик')}</th>
                                <th>{t('sales.warehouse')}</th>
                                <th>{t('sales.amount')}</th>
                                <th>{t('common.status')}</th>
                                <th>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((purchase) => (
                                <tr key={purchase.id}>
                                    <td><code>{purchase.document_number}</code></td>
                                    <td>{new Date(purchase.document_date).toLocaleDateString('ru-RU')}</td>
                                    <td>{purchase.counterparty_name || '—'}</td>
                                    <td>{purchase.warehouse_name || '—'}</td>
                                    <td><strong>{formatCurrency(purchase.final_amount)}</strong></td>
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

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h2>{t('purchases.newPurchase')}</h2>
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
                                                <th style={{ width: '150px' }}>{t('purchases.tsena_zakup', 'Цена закуп.')}</th>
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
                                                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
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
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        {formatCurrency(item.quantity * item.price)}
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
                                        <strong>Итого к оплате: {formatCurrency(calculateTotal())}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
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
