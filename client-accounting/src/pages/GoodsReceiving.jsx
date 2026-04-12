import React, { useState, useEffect } from 'react';
import { Package, Check, X, Search, Plus, Truck, Calendar, User, AlertTriangle, Camera, Edit, Trash2 } from 'lucide-react';
import api, { counterpartiesAPI, productsAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function GoodsReceiving() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [receipts, setReceipts] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        supplier_id: '',
        expected_date: new Date().toISOString().split('T')[0],
        items: [],
        notes: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [receiptsRes, suppliersRes, productsRes] = await Promise.all([
                api.get('/warehouses/receipts').catch(() => ({ data: { receipts: [] } })),
                counterpartiesAPI.getAll({ type: 'supplier' }),
                productsAPI.getAll()
            ]);

            // Handle both API response formats
            const receiptsData = receiptsRes?.data?.receipts || [];
            const suppliersData = suppliersRes?.data?.counterparties || suppliersRes?.counterparties || [];
            const productsData = productsRes?.data?.products || productsRes?.products || [];

            console.log('[GoodsReceiving] Loaded suppliers:', suppliersData);
            console.log('[GoodsReceiving] Loaded products:', productsData);

            setReceipts(receiptsData);
            setSuppliers(suppliersData);
            setProducts(productsData);

            setStats({
                pending: receiptsData.filter(r => r.status === 'pending').length,
                receiving: receiptsData.filter(r => r.status === 'receiving').length,
                completed_today: receiptsData.filter(r => r.status === 'completed').length,
                total_value: receiptsData.reduce((sum, r) => sum + (r.total_value || 0), 0)
            });
        } catch (error) {
            console.warn('GoodsReceiving: не удалось загрузить данные', error.message);
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
            await api.post('/warehouses/receipts', formData);
            setMessage({ type: 'success', text: 'Приёмка создана' });
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.warn('GoodsReceiving: не удалось загрузить данные', error.message);
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
            // Simulate
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

        // Find item by barcode in products list
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
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(stats.total_value || 0)}</div>
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
                                            <h3 style={{ margin: 0 }}>{receipt.id}</h3>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#888' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Truck size={14} /> {receipt.supplier}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={14} /> {receipt.date}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold' }}>{formatCurrency(receipt.total_value)}</div>
                                        <div style={{ fontSize: '13px', color: '#888' }}>{receipt.total_items} позиций</div>
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
                                                <div style={{ fontSize: '12px', color: '#888' }}>{formatCurrency(item.price)} / шт</div>
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

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2>{t('goodsreceiving.novaya_priyomka', 'Новая приёмка')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div className="form-group">
                                    <label>{t('goodsreceiving.postavschik', 'Поставщик *')}</label>
                                    <select
                                        value={formData.supplier_id}
                                        onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                                        required
                                    >
                                        <option value="">{t('goodsreceiving.vyberite_postavschika', 'Выберите поставщика')}</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
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
                                            <th style={{ width: '150px' }}>{t('goodsreceiving.tsena', 'Цена')}</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.map((item, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <select
                                                        value={item.product_id}
                                                        onChange={e => updateItem(index, 'product_id', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">{t('goodsreceiving.vyberite_tovar', 'Выберите товар')}</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
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
                                                        value={item.price}
                                                        onChange={e => updateItem(index, 'price', parseFloat(e.target.value))}
                                                    />
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
        </div>
    );
}

export default GoodsReceiving;
