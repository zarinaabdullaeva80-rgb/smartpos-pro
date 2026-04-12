import React, { useState, useEffect } from 'react';
import { sync1CAPI, categoriesAPI, productsAPI, counterpartiesAPI } from '../services/api';
import {
    CheckCircle, AlertCircle, FileText, Database, Upload, Settings,
    Download, RefreshCw, FolderTree, Package, Users, ShoppingCart,
    Loader, Check, X, ChevronRight, Link, Unlink, Play, Clock
} from 'lucide-react';
import { useI18n } from '../i18n';

function Implementation() {
    const { t } = useI18n();
    const [activeSection, setActiveSection] = useState('analysis');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(null);
    const [message, setMessage] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState({ total: 0 });
    const [syncSettings, setSyncSettings] = useState(null);
    const [syncLog, setSyncLog] = useState([]);
    const [migrationStatus, setMigrationStatus] = useState({
        categories: { done: false, count: 0 },
        products: { done: false, count: 0 },
        counterparties: { done: false, count: 0 },
        inventory: { done: false, count: 0 }
    });

    const token = localStorage.getItem('token');

    useEffect(() => {
        if (activeSection === 'migration') {
            loadCurrentData();
            loadSyncSettings();
            loadSyncLog();
        }
    }, [activeSection]);

    const loadSyncSettings = async () => {
        try {
            const apiRes = await sync1CAPI.getSettings();
            const apiData = apiRes.data || apiRes;
            if (apiData && typeof apiData === 'object') {
                setSyncSettings(apiData);
            }
        } catch (err) {
            console.warn('Implementation.jsx: API недоступен');
        }
        setLoading(false);
    };

    const loadSyncLog = async () => {
        try {
            const res = await sync1CAPI.getLog({ limit: 5 });
            const data = res.data || res;
            setSyncLog(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading sync log:', error);
        }
    };

    const loadCurrentData = async () => {
        try {
            // Загружаем категории
            const catsRes = await categoriesAPI.getAll();
            const catsData = catsRes.data || catsRes;
            const catsArray = Array.isArray(catsData) ? catsData : (catsData.categories || []);
            setCategories(catsArray);
            setMigrationStatus(prev => ({
                ...prev,
                categories: { done: catsArray.length > 0, count: catsArray.length }
            }));

            // Загружаем товары
            const prodsRes = await productsAPI.getAll({ limit: 1 });
            const prodsData = prodsRes.data || prodsRes;
            setProducts(prodsData);
            const prodsTotal = prodsData.total || (Array.isArray(prodsData) ? prodsData.length : 0);
            setMigrationStatus(prev => ({
                ...prev,
                products: { done: prodsTotal > 0, count: prodsTotal }
            }));

            // Загружаем контрагентов
            const countRes = await counterpartiesAPI.getAll({ limit: 1 });
            const countData = countRes.data || countRes;
            const countTotal = countData.total || (Array.isArray(countData) ? countData.length : 0);
            setMigrationStatus(prev => ({
                ...prev,
                counterparties: { done: countTotal > 0, count: countTotal }
            }));
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    // Синхронизация с реальной 1С
    const syncWith1C = async (syncType) => {
        if (!syncSettings?.['1c_api_url']) {
            setMessage({
                type: 'error',
                text: 'Сначала настройте подключение к 1С в разделе "Интеграция с 1С"'
            });
            return;
        }

        setSyncing(syncType);
        setMessage({ type: 'info', text: `Синхронизация ${syncType} с 1С...` });

        try {
            const res = await sync1CAPI.triggerSyncByType(syncType, { direction: 'import' });
            const data = res.data || res;
            setMessage({
                type: 'success',
                text: `Синхронизация ${syncType} запущена! ID задачи: ${data.queue_item?.id || 'N/A'}`
            });

            // Ждём и обновляем данные
            setTimeout(() => {
                loadCurrentData();
                loadSyncLog();
            }, 3000);
        } catch (error) {
            const errData = error.response?.data;
            setMessage({ type: 'error', text: errData?.error || error.message || 'Ошибка синхронизации' });
        } finally {
            setSyncing(null);
        }
    };

    // Импорт из файла (для ручного переноса)
    const handleFileImport = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setMessage({ type: 'info', text: `Загрузка ${type} из файла...` });

        try {
            const text = await file.text();
            let data;

            if (file.name.endsWith('.json')) {
                data = JSON.parse(text);
            } else if (file.name.endsWith('.csv')) {
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                data = lines.slice(1).filter(l => l.trim()).map(line => {
                    const values = line.split(',');
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h] = values[i]?.trim();
                    });
                    return obj;
                });
            }

            const res = type === 'categories'
                ? await sync1CAPI.importCategories({ categories: data })
                : await sync1CAPI.importProducts({ products: data });
            const result = res.data || res;

            setMessage({
                type: 'success',
                text: `Импортировано: ${result.imported}, обновлено: ${result.updated}`
            });
            await loadCurrentData();
            await loadSyncLog();
        } catch (error) {
            const errData = error.response?.data;
            setMessage({ type: 'error', text: errData?.error || error.message });
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString('ru-RU');
        } catch {
            return dateString;
        }
    };

    const sections = {
        analysis: {
            title: 'Анализ бизнес-процессов',
            icon: <FileText size={24} />,
            customContent: true
        },
        configuration: {
            title: 'Подбор модулей',
            icon: <Settings size={24} />,
            customContent: true
        },
        setup: {
            title: 'Настройка базы с нуля',
            icon: <Database size={24} />,
            customContent: true
        },
        migration: {
            title: 'Перенос данных',
            icon: <Upload size={24} />,
            customContent: true
        }
    };

    // Рендер секции "Анализ бизнес-процессов"
    const renderAnalysisContent = () => (
        <div>
            <div className="grid grid-2 gap-4 mb-4">
                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: '2px solid var(--color-primary)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={20} color="var(--color-success)" />
                        <span style={{ fontWeight: '600' }}>{t('implementation.vyyavlenie_potrebnostey', 'Выявление потребностей')}</span>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Определите основные задачи бизнеса и требования к системе
                    </p>
                    <a href="#/settings" className="btn btn-sm btn-primary" style={{ width: '100%' }}>
                        <Settings size={14} /> Перейти к настройкам
                    </a>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: '2px solid var(--color-border)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle size={20} color="var(--color-warning)" />
                        <span style={{ fontWeight: '600' }}>{t('implementation.analiz_protsessov', 'Анализ процессов')}</span>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Изучите текущие бизнес-процессы и найдите узкие места
                    </p>
                    <a href="#/reports" className="btn btn-sm btn-secondary" style={{ width: '100%' }}>
                        <FileText size={14} /> Просмотреть отчёты
                    </a>
                </div>
            </div>

            <div className="card mb-4">
                <h3 style={{ marginBottom: '1rem' }}>{t('implementation.chek_list_analiza', '📋 Чек-лист анализа')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                        { text: 'Определены основные бизнес-процессы', done: true },
                        { text: 'Выявлены узкие места', done: true },
                        { text: 'Собраны требования к системе', done: false },
                        { text: 'Сформировано техническое задание', done: false }
                    ].map((item, idx) => (
                        <div key={idx} style={{
                            padding: '0.75rem',
                            backgroundColor: item.done ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg-secondary)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            {item.done ? <Check size={18} color="var(--color-success)" /> : <X size={18} color="var(--color-text-muted)" />}
                            <span style={{ color: item.done ? 'var(--color-success)' : 'var(--color-text)' }}>{item.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // Рендер секции "Подбор модулей"
    const renderConfigurationContent = () => (
        <div>
            <div className="grid grid-2 gap-4 mb-4">
                {[
                    { name: 'POS - Точка продаж', icon: <ShoppingCart size={20} />, active: true, link: '#/sales' },
                    { name: 'Склад и инвентаризация', icon: <Package size={20} />, active: true, link: '#/warehouse' },
                    { name: 'Финансы и платежи', icon: <Database size={20} />, active: true, link: '#/finance' },
                    { name: 'CRM и лояльность', icon: <Users size={20} />, active: false, link: '#/crm' },
                    { name: 'Отчёты и аналитика', icon: <FileText size={20} />, active: true, link: '#/reports' },
                    { name: 'HR и зарплата', icon: <Users size={20} />, active: false, link: '#/employees' }
                ].map((module, idx) => (
                    <div key={idx} style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderRadius: '8px',
                        border: module.active ? '2px solid var(--color-success)' : '2px solid var(--color-border)'
                    }}>
                        <div className="flex items-center gap-2 mb-2">
                            {React.cloneElement(module.icon, { color: module.active ? 'var(--color-success)' : 'var(--color-text-muted)' })}
                            <span style={{ fontWeight: '600' }}>{module.name}</span>
                            {module.active && <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: module.active ? 'var(--color-success)' : 'var(--color-text-muted)',
                            marginBottom: '0.75rem'
                        }}>
                            {module.active ? '✓ Активен' : '○ Не активен'}
                        </div>
                        <a href={module.link} className="btn btn-sm btn-secondary" style={{ width: '100%' }}>
                            <ChevronRight size={14} /> Открыть модуль
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );

    // Рендер секции "Настройка базы с нуля"
    const renderSetupContent = () => (
        <div>
            <div className="grid grid-2 gap-4 mb-4">
                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: '2px solid var(--color-success)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Database size={20} color="var(--color-success)" />
                        <span style={{ fontWeight: '600' }}>{t('implementation.informatsionnaya_baza', 'Информационная база')}</span>
                        <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        База данных настроена и готова к работе
                    </p>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: migrationStatus.categories.done ? '2px solid var(--color-success)' : '2px solid var(--color-border)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <FolderTree size={20} color={migrationStatus.categories.done ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                        <span style={{ fontWeight: '600' }}>{t('implementation.spravochniki', 'Справочники')}</span>
                        {migrationStatus.categories.done && <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />}
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                        Категорий: {migrationStatus.categories.count}
                    </p>
                    <a href="#/categories" className="btn btn-sm btn-primary" style={{ width: '100%' }}>
                        <Settings size={14} /> Настроить справочники
                    </a>
                </div>
            </div>

            <div className="card mb-4">
                <h3 style={{ marginBottom: '1rem' }}>{t('implementation.bystrye_nastroyki', '⚙️ Быстрые настройки')}</h3>
                <div className="grid grid-2 gap-3">
                    <a href="#/settings" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                        <Settings size={16} /> Общие настройки
                    </a>
                    <a href="#/categories" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                        <FolderTree size={16} /> Категории товаров
                    </a>
                    <a href="#/permissions" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                        <Users size={16} /> Пользователи и роли
                    </a>
                    <a href="#/payment-settings" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                        <Database size={16} /> Способы оплаты
                    </a>
                </div>
            </div>
        </div>
    );

    const renderMigrationContent = () => (
        <div>
            {/* Статус подключения к 1С */}
            <div style={{
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: syncSettings?.['1c_api_url'] ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                border: `1px solid ${syncSettings?.['1c_api_url'] ? 'var(--color-success)' : 'var(--color-danger)'}`
            }}>
                <div className="flex items-center gap-2">
                    {syncSettings?.['1c_api_url'] ? (
                        <>
                            <Link size={20} color="var(--color-success)" />
                            <span style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                1С подключена: {syncSettings['1c_api_url']}
                            </span>
                        </>
                    ) : (
                        <>
                            <Unlink size={20} color="var(--color-danger)" />
                            <span style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                                1С не подключена
                            </span>
                            <a href="#/sync1c-settings" style={{ marginLeft: 'auto', color: 'var(--color-primary)' }}>
                                Настроить →
                            </a>
                        </>
                    )}
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : message.type === 'error' ? 'alert-danger' : 'alert-info'} mb-4`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> :
                        message.type === 'error' ? <AlertCircle size={20} /> :
                            <Loader size={20} className="spin" />}
                    {message.text}
                </div>
            )}

            {/* Статус миграции */}
            <div className="grid grid-2 gap-4 mb-4">
                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: migrationStatus.categories.done ? '2px solid var(--color-success)' : '2px solid var(--color-border)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <FolderTree size={20} color={migrationStatus.categories.done ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                        <span style={{ fontWeight: '600' }}>{t('implementation.kategorii_i_podkategorii', 'Категории и подкатегории')}</span>
                        {migrationStatus.categories.done && <Check size={18} color="var(--color-success)" />}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {migrationStatus.categories.count}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        {categories.filter(c => !c.parent_id).length} основных, {categories.filter(c => c.parent_id).length} подкатегорий
                    </div>
                    <button
                        onClick={() => syncWith1C('categories')}
                        disabled={syncing === 'categories' || !syncSettings?.['1c_api_url']}
                        className="btn btn-sm btn-primary mt-2"
                        style={{ width: '100%' }}
                    >
                        {syncing === 'categories' ? <Loader size={14} className="spin" /> : <Download size={14} />}
                        {syncing === 'categories' ? 'Синхронизация...' : 'Синхронизировать из 1С'}
                    </button>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: migrationStatus.products.done ? '2px solid var(--color-success)' : '2px solid var(--color-border)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Package size={20} color={migrationStatus.products.done ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                        <span style={{ fontWeight: '600' }}>{t('implementation.tovary_nomenklatura', 'Товары (Номенклатура)')}</span>
                        {migrationStatus.products.done && <Check size={18} color="var(--color-success)" />}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {migrationStatus.products.count}
                    </div>
                    <button
                        onClick={() => syncWith1C('products')}
                        disabled={syncing === 'products' || !syncSettings?.['1c_api_url']}
                        className="btn btn-sm btn-primary mt-2"
                        style={{ width: '100%' }}
                    >
                        {syncing === 'products' ? <Loader size={14} className="spin" /> : <Download size={14} />}
                        {syncing === 'products' ? 'Синхронизация...' : 'Синхронизировать из 1С'}
                    </button>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    border: migrationStatus.counterparties.done ? '2px solid var(--color-success)' : '2px solid var(--color-border)'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <Users size={20} color={migrationStatus.counterparties.done ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                        <span style={{ fontWeight: '600' }}>{t('implementation.kontragenty', 'Контрагенты')}</span>
                        {migrationStatus.counterparties.done && <Check size={18} color="var(--color-success)" />}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {migrationStatus.counterparties.count}
                    </div>
                    <button
                        onClick={() => syncWith1C('counterparties')}
                        disabled={syncing === 'counterparties' || !syncSettings?.['1c_api_url']}
                        className="btn btn-sm btn-primary mt-2"
                        style={{ width: '100%' }}
                    >
                        {syncing === 'counterparties' ? <Loader size={14} className="spin" /> : <Download size={14} />}
                        {syncing === 'counterparties' ? 'Синхронизация...' : 'Синхронизировать из 1С'}
                    </button>
                </div>

                <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderRadius: '8px'
                }}>
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart size={20} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: '600' }}>{t('implementation.nachalnye_ostatki', 'Начальные остатки')}</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                        {migrationStatus.inventory.count}
                    </div>
                    <button
                        onClick={() => syncWith1C('inventory')}
                        disabled={syncing === 'inventory' || !syncSettings?.['1c_api_url']}
                        className="btn btn-sm btn-primary mt-2"
                        style={{ width: '100%' }}
                    >
                        {syncing === 'inventory' ? <Loader size={14} className="spin" /> : <Download size={14} />}
                        {syncing === 'inventory' ? 'Синхронизация...' : 'Синхронизировать из 1С'}
                    </button>
                </div>
            </div>

            {/* Полная синхронизация */}
            <div className="card mb-4">
                <h3 style={{ marginBottom: '1rem' }}>{t('implementation.polnaya_sinhronizatsiya_s_s', '🔄 Полная синхронизация с 1С')}</h3>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => syncWith1C('all')}
                        disabled={syncing || !syncSettings?.['1c_api_url']}
                        className="btn btn-primary"
                    >
                        {syncing === 'all' ? <Loader size={18} className="spin" /> : <Play size={18} />}
                        {syncing === 'all' ? 'Синхронизация...' : 'Запустить полную синхронизацию'}
                    </button>

                    <button
                        onClick={loadCurrentData}
                        disabled={loading}
                        className="btn btn-secondary"
                    >
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        Обновить данные
                    </button>
                </div>
            </div>

            {/* Ручной импорт из файла */}
            <div className="card mb-4">
                <h3 style={{ marginBottom: '1rem' }}>{t('implementation.ruchnoy_import_iz_fayla', '📁 Ручной импорт из файла')}</h3>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    Если 1С не подключена, вы можете загрузить данные из файла (JSON или CSV)
                </p>
                <div className="flex gap-3 flex-wrap">
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        <FolderTree size={18} />
                        Импорт категорий
                        <input
                            type="file"
                            accept=".json,.csv"
                            onChange={(e) => handleFileImport(e, 'categories')}
                            style={{ display: 'none' }}
                        />
                    </label>

                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        <Package size={18} />
                        Импорт товаров
                        <input
                            type="file"
                            accept=".json,.csv"
                            onChange={(e) => handleFileImport(e, 'products')}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {/* История синхронизации */}
            {syncLog.length > 0 && (
                <div className="card mb-4">
                    <h3 style={{ marginBottom: '1rem' }}>
                        <Clock size={18} style={{ marginRight: '8px' }} />
                        Последние синхронизации
                    </h3>
                    <div style={{ fontSize: '0.875rem' }}>
                        {syncLog.map(log => (
                            <div key={log.id} style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>{log.sync_type}</span>
                                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                                    {log.status}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                    {formatDate(log.started_at)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Просмотр категорий */}
            {categories.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>📁 Текущие категории ({categories.length})</h3>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {categories.filter(c => !c.parent_id).map(cat => (
                            <div key={cat.id} style={{ marginBottom: '0.5rem' }}>
                                <div style={{
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    borderRadius: '6px',
                                    fontWeight: '600',
                                    fontSize: '0.9rem'
                                }}>
                                    <FolderTree size={14} style={{ marginRight: '6px' }} />
                                    {cat.name}
                                </div>
                                {categories.filter(sub => sub.parent_id === cat.id).map(sub => (
                                    <div key={sub.id} style={{
                                        padding: '0.4rem 0.75rem 0.4rem 1.5rem',
                                        borderLeft: '2px solid var(--color-primary)',
                                        marginLeft: '0.75rem',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '0.85rem'
                                    }}>
                                        <ChevronRight size={12} style={{ marginRight: '4px' }} />
                                        {sub.name}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="implementation-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('implementation.vnedrenie', 'Внедрение SmartPOS Pro')}</h1>
                    <p className="text-muted">{t('implementation.polnyy_tsikl_vnedreniya_sistemy', 'Полный цикл внедрения системы')}</p>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <h2>{t('implementation.etapy_vnedreniya', 'Этапы внедрения')}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        {Object.entries(sections).map(([key, section]) => (
                            <button
                                key={key}
                                className={`btn ${activeSection === key ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveSection(key)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start' }}
                            >
                                {section.icon}
                                <span>{section.title}</span>
                                {key === 'migration' && migrationStatus.categories.done && (
                                    <Check size={16} color="var(--color-success)" style={{ marginLeft: 'auto' }} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        {sections[activeSection].icon}
                        <h2>{sections[activeSection].title}</h2>
                    </div>

                    {activeSection === 'analysis' && renderAnalysisContent()}
                    {activeSection === 'configuration' && renderConfigurationContent()}
                    {activeSection === 'setup' && renderSetupContent()}
                    {activeSection === 'migration' && renderMigrationContent()}
                </div>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
                <h2>{t('implementation.obschaya_informatsiya', 'Общая информация')}</h2>
                <div className="grid grid-4" style={{ marginTop: '20px' }}>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--primary-color)' }}>
                            <FolderTree size={24} />
                        </div>
                        <div>
                            <div className="stat-label">{t('implementation.kategoriy', 'Категорий')}</div>
                            <div className="stat-value">{migrationStatus.categories.count}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--success-color)' }}>
                            <Package size={24} />
                        </div>
                        <div>
                            <div className="stat-label">{t('implementation.tovarov', 'Товаров')}</div>
                            <div className="stat-value">{migrationStatus.products.count}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'var(--warning-color)' }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="stat-label">{t('implementation.kontragentov', 'Контрагентов')}</div>
                            <div className="stat-value">{migrationStatus.counterparties.count}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: syncSettings?.['1c_api_url'] ? 'var(--success-color)' : 'var(--danger-color)' }}>
                            {syncSettings?.['1c_api_url'] ? <Link size={24} /> : <Unlink size={24} />}
                        </div>
                        <div>
                            <div className="stat-label">{t('implementation.s', '1С')}</div>
                            <div className="stat-value" style={{ fontSize: '1rem' }}>
                                {syncSettings?.['1c_api_url'] ? 'Подключена' : 'Не настроена'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Implementation;
