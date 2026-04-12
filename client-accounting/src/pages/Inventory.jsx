import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Plus, Play, Check, FileText, AlertTriangle, Search, BarChart3, X, Printer, Download, RefreshCw } from 'lucide-react';
import '../styles/Common.css';
import { inventoryAPI, warehousesAPI, productsAPI } from '../services/api';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';
import { useI18n } from '../i18n';

const Inventory = () => {
    const { t } = useI18n();
    const [inventories, setInventories] = useState([]);
    const [selectedInventory, setSelectedInventory] = useState(null);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [scanMode, setScanMode] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
    const { handleSuccess, handleError } = useActionHandler();
    const scanInputRef = useRef(null);
    const debounceTimers = useRef({});

    useEffect(() => {
        loadInventories();
        loadWarehouses();
    }, []);

    const loadInventories = async () => {
        setLoading(true);
        try {
            const response = await inventoryAPI.getAll({ status: filterStatus || undefined });
            setInventories(response.data?.inventories || response.data || []);
        } catch (error) {
            console.error('Error loading inventories:', error);
            handleError('Не удалось загрузить инвентаризации');
            setInventories([]);
        } finally {
            setLoading(false);
        }
    };

    const loadWarehouses = async () => {
        try {
            const response = await warehousesAPI.getAll();
            setWarehouses(response.data?.warehouses || response.data || []);
        } catch (error) {
            console.error('Error loading warehouses:', error);
        }
    };

    const loadInventoryDetails = async (id) => {
        try {
            const response = await inventoryAPI.getById(id);
            setSelectedInventory(response.data || response);
        } catch (error) {
            console.error('Error loading inventory details:', error);
            handleError('Не удалось загрузить детали инвентаризации');
        }
    };

    const createInventory = async (data) => {
        try {
            const response = await inventoryAPI.create(data);
            handleSuccess('Инвентаризация создана');
            setShowCreateModal(false);
            loadInventories();
            if (response.data?.id) {
                loadInventoryDetails(response.data.id);
            }
        } catch (error) {
            console.error('Error creating inventory:', error);
            handleError('Ошибка создания инвентаризации');
        }
    };

    const startInventory = async (id) => {
        if (!confirm('Начать инвентаризацию? Будут зафиксированы текущие остатки.')) return;

        try {
            await inventoryAPI.start(id);
            handleSuccess('Инвентаризация начата — товары загружены');
            loadInventoryDetails(id);
            loadInventories();
        } catch (error) {
            console.error('Error starting inventory:', error);
            handleError('Ошибка запуска инвентаризации');
        }
    };

    // Debounced update to avoid flooding server on every keystroke
    const updateItem = (inventoryId, itemId, actualQuantity) => {
        // Clear previous timer for this item
        if (debounceTimers.current[itemId]) {
            clearTimeout(debounceTimers.current[itemId]);
        }

        // Update locally immediately for responsive UI
        setSelectedInventory(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId
                        ? {
                            ...item,
                            actual_quantity: actualQuantity === '' ? null : parseFloat(actualQuantity),
                            difference: actualQuantity === '' ? null : parseFloat(actualQuantity) - (item.expected_quantity || 0)
                        }
                        : item
                )
            };
        });

        // Debounce server update (500ms)
        debounceTimers.current[itemId] = setTimeout(async () => {
            try {
                await inventoryAPI.updateItem(inventoryId, itemId, {
                    actual_quantity: actualQuantity === '' ? null : parseFloat(actualQuantity)
                });
            } catch (error) {
                console.error('Error updating item:', error);
                handleError('Ошибка обновления позиции');
            }
        }, 500);
    };

    const completeInventory = async (id) => {
        if (!confirm('Завершить инвентаризацию? Будут проведены корректировки остатков.')) return;

        try {
            const response = await inventoryAPI.complete(id);
            const stats = response.data?.stats || { total_items: 0, items_with_difference: 0 };
            handleSuccess(`Инвентаризация завершена! Обработано: ${stats.total_items}, Расхождений: ${stats.items_with_difference}`);
            loadInventories();
            loadInventoryDetails(id);
        } catch (error) {
            console.error('Error completing inventory:', error);
            handleError('Ошибка завершения инвентаризации');
        }
    };

    // Barcode scan handler — finds item and focuses its input
    const handleBarcodeScan = (e) => {
        if (e.key === 'Enter' && scannedBarcode) {
            const items = selectedInventory?.items || [];
            const item = items.find(i =>
                i.barcode === scannedBarcode ||
                i.sku === scannedBarcode ||
                i.product_name?.toLowerCase().includes(scannedBarcode.toLowerCase())
            );
            if (item) {
                // Scroll to and highlight the found item
                const inputEl = document.getElementById(`qty-input-${item.id}`);
                if (inputEl) {
                    inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    inputEl.focus();
                    inputEl.select();
                    handleSuccess(`✅ ${item.product_name}`);
                }
            } else {
                handleError(`Товар со штрих-кодом "${scannedBarcode}" не найден`);
            }
            setScannedBarcode('');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            draft: '#6c757d',
            in_progress: '#ffc107',
            completed: '#28a745',
            cancelled: '#dc3545'
        };
        return colors[status] || '#6c757d';
    };

    const getStatusText = (status) => {
        const texts = {
            draft: 'Черновик',
            in_progress: 'В процессе',
            completed: 'Завершена',
            cancelled: 'Отменена'
        };
        return texts[status] || status;
    };

    // Computed statistics
    const stats = useMemo(() => {
        if (!selectedInventory?.items) return null;
        const items = selectedInventory.items;
        const counted = items.filter(i => i.actual_quantity !== null && i.actual_quantity !== undefined);
        const withDiff = items.filter(i =>
            i.actual_quantity !== null && i.actual_quantity !== undefined &&
            i.actual_quantity !== i.expected_quantity
        );
        const surplus = withDiff.filter(i => i.actual_quantity > i.expected_quantity);
        const shortage = withDiff.filter(i => i.actual_quantity < i.expected_quantity);

        return {
            total: items.length,
            counted: counted.length,
            progress: items.length > 0 ? Math.round((counted.length / items.length) * 100) : 0,
            differences: withDiff.length,
            surplus: surplus.length,
            shortage: shortage.length,
            surplusSum: surplus.reduce((s, i) => s + (i.actual_quantity - i.expected_quantity), 0),
            shortageSum: shortage.reduce((s, i) => s + (i.expected_quantity - i.actual_quantity), 0)
        };
    }, [selectedInventory]);

    // Filtered items for display
    const filteredItems = useMemo(() => {
        if (!selectedInventory?.items) return [];
        let items = selectedInventory.items;

        if (itemSearch) {
            const q = itemSearch.toLowerCase();
            items = items.filter(i =>
                i.product_name?.toLowerCase().includes(q) ||
                i.sku?.toLowerCase().includes(q) ||
                i.barcode?.includes(q)
            );
        }

        if (showDifferencesOnly) {
            items = items.filter(i =>
                i.actual_quantity !== null && i.actual_quantity !== undefined &&
                i.actual_quantity !== i.expected_quantity
            );
        }

        return items;
    }, [selectedInventory, itemSearch, showDifferencesOnly]);

    // Filtered inventories list
    const filteredInventories = useMemo(() => {
        if (!searchQuery) return inventories;
        const q = searchQuery.toLowerCase();
        return inventories.filter(inv =>
            inv.document_number?.toLowerCase().includes(q) ||
            inv.warehouse_name?.toLowerCase().includes(q)
        );
    }, [inventories, searchQuery]);

    // Print inventory results
    const handlePrint = () => {
        if (!selectedInventory) return;
        const printWindow = window.open('', '_blank');
        const items = filteredItems;
        printWindow.document.write(`
            <html>
            <head>
                <title>Инвентаризация ${selectedInventory.document_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { font-size: 18px; }
                    h2 { font-size: 14px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
                    th { background: #f5f5f5; font-weight: bold; }
                    .surplus { background: #e8f5e9; }
                    .shortage { background: #ffebee; }
                    .stats { display: flex; gap: 20px; margin: 10px 0; }
                    .stat { padding: 8px 12px; background: #f5f5f5; border-radius: 4px; }
                    @media print { body { margin: 10px; } }
                </style>
            </head>
            <body>
                <h1>📦 Инвентаризация ${selectedInventory.document_number}</h1>
                <h2>Склад: ${selectedInventory.warehouse_name || '-'} | 
                    Дата: ${new Date(selectedInventory.document_date).toLocaleDateString('ru-RU')} |
                    Статус: ${getStatusText(selectedInventory.status)}</h2>
                ${stats ? `
                    <div class="stats">
                        <div class="stat">{t('inventory.vsego', 'Всего:')} <b>${stats.total}</b></div>
                        <div class="stat">{t('inventory.podschitano', 'Подсчитано:')} <b>${stats.counted}</b></div>
                        <div class="stat">{t('inventory.rashozhdeniy', 'Расхождений:')} <b>${stats.differences}</b></div>
                        <div class="stat" style="color:green">{t('inventory.izlishkov', 'Излишков:')} <b>${stats.surplus}</b> (+${stats.surplusSum})</div>
                        <div class="stat" style="color:red">{t('inventory.nedostach', 'Недостач:')} <b>${stats.shortage}</b> (-${stats.shortageSum})</div>
                    </div>
                ` : ''}
                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>{t('inventory.tovar', 'Товар')}</th>
                            <th>{t('inventory.artikul', 'Артикул')}</th>
                            <th>{t('inventory.shtrih_kod', 'Штрих-код')}</th>
                            <th>{t('inventory.ozhidaetsya', 'Ожидается')}</th>
                            <th>{t('inventory.fakticheski', 'Фактически')}</th>
                            <th>{t('inventory.raznitsa', 'Разница')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => {
            const diff = item.actual_quantity !== null ? item.actual_quantity - item.expected_quantity : null;
            const cls = diff > 0 ? 'surplus' : diff < 0 ? 'shortage' : '';
            return `<tr class="${cls}">
                                <td>${idx + 1}</td>
                                <td>${item.product_name}</td>
                                <td>${item.sku || '-'}</td>
                                <td>${item.barcode || '-'}</td>
                                <td>${item.expected_quantity}</td>
                                <td>${item.actual_quantity ?? '-'}</td>
                                <td>${diff !== null ? (diff > 0 ? '+' : '') + diff : '-'}</td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
                <p style="margin-top:20px;font-size:11px;color:#999">Дата печати: ${new Date().toLocaleString('ru-RU')}</p>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Package size={32} /> {t('inventory.title', 'Инвентаризация товаров')}</h1>
                    <p>{t('inventory.subtitle', 'Подсчёт фактических остатков и корректировки')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={inventories}
                        filename="Инвентаризации"
                        sheetName="Инвентаризации"
                        columns={{
                            document_number: 'Номер',
                            document_date: 'Дата',
                            warehouse_name: 'Склад',
                            status: 'Статус',
                            items_count: 'Позиций',
                            counted_items: 'Подсчитано'
                        }}
                    />
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={20} /> {t('inventory.newInventory', 'Новая инвентаризация')}
                    </button>
                </div>
            </div>

            <div className="inventory-layout">
                {/* Список инвентаризаций */}
                <div className="card inventories-list">
                    <h3>{t('inventory.documents', 'Документы')}</h3>

                    {/* Фильтр по статусу */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {[
                            { value: '', label: 'Все' },
                            { value: 'draft', label: 'Черновики' },
                            { value: 'in_progress', label: 'В работе' },
                            { value: 'completed', label: 'Завершённые' }
                        ].map(f => (
                            <button
                                key={f.value}
                                className={`btn btn-sm ${filterStatus === f.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setFilterStatus(f.value); setTimeout(loadInventories, 100); }}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Поиск по документам */}
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '6px 6px 6px 28px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                        />
                    </div>

                    {loading && <div style={{ textAlign: 'center', padding: '20px' }}><RefreshCw size={20} className="spin" /> {t('inventory.zagruzka', 'Загрузка...')}</div>}

                    {filteredInventories.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, fontSize: '13px' }}>
                            Инвентаризации не найдены
                        </div>
                    )}

                    {filteredInventories.map(inv => (
                        <div
                            key={inv.id}
                            className={`inventory-item ${selectedInventory?.id === inv.id ? 'active' : ''}`}
                            onClick={() => loadInventoryDetails(inv.id)}
                        >
                            <div className="inventory-header">
                                <strong>{inv.document_number}</strong>
                                <span className="badge" style={{ background: getStatusColor(inv.status), color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                    {getStatusText(inv.status)}
                                </span>
                            </div>
                            <div className="inventory-meta">
                                {new Date(inv.document_date).toLocaleDateString('ru-RU')} • {inv.warehouse_name}
                            </div>
                            <div className="inventory-meta">
                                Позиций: {inv.items_count || 0} • Подсчитано: {inv.counted_items || 0}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Детали инвентаризации */}
                {selectedInventory ? (
                    <div className="card inventory-details">
                        <div className="inventory-details-header">
                            <div>
                                <h2>{selectedInventory.document_number}</h2>
                                <p>Склад: {selectedInventory.warehouse_name} • Ответственный: {selectedInventory.responsible_name || 'Не указан'}</p>
                            </div>
                            <div className="action-buttons">
                                {selectedInventory.status === 'draft' && (
                                    <button className="btn btn-primary" onClick={() => startInventory(selectedInventory.id)}>
                                        <Play size={18} /> Начать
                                    </button>
                                )}
                                {selectedInventory.status === 'in_progress' && (
                                    <>
                                        <button
                                            className={`btn ${scanMode ? 'btn-warning' : 'btn-secondary'}`}
                                            onClick={() => {
                                                setScanMode(!scanMode);
                                                if (!scanMode) setTimeout(() => scanInputRef.current?.focus(), 100);
                                            }}
                                        >
                                            📷 {scanMode ? 'Выкл. сканер' : 'Вкл. сканер'}
                                        </button>
                                        <button className="btn btn-success" onClick={() => completeInventory(selectedInventory.id)}>
                                            <Check size={18} /> Завершить
                                        </button>
                                    </>
                                )}
                                <button className="btn btn-secondary" onClick={handlePrint} title={t('inventory.pechat', 'Печать')}>
                                    <Printer size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Статистика */}
                        {stats && (
                            <div className="stats-row">
                                <div className="stat-card">
                                    <div className="stat-value">{stats.total}</div>
                                    <div className="stat-label">{t('inventory.totalItems', 'Всего позиций')}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{stats.counted}<small>/{stats.total}</small></div>
                                    <div className="stat-label">{t('inventory.counted', 'Подсчитано')}</div>
                                    <div className="progress-bar-mini">
                                        <div style={{ width: `${stats.progress}%`, background: stats.progress === 100 ? '#28a745' : '#ffc107' }} />
                                    </div>
                                </div>
                                <div className="stat-card" style={{ borderLeft: '3px solid #dc3545' }}>
                                    <div className="stat-value" style={{ color: '#dc3545' }}>{stats.shortage}</div>
                                    <div className="stat-label">{t('inventory.shortages', 'Недостачи')} (−{stats.shortageSum})</div>
                                </div>
                                <div className="stat-card" style={{ borderLeft: '3px solid #28a745' }}>
                                    <div className="stat-value" style={{ color: '#28a745' }}>{stats.surplus}</div>
                                    <div className="stat-label">{t('inventory.surplus', 'Излишки')} (+{stats.surplusSum})</div>
                                </div>
                            </div>
                        )}

                        {/* Сканер штрих-кодов */}
                        {scanMode && (
                            <div className="scan-mode">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span>📷</span>
                                    <strong>{t('inventory.rezhim_skanera', 'Режим сканера')}</strong>
                                    <span style={{ fontSize: '12px', opacity: 0.7 }}>{t('inventory.skaniruyte_shtrih_kod_kursor_pereydyot_k', 'Сканируйте штрих-код — курсор перейдёт к товару')}</span>
                                </div>
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    value={scannedBarcode}
                                    onChange={e => setScannedBarcode(e.target.value)}
                                    onKeyDown={handleBarcodeScan}
                                    placeholder="Сканируйте штрих-код или введите артикул..."
                                    autoFocus
                                    className="scan-input"
                                />
                            </div>
                        )}

                        {/* Поиск и фильтр по товарам */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                <input
                                    type="text"
                                    placeholder="Поиск по товарам, артикулам, штрих-кодам..."
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    style={{ width: '100%', padding: '8px 8px 8px 32px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--text-color)' }}
                                />
                                {itemSearch && (
                                    <button onClick={() => setItemSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={showDifferencesOnly}
                                    onChange={e => setShowDifferencesOnly(e.target.checked)}
                                />
                                Только расхождения
                            </label>
                            <span style={{ fontSize: '12px', opacity: 0.6, whiteSpace: 'nowrap' }}>
                                {filteredItems.length} из {selectedInventory?.items?.length || 0}
                            </span>
                        </div>

                        {/* Таблица товаров */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '30px' }}>№</th>
                                        <th>{t('inventory.tovar', 'Товар')}</th>
                                        <th>{t('inventory.artikul', 'Артикул')}</th>
                                        <th>{t('inventory.shtrih_kod', 'Штрих-код')}</th>
                                        <th style={{ textAlign: 'right' }}>{t('inventory.ozhidaetsya', 'Ожидается')}</th>
                                        <th style={{ textAlign: 'center', width: '120px' }}>{t('inventory.fakticheski', 'Фактически')}</th>
                                        <th style={{ textAlign: 'right', width: '100px' }}>{t('inventory.raznitsa', 'Разница')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item, idx) => {
                                        const diff = item.actual_quantity !== null && item.actual_quantity !== undefined
                                            ? item.actual_quantity - (item.expected_quantity || 0)
                                            : null;
                                        return (
                                            <tr key={item.id} className={diff > 0 ? 'surplus' : diff < 0 ? 'shortage' : ''}>
                                                <td style={{ opacity: 0.5, fontSize: '12px' }}>{idx + 1}</td>
                                                <td><strong>{item.product_name}</strong></td>
                                                <td style={{ fontSize: '12px', opacity: 0.7 }}>{item.sku || '-'}</td>
                                                <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{item.barcode || '-'}</td>
                                                <td style={{ textAlign: 'right' }}>{item.expected_quantity}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {selectedInventory.status === 'in_progress' ? (
                                                        <input
                                                            id={`qty-input-${item.id}`}
                                                            type="number"
                                                            value={item.actual_quantity ?? ''}
                                                            onChange={e => updateItem(selectedInventory.id, item.id, e.target.value)}
                                                            className="qty-input"
                                                            step="0.001"
                                                            placeholder="—"
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    ) : (
                                                        <span>{item.actual_quantity ?? '—'}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: diff !== null && diff !== 0 ? 'bold' : 'normal' }}>
                                                    {diff !== null ? (
                                                        <span className={diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : ''}>
                                                            {diff > 0 ? '+' : ''}{diff}
                                                            {diff !== 0 && (
                                                                <AlertTriangle size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                                                            )}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredItems.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>
                                                {itemSearch || showDifferencesOnly ? 'Нет совпадений' : 'Нет позиций'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', opacity: 0.5, minHeight: '300px' }}>
                        <Package size={48} />
                        <p>{t('inventory.vyberite_inventarizatsiyu_iz_spiska_sleva', 'Выберите инвентаризацию из списка слева или создайте новую')}</p>
                    </div>
                )}
            </div>

            {/* Модальное окно создания */}
            {
                showCreateModal && (
                    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <h2>{t('inventory.newInventory', 'Новая инвентаризация')}</h2>
                            <form onSubmit={e => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                createInventory({
                                    warehouse_id: parseInt(formData.get('warehouse_id')),
                                    responsible_user_id: formData.get('responsible_user_id') || null,
                                    notes: formData.get('notes')
                                });
                            }}>
                                <div className="form-group">
                                    <label>{t('inventory.sklad', 'Склад *')}</label>
                                    <select name="warehouse_id" required>
                                        <option value="">{t('inventory.vyberite_sklad', 'Выберите склад')}</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t('inventory.primechaniya', 'Примечания')}</label>
                                    <textarea name="notes" rows={3} />
                                </div>
                                <div style={{ padding: '10px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
                                    💡 После создания нажмите <strong>{t('inventory.nachat', '"Начать"')}</strong> — все товары выбранного склада будут автоматически загружены с текущими остатками.
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                        {t('common.cancel')}
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {t('common.create')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <style>{`
                .inventory-layout {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 20px;
                    margin-top: 20px;
                }

                .inventories-list {
                    max-height: calc(100vh - 200px);
                    overflow-y: auto;
                }

                .inventory-item {
                    padding: 10px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 6px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .inventory-item:hover {
                    background: rgba(68, 114, 196, 0.1);
                }

                .inventory-item.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .inventory-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2px;
                }

                .inventory-meta {
                    font-size: 11px;
                    opacity: 0.8;
                    margin-top: 2px;
                }

                .inventory-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }

                .action-buttons {
                    display: flex;
                    gap: 8px;
                }

                /* Stats row */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .stat-card {
                    padding: 12px;
                    background: var(--card-bg, rgba(255,255,255,0.05));
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    line-height: 1;
                }

                .stat-value small {
                    font-size: 14px;
                    opacity: 0.5;
                }

                .stat-label {
                    font-size: 12px;
                    opacity: 0.6;
                    margin-top: 4px;
                }

                .progress-bar-mini {
                    height: 4px;
                    background: rgba(128,128,128,0.2);
                    border-radius: 2px;
                    margin-top: 6px;
                    overflow: hidden;
                }

                .progress-bar-mini > div {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.3s;
                }

                /* Scanner */
                .scan-mode {
                    background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                    color: #000;
                    padding: 12px 15px;
                    border-radius: 8px;
                    margin-bottom: 12px;
                }

                .scan-input {
                    width: 100%;
                    padding: 10px;
                    font-size: 16px;
                    border: 2px solid rgba(0,0,0,0.2);
                    border-radius: 6px;
                    background: rgba(255,255,255,0.9);
                    color: #000;
                }

                .scan-input:focus {
                    border-color: #000;
                    outline: none;
                }

                /* Qty input */
                .qty-input {
                    width: 90px;
                    padding: 6px 8px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--input-bg);
                    color: var(--text-color);
                    text-align: center;
                    font-size: 14px;
                    transition: border-color 0.2s;
                }

                .qty-input:focus {
                    border-color: var(--primary-color);
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(68, 114, 196, 0.2);
                }

                .qty-input::placeholder {
                    opacity: 0.3;
                }

                /* Table highlights */
                tr.surplus {
                    background: rgba(40, 167, 69, 0.08) !important;
                }

                tr.shortage {
                    background: rgba(220, 53, 69, 0.08) !important;
                }

                .text-success { color: #28a745; }
                .text-danger { color: #dc3545; }

                .btn-warning {
                    background: #ffc107;
                    color: #000;
                    border: none;
                }

                @media (max-width: 900px) {
                    .inventory-layout {
                        grid-template-columns: 1fr;
                    }
                    .stats-row {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
        </div >
    );
};

export default Inventory;
