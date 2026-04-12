import React, { useState, useEffect } from 'react';
import { warehousesAPI, productsAPI } from '../services/api';
import { Warehouse as WarehouseIcon, Plus, Edit, Trash2, Package, TrendingUp, TrendingDown, AlertTriangle, Search, X } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
const Warehouse = () => {
    const { handleSuccess, handleError } = useActionHandler();
    const confirm = useConfirm();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('warehouses');
    const [warehouses, setWarehouses] = useState([]);
    const [stock, setStock] = useState([]);
    const [movements, setMovements] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'warehouse', 'movement', or 'transfer'
    const [editingItem, setEditingItem] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        address: '',
        responsible_person: '',
        // Movement fields
        product_id: '',
        warehouse_id: '',
        quantity: 0,
        cost_price: 0,
        reason: '',
        // Transfer fields
        from_warehouse_id: '',
        to_warehouse_id: ''
    });

    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        warehouse_id: '',
        product_id: '',
        document_type: '',
        search: ''
    });

    useEffect(() => {
        loadWarehouses();
        loadProducts();
    }, []);

    useEffect(() => {
        if (activeTab === 'stock') {
            loadStock();
        } else if (activeTab === 'movements') {
            loadMovements();
        }
    }, [activeTab, filters]);

    const loadWarehouses = async () => {
        setLoading(true);
        try {
            const response = await warehousesAPI.getAll();
            setWarehouses(response.data.warehouses || []);
        } catch (error) {
            console.error('Ошибка загрузки складов:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStock = async () => {
        setLoading(true);
        try {
            const response = await warehousesAPI.getStock({ search: filters.search });
            setStock(response.data.stock || []);
        } catch (error) {
            console.error('Ошибка загрузки остатков:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMovements = async () => {
        setLoading(true);
        try {
            const response = await warehousesAPI.getMovements(filters);
            setMovements(response.data.movements || []);
        } catch (error) {
            console.error('Ошибка загрузки движений:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            const response = await productsAPI.getAll();
            setProducts(response.data.products || []);
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
        }
    };

    const handleOpenModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);

        if (item) {
            setFormData({ ...item });
        } else {
            if (type === 'warehouse') {
                setFormData({
                    code: `WH-${Date.now()}`,
                    name: '',
                    address: '',
                    responsible_person: ''
                });
            } else if (type === 'movement') {
                setFormData({
                    product_id: '',
                    warehouse_id: warehouses[0]?.id || '',
                    quantity: 0,
                    cost_price: 0,
                    reason: ''
                });
            } else if (type === 'transfer') {
                setFormData({
                    product_id: '',
                    from_warehouse_id: warehouses[0]?.id || '',
                    to_warehouse_id: warehouses[1]?.id || warehouses[0]?.id,
                    quantity: 0
                });
            }
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSubmitWarehouse = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingItem) {
                await warehousesAPI.update(editingItem.id, formData);
                handleSuccess('Склад успешно обновлён');
            } else {
                await warehousesAPI.create(formData);
                handleSuccess('Склад успешно создан');
            }
            await loadWarehouses();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения склада:', error);
            handleError(error.response?.data?.error || 'Ошибка сохранения склада');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitMovement = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await warehousesAPI.createMovement(formData);
            await loadMovements();
            await loadStock();
            handleCloseModal();
            handleSuccess('Корректировка выполнена');
        } catch (error) {
            console.error('Ошибка создания движения:', error);
            handleError(error.response?.data?.error || 'Ошибка корректировки');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitTransfer = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await warehousesAPI.transfer(formData);
            await loadMovements();
            await loadStock();
            handleCloseModal();
            handleSuccess('Перемещение выполнено успешно');
        } catch (error) {
            console.error('Ошибка перемещения:', error);
            handleError(error.response?.data?.error || 'Ошибка перемещения');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWarehouse = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Вы уверены, что хотите удалить этот склад?' }))) return;
        try {
            await warehousesAPI.delete(id);
            await loadWarehouses();
            handleSuccess('Склад удалён');
        } catch (error) {
            console.error('Ошибка удаления склада:', error);
            handleError('Невозможно удалить склад. Возможно, по нему есть движения.');
        }
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getDocumentTypeLabel = (type) => {
        const labels = {
            sale: t('sales.title', 'Продажа'),
            purchase: t('purchases.title', 'Закупка'),
            transfer: t('warehouse.transfer', 'Перемещение'),
            adjustment: t('warehouse.adjustment', 'Корректировка')
        };
        return labels[type] || type;
    };

    const totalStockValue = stock.reduce((sum, item) =>
        sum + (parseFloat(item.total_quantity) * parseFloat(item.avg_cost || 0)), 0
    );

    const totalStockItems = stock.reduce((sum, item) =>
        sum + parseFloat(item.total_quantity || 0), 0
    );

    return (
        <div className="page-container glass fade-in" style={{ padding: '20px' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <WarehouseIcon className="page-icon" />
                        {t('warehouse.title')}
                    </h1>
                    <p className="page-subtitle">{t('warehouse.subtitle', 'Управление складами и инвентаризация')}</p>
                </div>
                <ExportButton
                    data={activeTab === 'warehouses' ? warehouses : activeTab === 'stock' ? stock : movements}
                    filename={activeTab === 'warehouses' ? 'Склады' : activeTab === 'stock' ? 'Остатки' : 'Движения'}
                    sheetName={activeTab === 'warehouses' ? 'Склады' : activeTab === 'stock' ? 'Остатки' : 'Движения'}
                    columns={activeTab === 'warehouses' ? {
                        code: 'Код',
                        name: 'Название',
                        address: 'Адрес',
                        responsible_person: 'Ответственный',
                        is_active: 'Активен'
                    } : activeTab === 'stock' ? {
                        code: 'Код',
                        name: 'Товар',
                        total_quantity: 'Количество',
                        unit: 'Ед. изм.',
                        avg_cost: 'Ср. цена'
                    } : {
                        movement_date: 'Дата',
                        product_name: 'Товар',
                        warehouse_name: 'Склад',
                        document_type: 'Тип',
                        quantity: 'Количество',
                        user_name: 'Пользователь'
                    }}
                />
            </div>

            <div className="stats-grid">
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('warehouse.warehouses', 'Складов')}</span>
                        <WarehouseIcon className="stat-icon text-blue-500" size={24} />
                    </div>
                    <div className="stat-value">{warehouses.filter(w => w.is_active).length}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('warehouse.inStock', 'Товаров в наличии')}</span>
                        <Package className="stat-icon text-green-500" size={24} />
                    </div>
                    <div className="stat-value">{stock.length}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('warehouse.totalVolume', 'Общий объем')}</span>
                        <Package className="stat-icon text-purple-500" size={24} />
                    </div>
                    <div className="stat-value">{totalStockItems.toFixed(0)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('warehouse.stockValue', 'Стоимость запасов')}</span>
                        <TrendingUp className="stat-icon text-orange-500" size={24} />
                    </div>
                    <div className="stat-value text-lg">{formatCurrency(totalStockValue)}</div>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${activeTab === 'warehouses' ? 'active' : ''}`} onClick={() => setActiveTab('warehouses')}>{t('warehouse.warehouses', 'Склады')}</button>
                <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>{t('warehouse.stock', 'Остатки')}</button>
                <button className={`tab ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>{t('warehouse.movements', 'Движения')}</button>
            </div>

            {activeTab === 'warehouses' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('warehouse.warehouseList', 'Список складов')}</h2>
                        <button className="btn btn-primary" onClick={() => handleOpenModal('warehouse')}>
                            <Plus size={20} /> {t('warehouse.newWarehouse', 'Новый склад')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {warehouses.map(warehouse => (
                            <div key={warehouse.id} className="card glass">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <WarehouseIcon size={20} className="text-blue-500" />
                                        <div>
                                            <h3 className="font-semibold">{warehouse.name}</h3>
                                            <p className="text-sm text-gray-500">{warehouse.code}</p>
                                        </div>
                                    </div>
                                    <span className={`badge ${warehouse.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                        {warehouse.is_active ? 'Активен' : 'Неактивен'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-secondary flex-1" onClick={() => handleOpenModal('warehouse', warehouse)}>
                                        <Edit size={16} /> Изменить
                                    </button>
                                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteWarehouse(warehouse.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('warehouse.stockBalances', 'Товарные остатки')}</h2>
                        <div className="flex gap-2">
                            <button className="btn btn-secondary" onClick={() => handleOpenModal('transfer')}>
                                <Plus size={20} /> Перемещение
                            </button>
                            <button className="btn btn-primary" onClick={() => handleOpenModal('movement')}>
                                <Plus size={20} /> Корректировка
                            </button>
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('warehouse.kod', 'Код')}</th>
                                    <th>{t('warehouse.naimenovanie', 'Наименование')}</th>
                                    <th>{t('warehouse.vsego', 'Всего')}</th>
                                    <th>{t('warehouse.srednyaya_tsena', 'Средняя цена')}</th>
                                    <th>{t('warehouse.stoimost', 'Стоимость')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stock.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.code}</td>
                                        <td className="font-medium">{item.name}</td>
                                        <td className="font-semibold">{item.total_quantity} {item.unit}</td>
                                        <td>{formatCurrency(item.avg_cost)}</td>
                                        <td className="font-semibold">{formatCurrency(item.total_quantity * item.avg_cost)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'movements' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('warehouse.movementHistory', 'История движений')}</h2>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('warehouse.data', 'Дата')}</th>
                                    <th>Товар</th>
                                    <th>Склад</th>
                                    <th>{t('warehouse.tip', 'Тип')}</th>
                                    <th>{t('warehouse.kolichestvo', 'Количество')}</th>
                                    <th>Пользователь</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map(movement => (
                                    <tr key={movement.id}>
                                        <td>{new Date(movement.movement_date).toLocaleString('ru-RU')}</td>
                                        <td>{movement.product_name}</td>
                                        <td>{movement.warehouse_name}</td>
                                        <td>{getDocumentTypeLabel(movement.document_type)}</td>
                                        <td className={movement.quantity >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                            {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                        </td>
                                        <td>{movement.user_name || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {modalType === 'warehouse' ? (editingItem ? 'Редактировать склад' : 'Новый склад') : modalType === 'movement' ? 'Корректировка остатков' : 'Перемещение товара'}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal}>×</button>
                        </div>
                        <form onSubmit={modalType === 'warehouse' ? handleSubmitWarehouse : modalType === 'movement' ? handleSubmitMovement : handleSubmitTransfer}>
                            <div className="modal-body">
                                {modalType === 'warehouse' ? (
                                    <div className="space-y-4">
                                        <div className="form-group">
                                            <label className="label required">{t('warehouse.kod', 'Код')}</label>
                                            <input type="text" className="input" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">Название</label>
                                            <input type="text" className="input" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                                        </div>
                                    </div>
                                ) : modalType === 'movement' ? (
                                    <div className="space-y-4">
                                        <div className="form-group">
                                            <label className="label required">Товар</label>
                                            <select className="input" value={formData.product_id || ''} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} required>
                                                <option value="">{t('warehouse.vyberite_tovar', 'Выберите товар')}</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">Склад</label>
                                            <select className="input" value={formData.warehouse_id || ''} onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })} required>
                                                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">{t('warehouse.kolichestvo', 'Количество')}</label>
                                            <input type="number" step="0.001" className="input" value={formData.quantity || 0} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })} required />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="form-group">
                                            <label className="label required">Товар</label>
                                            <select className="input" value={formData.product_id || ''} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} required>
                                                <option value="">{t('warehouse.vyberite_tovar', 'Выберите товар')}</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">{t('warehouse.so_sklada', 'Со склада')}</label>
                                            <select className="input" value={formData.from_warehouse_id || ''} onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })} required>
                                                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">{t('warehouse.na_sklad', 'На склад')}</label>
                                            <select className="input" value={formData.to_warehouse_id || ''} onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })} required>
                                                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label required">{t('warehouse.kolichestvo', 'Количество')}</label>
                                            <input type="number" step="0.001" className="input" value={formData.quantity || 0} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })} required />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>{t('common.cancel')}</button>
                                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Warehouse;
