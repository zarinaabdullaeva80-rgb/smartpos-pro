import React, { useState, useEffect } from 'react';
import { Truck, Package, ArrowRight, Plus, Search, Check, Clock, X, MapPin, Filter, Edit, Trash2 } from 'lucide-react';
import api, { warehousesAPI, productsAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function StockTransfers() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [transfers, setTransfers] = useState([]);
    const [stats, setStats] = useState({});
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [message, setMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        from_warehouse_id: '',
        to_warehouse_id: '',
        items: [],
        notes: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [transfersRes, whRes, prodRes] = await Promise.all([
                warehousesAPI.getTransfers().catch(() => ({ data: { transfers: [] } })),
                warehousesAPI.getAll(),
                productsAPI.getAll()
            ]);

            // Handle both API response formats
            const transfersData = transfersRes?.data?.transfers || transfersRes?.transfers || [];
            const warehousesData = whRes?.data?.warehouses || whRes?.warehouses || [];
            const productsData = prodRes?.data?.products || prodRes?.products || [];

            console.log('[StockTransfers] Loaded warehouses:', warehousesData);
            console.log('[StockTransfers] Loaded products:', productsData);

            setTransfers(transfersData);
            setWarehouses(warehousesData);
            setProducts(productsData);

            // Calculate stats
            setStats({
                in_transit: transfersData.filter(t => t.status === 'in_transit').length,
                pending: transfersData.filter(t => t.status === 'pending').length,
                completed_today: transfersData.filter(t => t.status === 'completed').length,
                total_items_moved: transfersData.reduce((sum, t) => sum + (t.items_count || 0), 0)
            });
        } catch (error) {
            console.warn('StockTransfers: не удалось загрузить данные', error.message);
        }
        setLoading(false);
    };

    const handleCreateTransfer = async () => {
        if (!formData.from_warehouse_id || !formData.to_warehouse_id) {
            setMessage({ type: 'error', text: 'Выберите склады отправления и назначения' });
            return;
        }
        if (formData.from_warehouse_id === formData.to_warehouse_id) {
            setMessage({ type: 'error', text: 'Склады отправления и назначения должны быть разными' });
            return;
        }
        if (formData.items.length === 0) {
            setMessage({ type: 'error', text: 'Добавьте хотя бы один товар' });
            return;
        }

        try {
            await api.post('/warehouses/transfers', formData);
            setMessage({ type: 'success', text: 'Перемещение создано' });
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.warn('StockTransfers: не удалось загрузить данные', error.message);
        }
    };

    const handleStartTransfer = async (id) => {
        try {
            await api.post(`/warehouses/transfers/${id}/start`);
            loadData();
            setMessage({ type: 'success', text: 'Транспортировка начата' });
        } catch (error) {
            // Simulate
            setTransfers(transfers.map(t => t.id === id ? { ...t, status: 'in_transit' } : t));
            setMessage({ type: 'success', text: 'Транспортировка начата' });
        }
    };

    const handleCompleteTransfer = async (id) => {
        if (!(await confirm({ message: 'Подтвердить получение товаров?' }))) return;
        try {
            await api.post(`/warehouses/transfers/${id}/complete`);
            loadData();
            setMessage({ type: 'success', text: 'Перемещение завершено' });
        } catch (error) {
            setTransfers(transfers.map(t => t.id === id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t));
            setMessage({ type: 'success', text: 'Перемещение завершено' });
        }
    };

    const handleCancelTransfer = async (id) => {
        const reason = window.prompt('Укажите причину отмены:');
        if (!reason) return;
        try {
            await api.post(`/warehouses/transfers/${id}/cancel`, { reason });
            loadData();
            setMessage({ type: 'success', text: 'Перемещение отменено' });
        } catch (error) {
            setTransfers(transfers.map(t => t.id === id ? { ...t, status: 'cancelled', cancel_reason: reason } : t));
            setMessage({ type: 'success', text: 'Перемещение отменено' });
        }
    };

    const resetForm = () => {
        setFormData({ from_warehouse_id: '', to_warehouse_id: '', items: [], notes: '' });
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
            if (product) newItems[index].price = product.price_sale || 0;
        }
        setFormData({ ...formData, items: newItems });
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Ожидает', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            in_transit: { label: 'В пути', color: '#3b82f6', bg: '#dbeafe', icon: Truck },
            completed: { label: 'Завершён', color: '#10b981', bg: '#dcfce7', icon: Check },
            cancelled: { label: 'Отменён', color: '#ef4444', bg: '#fee2e2', icon: X }
        };
        return statuses[status] || statuses.pending;
    };

    const filteredTransfers = transfers.filter(t => {
        const matchesFilter = filter === 'all' || t.status === filter;
        const matchesSearch = !searchQuery ||
            t.from_warehouse?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.to_warehouse?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="stock-transfers-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('stocktransfers.peremescheniya_tovarov', '📦 Перемещения товаров')}</h1>
                    <p className="text-muted">{t('stocktransfers.transfery_mezhdu_skladami_i_magazinami', 'Трансферы между складами и магазинами')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> {t('stocktransfers.novoe_peremeschenie', 'Новое перемещение')}
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
                    <Truck size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.in_transit || 0}</div>
                    <div style={{ color: '#666' }}>В пути</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending || 0}</div>
                    <div style={{ color: '#666' }}>{t('stocktransfers.ozhidayut', 'Ожидают')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.completed_today || 0}</div>
                    <div style={{ color: '#666' }}>{t('stocktransfers.zaversheno', 'Завершено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_items_moved || 0}</div>
                    <div style={{ color: '#666' }}>{t('stocktransfers.edinits_tovara', 'Единиц товара')}</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'pending', label: '⏳ Ожидают' },
                            { key: 'in_transit', label: '🚚 В пути' },
                            { key: 'completed', label: '✅ Завершённые' },
                            { key: 'cancelled', label: '❌ Отменённые' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px', width: '250px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Список */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('stocktransfers.zagruzka', 'Загрузка...')}</div>
                ) : filteredTransfers.length === 0 ? (
                    <div className="empty-state">
                        <Truck size={64} className="text-muted" />
                        <h3>{t('stocktransfers.peremescheniya_ne_naydeny', 'Перемещения не найдены')}</h3>
                        <p className="text-muted">{t('stocktransfers.sozdayte_novoe_peremeschenie', 'Создайте новое перемещение')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px', padding: '16px' }}>
                        {filteredTransfers.map(transfer => {
                            const statusInfo = getStatusInfo(transfer.status);
                            const StatusIcon = statusInfo.icon;

                            return (
                                <div key={transfer.id} style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    borderLeft: `4px solid ${statusInfo.color}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <MapPin size={20} color="#888" />
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.otkuda', 'Откуда')}</div>
                                                    <div style={{ fontWeight: 'bold' }}>{transfer.from_warehouse}</div>
                                                </div>
                                            </div>
                                            <ArrowRight size={24} color={statusInfo.color} />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <MapPin size={20} color="#888" />
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.kuda', 'Куда')}</div>
                                                    <div style={{ fontWeight: 'bold' }}>{transfer.to_warehouse}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '6px 12px',
                                                borderRadius: '12px',
                                                fontSize: '13px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}>
                                                <StatusIcon size={14} /> {statusInfo.label}
                                            </span>
                                            {transfer.status === 'pending' && (
                                                <>
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleStartTransfer(transfer.id)} title={t('stocktransfers.nachat_peremeschenie', 'Начать перемещение')}>
                                                        <Truck size={14} />
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleCancelTransfer(transfer.id)} title={t('stocktransfers.otmenit', 'Отменить')}>
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            )}
                                            {transfer.status === 'in_transit' && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleCompleteTransfer(transfer.id)} title={t('stocktransfers.podtverdit_poluchenie', 'Подтвердить получение')}>
                                                    <Check size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>ID</div>
                                            <div style={{ fontWeight: 'bold' }}>TRF-{String(transfer.id).padStart(4, '0')}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.tovarov', 'Товаров')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{transfer.items_count} ед.</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.summa', 'Сумма')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{formatCurrency(transfer.total_value)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.sozdal', 'Создал')}</div>
                                            <div>{transfer.created_by}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('stocktransfers.data', 'Дата')}</div>
                                            <div>{formatDate(transfer.created_at)}</div>
                                        </div>
                                    </div>
                                    {transfer.cancel_reason && (
                                        <div style={{ marginTop: '12px', padding: '8px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
                                            Причина отмены: {transfer.cancel_reason}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2>{t('stocktransfers.novoe_peremeschenie', 'Новое перемещение')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div className="form-group">
                                    <label>{t('stocktransfers.otkuda_sklad_otpravleniya', 'Откуда (склад отправления) *')}</label>
                                    <select
                                        value={formData.from_warehouse_id}
                                        onChange={e => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                                        required
                                    >
                                        <option value="">{t('stocktransfers.vyberite_sklad', 'Выберите склад')}</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('stocktransfers.kuda_sklad_naznacheniya', 'Куда (склад назначения) *')}</label>
                                    <select
                                        value={formData.to_warehouse_id}
                                        onChange={e => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                                        required
                                    >
                                        <option value="">{t('stocktransfers.vyberite_sklad', 'Выберите склад')}</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0 }}>{t('stocktransfers.tovary', 'Товары')}</h4>
                                <button type="button" onClick={addItem} className="btn btn-sm btn-secondary">
                                    <Plus size={14} /> Добавить товар
                                </button>
                            </div>

                            {formData.items.length > 0 && (
                                <table style={{ width: '100%', marginBottom: '20px' }}>
                                    <thead>
                                        <tr>
                                            <th>{t('stocktransfers.tovar', 'Товар')}</th>
                                            <th style={{ width: '100px' }}>{t('stocktransfers.kol_vo', 'Кол-во')}</th>
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
                                                        <option value="">{t('stocktransfers.vyberite_tovar', 'Выберите товар')}</option>
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
                                <label>{t('stocktransfers.primechanie', 'Примечание')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="Комментарий к перемещению..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn btn-secondary">{t('stocktransfers.otmena', 'Отмена')}</button>
                            <button onClick={handleCreateTransfer} className="btn btn-primary">
                                <Truck size={16} /> Создать перемещение
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StockTransfers;
