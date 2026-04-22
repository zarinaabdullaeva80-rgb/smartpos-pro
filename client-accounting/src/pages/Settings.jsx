import React, { useState, useEffect } from 'react';
import { Save, Plus, Edit2, Trash2, MapPin, Building2, Receipt, RefreshCw, Server, Scan, Printer } from 'lucide-react';
import ServerStatus from '../components/ServerStatus';
import api, { settingsAPI, categoriesAPI, warehousesAPI } from '../services/api';
import '../styles/Settings.css';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Settings() {
    const toast = useToast();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('categories'); // categories, warehouses, taxes, sync
    const [loading, setLoading] = useState(false);

    // Categories state
    const [categories, setCategories] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategory, setNewCategory] = useState({ name: '', description: '', parent_id: null, sort_order: 0 });

    // Warehouses state
    const [warehouses, setWarehouses] = useState([]);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [newWarehouse, setNewWarehouse] = useState({
        code: '',
        name: '',
        address: '',
        responsible_person: '',
        phone: '',
        email: '',
        latitude: '',
        longitude: '',
        working_hours: '',
        capacity: ''
    });

    // Settings state
    const [taxSettings, setTaxSettings] = useState({ vat_rates: [0, 10, 20], default_vat: 20, tax_period: 'monthly' });
    const [syncSettings, setSyncSettings] = useState({ auto_sync: true, sync_interval: 300, conflict_resolution: 'server_wins' });

    // Hardware settings state
    const [hardwareSettings, setHardwareSettings] = useState(() => {
        const saved = localStorage.getItem('hardware_settings');
        return saved ? JSON.parse(saved) : {
            scanner: {
                type: 'usb', // 'usb' | 'com'
                comPort: 'COM3',
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                autoAdd: true,
                soundEnabled: true
            },
            printer: {
                enabled: false,
                model: 'xprinter', // 'xprinter' | 'epson' | 'atol'
                connectionType: 'usb', // 'usb' | 'com' | 'network'
                comPort: 'COM1',
                baudRate: 115200,
                networkIp: '192.168.1.100',
                networkPort: 9100,
                paperWidth: 80, // 58 | 80
                autoPrint: true,
                printCopy: 1,
                encoding: 'cp866',
                companyName: '',
                companyAddress: '',
                companyPhone: '',
                footerText: 'Спасибо за покупку!'
            }
        };
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'categories') {
                const response = await api.get('/categories');
                setCategories(response.data.categories || []);
            } else if (activeTab === 'warehouses') {
                const response = await api.get('/warehouses');
                setWarehouses(response.data.warehouses || []);
            } else if (activeTab === 'taxes') {
                const response = await api.get('/settings/taxes/config');
                setTaxSettings(response.data);
            } else if (activeTab === 'sync') {
                const response = await api.get('/settings/sync/config');
                setSyncSettings(response.data);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    // Categories handlers
    const handleSaveCategory = async () => {
        try {
            if (editingCategory) {
                await api.put(`/categories/${editingCategory.id}`, editingCategory);
            } else {
                await api.post('/categories', newCategory);
                setNewCategory({ name: '', description: '', parent_id: null, sort_order: 0 });
            }
            setEditingCategory(null);
            loadData();
        } catch (error) {
            console.error('Error saving category:', error);
            toast.error('Ошибка сохранения категории');
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('Удалить категорию?')) return;
        try {
            await api.delete(`/categories/${id}`);
            loadData();
        } catch (error) {
            console.error('Error deleting category:', error);
            toast.error('Ошибка удаления категории');
        }
    };

    // Warehouses handlers
    const handleSaveWarehouse = async () => {
        try {
            if (editingWarehouse) {
                await api.put(`/warehouses/${editingWarehouse.id}`, editingWarehouse);
            } else {
                await api.post('/warehouses', newWarehouse);
                setNewWarehouse({
                    code: '', name: '', address: '', responsible_person: '',
                    phone: '', email: '', latitude: '', longitude: '',
                    working_hours: '', capacity: ''
                });
            }
            setEditingWarehouse(null);
            loadData();
        } catch (error) {
            console.error('Error saving warehouse:', error);
            toast.error('Ошибка сохранения склада');
        }
    };

    const handleDeleteWarehouse = async (id) => {
        if (!confirm('Удалить склад?')) return;
        try {
            await api.delete(`/warehouses/${id}`);
            loadData();
        } catch (error) {
            console.error('Error deleting warehouse:', error);
            toast.info(error.response?.data?.error || 'Ошибка удаления склада');
        }
    };

    // Settings handlers
    const handleSaveTaxSettings = async () => {
        try {
            await api.put('/settings/taxes/config', taxSettings);
            toast.success('Настройки налогов сохранены');
        } catch (error) {
            console.error('Error saving tax settings:', error);
            toast.error('Ошибка сохранения настроек');
        }
    };

    const handleSaveSyncSettings = async () => {
        try {
            await api.put('/settings/sync/config', syncSettings);
            toast.success('Настройки синхронизации сохранены');
        } catch (error) {
            console.error('Error saving sync settings:', error);
            toast.error('Ошибка сохранения настроек');
        }
    };

    // Build category tree
    const buildCategoryTree = (categories, parentId = null) => {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .map(cat => ({
                ...cat,
                children: buildCategoryTree(categories, cat.id)
            }));
    };

    const categoryTree = buildCategoryTree(categories);

    const renderCategoryTree = (categories, level = 0) => {
        return categories.map(cat => (
            <React.Fragment key={cat.id}>
                <tr>
                    <td style={{ paddingLeft: `${level * 20 + 10}px` }}>
                        {level > 0 && '└─ '}
                        {cat.name}
                    </td>
                    <td>{cat.description}</td>
                    <td>{cat.products_count || 0}</td>
                    <td>
                        <span className={`badge ${cat.is_active ? 'badge-success' : 'badge-secondary'}`}>
                            {cat.is_active ? 'Активна' : 'Неактивна'}
                        </span>
                    </td>
                    <td>
                        <div className="action-buttons">
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditingCategory(cat)}>
                                <Edit2 size={14} />
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCategory(cat.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </td>
                </tr>
                {cat.children && cat.children.length > 0 && renderCategoryTree(cat.children, level + 1)}
            </React.Fragment>
        ));
    };

    return (
        <div className="settings-page">
            <div className="page-header">
                <h1>{t('settings.title')}</h1>
                <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                    {t('common.refresh', 'Обновить')}
                </button>
            </div>

            {/* Tabs Navigation */}
            <div className="settings-tabs">
                <button
                    className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
                    onClick={() => setActiveTab('categories')}
                >
                    <Building2 size={18} />
                    {t('settings.categories', 'Категории товаров')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'warehouses' ? 'active' : ''}`}
                    onClick={() => setActiveTab('warehouses')}
                >
                    <MapPin size={18} />
                    {t('settings.warehouses', 'Склады')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'taxes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('taxes')}
                >
                    <Receipt size={18} />
                    {t('settings.taxes', 'Налоги и НДС')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'sync' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sync')}
                >
                    <RefreshCw size={18} />
                    {t('settings.sync', 'Синхронизация')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'server' ? 'active' : ''}`}
                    onClick={() => setActiveTab('server')}
                >
                    <Server size={18} />
                    {t('settings.serverMobile', 'Сервер и мобильные')}
                </button>
                <button
                    className={`tab-button ${activeTab === 'hardware' ? 'active' : ''}`}
                    onClick={() => setActiveTab('hardware')}
                >
                    <Scan size={18} />
                    Оборудование
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Categories Tab */}
                {activeTab === 'categories' && (
                    <div className="categories-tab">
                        <div className="content-section">
                            <h3>{t('settings.sozdat_kategoriyu', 'Создать категорию')}</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('settings.nazvanie', 'Название *')}</label>
                                    <input
                                        type="text"
                                        value={editingCategory ? editingCategory.name : newCategory.name}
                                        onChange={(e) => editingCategory
                                            ? setEditingCategory({ ...editingCategory, name: e.target.value })
                                            : setNewCategory({ ...newCategory, name: e.target.value })
                                        }
                                        placeholder="Название категории"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.opisanie', 'Описание')}</label>
                                    <input
                                        type="text"
                                        value={editingCategory ? editingCategory.description : newCategory.description}
                                        onChange={(e) => editingCategory
                                            ? setEditingCategory({ ...editingCategory, description: e.target.value })
                                            : setNewCategory({ ...newCategory, description: e.target.value })
                                        }
                                        placeholder="Описание"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.roditelskaya_kategoriya', 'Родительская категория')}</label>
                                    <select
                                        value={editingCategory ? editingCategory.parent_id || '' : newCategory.parent_id || ''}
                                        onChange={(e) => editingCategory
                                            ? setEditingCategory({ ...editingCategory, parent_id: e.target.value || null })
                                            : setNewCategory({ ...newCategory, parent_id: e.target.value || null })
                                        }
                                    >
                                        <option value="">{t('settings.net_kornevaya', 'Нет (корневая)')}</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.sortirovka', 'Сортировка')}</label>
                                    <input
                                        type="number"
                                        value={editingCategory ? editingCategory.sort_order : newCategory.sort_order}
                                        onChange={(e) => editingCategory
                                            ? setEditingCategory({ ...editingCategory, sort_order: parseInt(e.target.value) })
                                            : setNewCategory({ ...newCategory, sort_order: parseInt(e.target.value) })
                                        }
                                        style={{ width: '100px' }}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={handleSaveCategory}>
                                    <Save size={18} />
                                    {editingCategory ? 'Сохранить' : 'Создать'}
                                </button>
                                {editingCategory && (
                                    <button className="btn btn-secondary" onClick={() => setEditingCategory(null)}>
                                        Отмена
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="content-section">
                            <h3>{t('settings.spisok_kategoriy', 'Список категорий')}</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('settings.nazvanie', 'Название')}</th>
                                        <th>{t('settings.opisanie', 'Описание')}</th>
                                        <th>{t('settings.tovarov', 'Товаров')}</th>
                                        <th>{t('settings.status', 'Статус')}</th>
                                        <th>{t('settings.deystviya', 'Действия')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoryTree.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center">{t('settings.net_kategoriy', 'Нет категорий')}</td></tr>
                                    ) : (
                                        renderCategoryTree(categoryTree)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Warehouses Tab */}
                {activeTab === 'warehouses' && (
                    <div className="warehouses-tab">
                        <div className="content-section">
                            <h3>{editingWarehouse ? 'Редактировать склад' : 'Создать склад'}</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('settings.kod', 'Код *')}</label>
                                    <input
                                        type="text"
                                        value={editingWarehouse ? editingWarehouse.code : newWarehouse.code}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, code: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, code: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.nazvanie', 'Название *')}</label>
                                    <input
                                        type="text"
                                        value={editingWarehouse ? editingWarehouse.name : newWarehouse.name}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, name: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, name: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group full-width">
                                    <label>{t('settings.adres', 'Адрес')}</label>
                                    <input
                                        type="text"
                                        value={editingWarehouse ? editingWarehouse.address : newWarehouse.address}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, address: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, address: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.otvetstvennyy', 'Ответственный')}</label>
                                    <input
                                        type="text"
                                        value={editingWarehouse ? editingWarehouse.responsible_person : newWarehouse.responsible_person}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, responsible_person: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, responsible_person: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.telefon', 'Телефон')}</label>
                                    <input
                                        type="tel"
                                        value={editingWarehouse ? editingWarehouse.phone : newWarehouse.phone}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, phone: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, phone: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={editingWarehouse ? editingWarehouse.email : newWarehouse.email}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, email: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, email: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.rabochie_chasy', 'Рабочие часы')}</label>
                                    <input
                                        type="text"
                                        value={editingWarehouse ? editingWarehouse.working_hours : newWarehouse.working_hours}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, working_hours: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, working_hours: e.target.value })
                                        }
                                        placeholder="Пн-Пт 9:00-18:00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.shirota', 'Широта')}</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={editingWarehouse ? editingWarehouse.latitude : newWarehouse.latitude}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, latitude: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, latitude: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.dolgota', 'Долгота')}</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={editingWarehouse ? editingWarehouse.longitude : newWarehouse.longitude}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, longitude: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, longitude: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.vmestimost_m', 'Вместимость (м³)')}</label>
                                    <input
                                        type="number"
                                        value={editingWarehouse ? editingWarehouse.capacity : newWarehouse.capacity}
                                        onChange={(e) => editingWarehouse
                                            ? setEditingWarehouse({ ...editingWarehouse, capacity: e.target.value })
                                            : setNewWarehouse({ ...newWarehouse, capacity: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-primary" onClick={handleSaveWarehouse}>
                                    <Save size={18} />
                                    {editingWarehouse ? 'Сохранить' : 'Создать'}
                                </button>
                                {editingWarehouse && (
                                    <button className="btn btn-secondary" onClick={() => setEditingWarehouse(null)}>
                                        Отмена
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="content-section">
                            <h3>{t('settings.spisok_skladov', 'Список складов')}</h3>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('settings.kod', 'Код')}</th>
                                        <th>{t('settings.nazvanie', 'Название')}</th>
                                        <th>{t('settings.adres', 'Адрес')}</th>
                                        <th>{t('settings.otvetstvennyy', 'Ответственный')}</th>
                                        <th>{t('settings.telefon', 'Телефон')}</th>
                                        <th>{t('settings.status', 'Статус')}</th>
                                        <th>{t('settings.deystviya', 'Действия')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {warehouses.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center">{t('settings.net_skladov', 'Нет складов')}</td></tr>
                                    ) : (
                                        warehouses.map(warehouse => (
                                            <tr key={warehouse.id}>
                                                <td><code>{warehouse.code}</code></td>
                                                <td>{warehouse.name}</td>
                                                <td>{warehouse.address}</td>
                                                <td>{warehouse.responsible_person}</td>
                                                <td>{warehouse.phone}</td>
                                                <td>
                                                    <span className={`badge ${warehouse.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                                        {warehouse.is_active ? 'Активен' : 'Неактивен'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingWarehouse(warehouse)}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteWarehouse(warehouse.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Taxes Tab */}
                {activeTab === 'taxes' && (
                    <div className="taxes-tab">
                        <div className="content-section">
                            <h3>{t('settings.nastroyki_nalogov_i_nds', 'Настройки налогов и НДС')}</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>{t('settings.stavka_nds_po_umolchaniyu_pct', 'Ставка НДС по умолчанию (%)')}</label>
                                    <select
                                        value={taxSettings.default_vat}
                                        onChange={(e) => setTaxSettings({ ...taxSettings, default_vat: parseInt(e.target.value) })}
                                    >
                                        <option value="0">{t('settings.pct_bez_nds', '0% (без НДС)')}</option>
                                        <option value="10">10%</option>
                                        <option value="20">20%</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.nalogovyy_period', 'Налоговый период')}</label>
                                    <select
                                        value={taxSettings.tax_period}
                                        onChange={(e) => setTaxSettings({ ...taxSettings, tax_period: e.target.value })}
                                    >
                                        <option value="monthly">{t('settings.ezhemesyachno', 'Ежемесячно')}</option>
                                        <option value="quarterly">{t('settings.ezhekvartalno', 'Ежеквартально')}</option>
                                    </select>
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={handleSaveTaxSettings}>
                                <Save size={18} />
                                Сохранить настройки
                            </button>
                        </div>
                    </div>
                )}

                {/* Sync Tab */}
                {activeTab === 'sync' && (
                    <div className="sync-tab">
                        <div className="content-section">
                            <h3>{t('settings.parametry_sinhronizatsii', 'Параметры синхронизации')}</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={syncSettings.auto_sync}
                                            onChange={(e) => setSyncSettings({ ...syncSettings, auto_sync: e.target.checked })}
                                        />
                                        {' '}Автоматическая синхронизация
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.interval_sinhronizatsii_sek', 'Интервал синхронизации (сек)')}</label>
                                    <input
                                        type="number"
                                        value={syncSettings.sync_interval}
                                        onChange={(e) => setSyncSettings({ ...syncSettings, sync_interval: parseInt(e.target.value) })}
                                        min="60"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('settings.razreshenie_konfliktov', 'Разрешение конфликтов')}</label>
                                    <select
                                        value={syncSettings.conflict_resolution}
                                        onChange={(e) => setSyncSettings({ ...syncSettings, conflict_resolution: e.target.value })}
                                    >
                                        <option value="server_wins">{t('settings.prioritet_servera', 'Приоритет сервера')}</option>
                                        <option value="client_wins">{t('settings.prioritet_klienta', 'Приоритет клиента')}</option>
                                        <option value="manual">{t('settings.vruchnuyu', 'Вручную')}</option>
                                    </select>
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={handleSaveSyncSettings}>
                                <Save size={18} />
                                Сохранить настройки
                            </button>
                        </div>
                    </div>
                )}

                {/* Server Tab */}
                {activeTab === 'server' && (
                    <div className="server-tab">
                        <ServerStatus />
                    </div>
                )}

                {/* Hardware Tab — Сканеры и Принтеры */}
                {activeTab === 'hardware' && (
                    <div className="hardware-tab">
                        {/* ── Сканер штрих-кодов ── */}
                        <div className="content-section">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Scan size={20} /> Сканер штрих-кодов
                            </h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Тип подключения</label>
                                    <select
                                        value={hardwareSettings.scanner.type}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, type: e.target.value } }))}
                                    >
                                        <option value="usb">USB HID (клавиатура)</option>
                                        <option value="com">COM-порт (RS-232)</option>
                                    </select>
                                </div>

                                {hardwareSettings.scanner.type === 'com' && (
                                    <>
                                        <div className="form-group">
                                            <label>COM-порт</label>
                                            <select
                                                value={hardwareSettings.scanner.comPort}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, comPort: e.target.value } }))}
                                            >
                                                {['COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','COM10'].map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Скорость (бод)</label>
                                            <select
                                                value={hardwareSettings.scanner.baudRate}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, baudRate: parseInt(e.target.value) } }))}
                                            >
                                                {[4800, 9600, 19200, 38400, 57600, 115200].map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Биты данных</label>
                                            <select
                                                value={hardwareSettings.scanner.dataBits}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, dataBits: parseInt(e.target.value) } }))}
                                            >
                                                <option value={7}>7</option>
                                                <option value={8}>8</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Стоп-биты</label>
                                            <select
                                                value={hardwareSettings.scanner.stopBits}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, stopBits: parseInt(e.target.value) } }))}
                                            >
                                                <option value={1}>1</option>
                                                <option value={2}>2</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Чётность</label>
                                            <select
                                                value={hardwareSettings.scanner.parity}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, parity: e.target.value } }))}
                                            >
                                                <option value="none">Нет</option>
                                                <option value="even">Чётная</option>
                                                <option value="odd">Нечётная</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={hardwareSettings.scanner.autoAdd}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, autoAdd: e.target.checked } }))}
                                        />{' '}Авто-добавление в продажу
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={hardwareSettings.scanner.soundEnabled}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, scanner: { ...prev.scanner, soundEnabled: e.target.checked } }))}
                                        />{' '}Звук сканирования
                                    </label>
                                </div>
                            </div>
                            {hardwareSettings.scanner.type === 'usb' && (
                                <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', fontSize: '12px', color: '#10b981', marginTop: '10px' }}>
                                    💡 USB HID-сканеры работают как клавиатура — подключите и сканируйте.
                                    Фокус должен быть на поле ввода штрих-кода.
                                </div>
                            )}
                        </div>

                        {/* ── Принтер чеков ── */}
                        <div className="content-section" style={{ marginTop: '20px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Printer size={20} /> Принтер чеков
                            </h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={hardwareSettings.printer.enabled}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, enabled: e.target.checked } }))}
                                        />{' '}Принтер включён
                                    </label>
                                </div>

                                <div className="form-group">
                                    <label>Модель принтера</label>
                                    <select
                                        value={hardwareSettings.printer.model}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, model: e.target.value } }))}
                                    >
                                        <option value="xprinter">XPrinter (ESC/POS)</option>
                                        <option value="epson">Epson TM (ESC/POS)</option>
                                        <option value="atol">АТОЛ (ESC/POS)</option>
                                        <option value="custom">Другой (ESC/POS)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Тип подключения</label>
                                    <select
                                        value={hardwareSettings.printer.connectionType}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, connectionType: e.target.value } }))}
                                    >
                                        <option value="usb">USB</option>
                                        <option value="com">COM-порт</option>
                                        <option value="network">Сеть (TCP/IP)</option>
                                    </select>
                                </div>

                                {hardwareSettings.printer.connectionType === 'com' && (
                                    <>
                                        <div className="form-group">
                                            <label>COM-порт</label>
                                            <select
                                                value={hardwareSettings.printer.comPort}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, comPort: e.target.value } }))}
                                            >
                                                {['COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','COM10'].map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Скорость (бод)</label>
                                            <select
                                                value={hardwareSettings.printer.baudRate}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, baudRate: parseInt(e.target.value) } }))}
                                            >
                                                {[9600, 19200, 38400, 57600, 115200].map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {hardwareSettings.printer.connectionType === 'network' && (
                                    <>
                                        <div className="form-group">
                                            <label>IP-адрес</label>
                                            <input
                                                type="text"
                                                value={hardwareSettings.printer.networkIp}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, networkIp: e.target.value } }))}
                                                placeholder="192.168.1.100"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Порт</label>
                                            <input
                                                type="number"
                                                value={hardwareSettings.printer.networkPort}
                                                onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, networkPort: parseInt(e.target.value) } }))}
                                                placeholder="9100"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="form-group">
                                    <label>Ширина бумаги</label>
                                    <select
                                        value={hardwareSettings.printer.paperWidth}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, paperWidth: parseInt(e.target.value) } }))}
                                    >
                                        <option value={58}>58 мм</option>
                                        <option value={80}>80 мм</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Кодировка</label>
                                    <select
                                        value={hardwareSettings.printer.encoding}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, encoding: e.target.value } }))}
                                    >
                                        <option value="cp866">CP866 (DOS)</option>
                                        <option value="cp1251">CP1251 (Windows)</option>
                                        <option value="utf8">UTF-8</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Кол-во копий</label>
                                    <input
                                        type="number" min="1" max="5"
                                        value={hardwareSettings.printer.printCopy}
                                        onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, printCopy: parseInt(e.target.value) || 1 } }))}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={hardwareSettings.printer.autoPrint}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, autoPrint: e.target.checked } }))}
                                        />{' '}Авто-печать после продажи
                                    </label>
                                </div>
                            </div>

                            {/* Шапка чека */}
                            <div style={{ marginTop: '16px' }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Шапка чека</h4>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Название компании</label>
                                        <input
                                            type="text"
                                            value={hardwareSettings.printer.companyName}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, companyName: e.target.value } }))}
                                            placeholder="SmartPOS Pro"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Адрес</label>
                                        <input
                                            type="text"
                                            value={hardwareSettings.printer.companyAddress}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, companyAddress: e.target.value } }))}
                                            placeholder="г. Душанбе, ул. ..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Телефон</label>
                                        <input
                                            type="text"
                                            value={hardwareSettings.printer.companyPhone}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, companyPhone: e.target.value } }))}
                                            placeholder="+992 ..."
                                        />
                                    </div>
                                    <div className="form-group full-width">
                                        <label>Текст внизу чека</label>
                                        <input
                                            type="text"
                                            value={hardwareSettings.printer.footerText}
                                            onChange={e => setHardwareSettings(prev => ({ ...prev, printer: { ...prev.printer, footerText: e.target.value } }))}
                                            placeholder="Спасибо за покупку!"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Кнопка сохранения */}
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    localStorage.setItem('hardware_settings', JSON.stringify(hardwareSettings));
                                    toast.success('Настройки оборудования сохранены');
                                }}
                            >
                                <Save size={18} />
                                Сохранить настройки
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    // Test beep
                                    try {
                                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                                        const osc = ctx.createOscillator();
                                        osc.type = 'sine';
                                        osc.frequency.value = 1200;
                                        osc.connect(ctx.destination);
                                        osc.start();
                                        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
                                        toast.success('🔊 Звуковой тест пройден');
                                    } catch(e) {
                                        toast.error('Звук не поддерживается');
                                    }
                                }}
                            >
                                🔊 Тест звука
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Settings;
