import React, { useState, useEffect, useCallback } from 'react';
import { sync1CAPI, schedulerAPI } from '../services/api';
import {
    Save, RefreshCw, AlertCircle, CheckCircle, Settings, FileText,
    Upload, Download, Play, Pause, Info, Link, Unlink, FolderTree,
    ShoppingCart, Users, Package, Database, Clock, HelpCircle
} from 'lucide-react';
import { useI18n } from '../i18n';

function Sync1CSettings() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({
        '1c_api_url': '',
        '1c_username': '',
        '1c_password': '',
        '1c_base_name': '',
        '1c_connection_type': 'http',
        'sync_enabled': 'false',
        'sync_interval_minutes': '15',
        'sync_products': 'true',
        'sync_categories': 'true',
        'sync_counterparties': 'true',
        'sync_sales': 'true',
        'sync_purchases': 'true',
        'sync_prices': 'true',
        'sync_stock': 'true',
        'sync_direction': 'bidirectional'
    });

    const [syncLog, setSyncLog] = useState([]);
    const [syncStats, setSyncStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(null);
    const [message, setMessage] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        loadSettings();
        loadSyncLog();
        loadSyncStats();
    }, []);

    const loadSettings = async () => {
        try {
            const apiRes = await sync1CAPI.getSettings();
            const apiData = apiRes.data || apiRes;
            if (apiData && typeof apiData === 'object') {
                setSettings(prev => ({ ...prev, ...apiData }));
            }
        } catch (err) {
            console.warn('Sync1CSettings: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const loadSyncLog = async () => {
        setLoading(true);
        try {
            const res = await sync1CAPI.getLog({ limit: 20 });
            const data = res.data || res;
            setSyncLog(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading sync log:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSyncStats = async () => {
        try {
            const res = await sync1CAPI.getOverview();
            const data = res.data || res;
            setSyncStats(data);
        } catch (error) {
            console.error('Error loading sync stats:', error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await sync1CAPI.saveSettings(settings);
            setMessage({ type: 'success', text: 'Настройки сохранены успешно' });
        } catch (error) {
            const errText = error.response?.data?.error || error.message || 'Ошибка сохранения настроек';
            setMessage({ type: 'error', text: errText });
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        setTesting(true);
        setConnectionStatus(null);
        setMessage({ type: 'info', text: 'Проверка подключения к 1С...' });

        try {
            const res = await sync1CAPI.testConnection({
                '1c_api_url': settings['1c_api_url'],
                '1c_username': settings['1c_username'],
                '1c_password': settings['1c_password']
            });
            const data = res.data || res;
            if (data.success) {
                setConnectionStatus('connected');
                setMessage({ type: 'success', text: data.message || 'Подключение к 1С успешно!' });
            } else {
                setConnectionStatus('error');
                setMessage({ type: 'error', text: data.message || 'Не удалось подключиться к 1С' });
            }
        } catch (error) {
            setConnectionStatus('error');
            setMessage({ type: 'error', text: 'Ошибка подключения: ' + (error.response?.data?.message || error.message) });
        } finally {
            setTesting(false);
        }
    };

    const runSync = async (syncType, direction) => {
        setSyncing(syncType);
        setMessage({ type: 'info', text: `Запуск синхронизации ${syncType}...` });

        try {
            const res = await sync1CAPI.triggerSyncByType(syncType, { direction });
            const data = res.data || res;
            setMessage({
                type: 'success',
                text: `Синхронизация ${syncType} запланирована. ID: ${data.queue_item?.id || 'N/A'}`
            });
            loadSyncLog();
            loadSyncStats();
        } catch (error) {
            const errData = error.response?.data;
            setMessage({ type: 'error', text: errData?.error || error.message || 'Ошибка запуска синхронизации' });
        } finally {
            setSyncing(null);
        }
    };

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString('ru-RU');
        } catch {
            return dateString;
        }
    };

    const formatDuration = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}мс`;
        return `${(ms / 1000).toFixed(1)}с`;
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Settings className="page-icon" />
                        Интеграция с 1С:Предприятие
                    </h1>
                    <p className="page-subtitle">
                        Настройка синхронизации данных между SmartPOS Pro и 1С
                    </p>
                </div>
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="btn btn-secondary"
                    title={t('sync1csettings.instruktsii', 'Инструкции')}
                >
                    <HelpCircle size={18} />
                    Инструкции
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : message.type === 'error' ? 'alert-danger' : 'alert-info'} mb-4`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            {/* Инструкции по настройке */}
            {showHelp && (
                <div className="card mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-info)' }}>
                    <div className="card-header">
                        <h2 className="card-title">
                            <Info size={20} />
                            Инструкции по настройке синхронизации с 1С
                        </h2>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-2 gap-4">
                            <div>
                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>{t('sync1csettings.shag_nastroyka_na_storone_s', 'Шаг 1: Настройка на стороне 1С')}</h4>
                                <ol style={{ paddingLeft: '1.2rem', lineHeight: '1.8' }}>
                                    <li>{t('sync1csettings.otkroyte_vashu_bazu_spredpriyatie', 'Откройте вашу базу 1С:Предприятие')}</li>
                                    <li>{t('sync1csettings.pereydite_administrirovanie_nastroyka', 'Перейдите: Администрирование → Настройка интеграции')}</li>
                                    <li>{t('sync1csettings.sozdayte_servis_dlya_obmena_dannymi', 'Создайте HTTP-сервис для обмена данными')}</li>
                                    <li>{t('sync1csettings.nastroyte_veb_server', 'Настройте веб-сервер (Apache/IIS)')}</li>
                                    <li>{t('sync1csettings.poluchite_veb_servisa', 'Получите URL веб-сервиса')}</li>
                                </ol>
                            </div>
                            <div>
                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>{t('sync1csettings.shag_nastroyka_v', 'Шаг 2: Настройка в SmartPOS Pro')}</h4>
                                <ol style={{ paddingLeft: '1.2rem', lineHeight: '1.8' }}>
                                    <li>{t('sync1csettings.vvedite_vashey_s', 'Введите URL API вашей 1С')}</li>
                                    <li>{t('sync1csettings.ukazhite_login_i_parol_polzovatelya_s', 'Укажите логин и пароль пользователя 1С')}</li>
                                    <li>{t('sync1csettings.nazhmite_proverit_podklyuchenie', 'Нажмите "Проверить подключение"')}</li>
                                    <li>{t('sync1csettings.vyberite_obekty_dlya_sinhronizatsii', 'Выберите объекты для синхронизации')}</li>
                                    <li>{t('sync1csettings.vklyuchite_avtomaticheskuyu_sinhronizatsiyu', 'Включите автоматическую синхронизацию')}</li>
                                </ol>
                            </div>
                        </div>
                        <div className="mt-4" style={{ padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>{t('sync1csettings.primery_dlya_raznyh_konfiguratsiy', 'Примеры URL для разных конфигураций:')}</h4>
                            <code style={{ display: 'block', marginBottom: '0.5rem' }}>
                                1С:Бухгалтерия: http://server:8080/accounting/hs/exchange
                            </code>
                            <code style={{ display: 'block', marginBottom: '0.5rem' }}>
                                1С:УТ: http://server:8080/trade/hs/exchange
                            </code>
                            <code style={{ display: 'block' }}>
                                1С:Розница: http://server:8080/retail/hs/exchange
                            </code>
                        </div>
                    </div>
                </div>
            )}

            {/* Статус подключения */}
            <div className="card mb-4">
                <div className="card-header">
                    <h2 className="card-title">
                        {connectionStatus === 'connected' ? <Link size={20} color="var(--color-success)" /> :
                            connectionStatus === 'error' ? <Unlink size={20} color="var(--color-danger)" /> :
                                <Database size={20} />}
                        Параметры подключения
                    </h2>
                    {connectionStatus && (
                        <span className={`badge ${connectionStatus === 'connected' ? 'badge-success' : 'badge-danger'}`}>
                            {connectionStatus === 'connected' ? 'Подключено' : 'Не подключено'}
                        </span>
                    )}
                </div>
                <div className="card-body">
                    <div className="grid grid-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.s', 'URL API 1С *')}</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="http://192.168.1.100:8080/base/hs/exchange"
                                value={settings['1c_api_url']}
                                onChange={(e) => setSettings({ ...settings, '1c_api_url': e.target.value })}
                            />
                            <small style={{ color: 'var(--color-text-muted)' }}>
                                Адрес HTTP-сервиса 1С для обмена данными
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.tip_podklyucheniya', 'Тип подключения')}</label>
                            <select
                                className="form-input"
                                value={settings['1c_connection_type']}
                                onChange={(e) => setSettings({ ...settings, '1c_connection_type': e.target.value })}
                            >
                                <option value="http">{t('sync1csettings.veb_servis', 'HTTP (веб-сервис)')}</option>
                                <option value="odata">OData REST API</option>
                                <option value="com">{t('sync1csettings.obekt', 'COM-объект (Windows)')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.login_s', 'Логин 1С')}</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Пользователь 1С"
                                value={settings['1c_username']}
                                onChange={(e) => setSettings({ ...settings, '1c_username': e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.parol_s', 'Пароль 1С')}</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={settings['1c_password']}
                                onChange={(e) => setSettings({ ...settings, '1c_password': e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.nazvanie_bazy_s_optsionalno', 'Название базы 1С (опционально)')}</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Бухгалтерия предприятия"
                                value={settings['1c_base_name']}
                                onChange={(e) => setSettings({ ...settings, '1c_base_name': e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('sync1csettings.interval_avtosinhronizatsii_min', 'Интервал автосинхронизации (мин)')}</label>
                            <input
                                type="number"
                                className="form-input"
                                min="5"
                                max="1440"
                                value={settings['sync_interval_minutes']}
                                onChange={(e) => setSettings({ ...settings, 'sync_interval_minutes': e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group mt-4">
                        <label className="checkbox-label" style={{ fontSize: '1rem' }}>
                            <input
                                type="checkbox"
                                checked={settings['sync_enabled'] === 'true'}
                                onChange={(e) => setSettings({ ...settings, 'sync_enabled': e.target.checked ? 'true' : 'false' })}
                            />
                            <span style={{ fontWeight: '500' }}>
                                Включить автоматическую синхронизацию
                            </span>
                        </label>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                            <Save size={18} />
                            {saving ? 'Сохранение...' : 'Сохранить настройки'}
                        </button>
                        <button
                            onClick={testConnection}
                            disabled={testing || !settings['1c_api_url']}
                            className="btn btn-secondary"
                        >
                            <RefreshCw size={18} className={testing ? 'spin' : ''} />
                            {testing ? 'Проверка...' : 'Проверить подключение'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Объекты синхронизации */}
            <div className="card mb-4">
                <div className="card-header">
                    <h2 className="card-title">
                        <FolderTree size={20} />
                        Объекты синхронизации
                    </h2>
                </div>
                <div className="card-body">
                    <div className="grid grid-3 gap-4">
                        {/* Номенклатура */}
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Package size={24} color="var(--color-primary)" />
                                <h4 style={{ margin: 0 }}>{t('sync1csettings.nomenklatura', 'Номенклатура')}</h4>
                            </div>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_products'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_products': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.tovary', 'Товары')}</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_categories'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_categories': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.kategorii_i_podkategorii', 'Категории и подкатегории')}</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_prices'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_prices': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.tseny', 'Цены')}</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_stock'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_stock': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.ostatki_na_skladah', 'Остатки на складах')}</span>
                            </label>
                            <button
                                onClick={() => runSync('products', 'import')}
                                disabled={syncing === 'products'}
                                className="btn btn-sm btn-secondary mt-3"
                                style={{ width: '100%' }}
                            >
                                <Download size={14} />
                                {syncing === 'products' ? 'Синхронизация...' : 'Импорт из 1С'}
                            </button>
                        </div>

                        {/* Контрагенты */}
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Users size={24} color="var(--color-success)" />
                                <h4 style={{ margin: 0 }}>{t('sync1csettings.kontragenty', 'Контрагенты')}</h4>
                            </div>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_counterparties'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_counterparties': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.pokupateli', 'Покупатели')}</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_counterparties'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_counterparties': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.postavschiki', 'Поставщики')}</span>
                            </label>
                            <button
                                onClick={() => runSync('counterparties', 'import')}
                                disabled={syncing === 'counterparties'}
                                className="btn btn-sm btn-secondary mt-3"
                                style={{ width: '100%' }}
                            >
                                <Download size={14} />
                                {syncing === 'counterparties' ? 'Синхронизация...' : 'Импорт из 1С'}
                            </button>
                        </div>

                        {/* Документы */}
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingCart size={24} color="var(--color-warning)" />
                                <h4 style={{ margin: 0 }}>{t('sync1csettings.dokumenty', 'Документы')}</h4>
                            </div>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_sales'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_sales': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.prodazhi_realizatsiya', 'Продажи (Реализация)')}</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings['sync_purchases'] === 'true'}
                                    onChange={(e) => setSettings({ ...settings, 'sync_purchases': e.target.checked ? 'true' : 'false' })}
                                />
                                <span>{t('sync1csettings.zakupki_postuplenie', 'Закупки (Поступление)')}</span>
                            </label>
                            <button
                                onClick={() => runSync('sales', 'export')}
                                disabled={syncing === 'sales'}
                                className="btn btn-sm btn-success mt-3"
                                style={{ width: '100%' }}
                            >
                                <Upload size={14} />
                                {syncing === 'sales' ? 'Выгрузка...' : 'Выгрузить в 1С'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group mt-4">
                        <label className="form-label">{t('sync1csettings.napravlenie_obmena_po_umolchaniyu', 'Направление обмена по умолчанию')}</label>
                        <select
                            className="form-input"
                            value={settings['sync_direction']}
                            onChange={(e) => setSettings({ ...settings, 'sync_direction': e.target.value })}
                            style={{ maxWidth: '400px' }}
                        >
                            <option value="bidirectional">{t('sync1csettings.dvustoronniy_obmen', '↔️ Двусторонний обмен')}</option>
                            <option value="import">{t('sync1csettings.tolko_import_iz_s_v', '⬇️ Только импорт из 1С в SmartPOS')}</option>
                            <option value="export">{t('sync1csettings.tolko_eksport_iz_v_s', '⬆️ Только экспорт из SmartPOS в 1С')}</option>
                        </select>
                    </div>

                    {/* Кнопки ручного запуска */}
                    <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <button
                            onClick={() => runSync('all', 'import')}
                            disabled={syncing}
                            className="btn btn-primary"
                        >
                            <Download size={18} />
                            Полный импорт из 1С
                        </button>
                        <button
                            onClick={() => runSync('all', 'export')}
                            disabled={syncing}
                            className="btn btn-success"
                        >
                            <Upload size={18} />
                            Полный экспорт в 1С
                        </button>
                        <button
                            onClick={() => runSync('all', 'bidirectional')}
                            disabled={syncing}
                            className="btn btn-secondary"
                        >
                            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
                            Полная синхронизация
                        </button>
                    </div>
                </div>
            </div>

            {/* Управление планировщиком */}
            <div className="card mb-4">
                <div className="card-header">
                    <h2 className="card-title">
                        <Clock size={20} />
                        Автоматический планировщик
                    </h2>
                    <span className={`badge ${settings['sync_enabled'] === 'true' ? 'badge-success' : 'badge-secondary'}`}>
                        {settings['sync_enabled'] === 'true' ? '🟢 Активен' : '⏸️ Отключён'}
                    </span>
                </div>
                <div className="card-body">
                    <div className="grid grid-3 gap-4">
                        <div style={{
                            padding: '1.5rem',
                            background: settings['sync_enabled'] === 'true'
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 95, 70, 0.1))'
                                : 'var(--color-bg-secondary)',
                            borderRadius: '12px',
                            border: settings['sync_enabled'] === 'true'
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : '1px solid var(--color-border)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                                {settings['sync_enabled'] === 'true' ? '🔄' : '⏸️'}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                {settings['sync_enabled'] === 'true' ? 'Автосинхронизация включена' : 'Автосинхронизация отключена'}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                {settings['sync_enabled'] === 'true'
                                    ? `Каждые ${settings['sync_interval_minutes'] || 15} минут`
                                    : 'Включите для автоматической синхронизации'}
                            </div>
                        </div>

                        <div style={{
                            padding: '1.5rem',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏱️</div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                Интервал: {settings['sync_interval_minutes'] || 15} мин
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                Минимальный интервал: 5 минут
                            </div>
                        </div>

                        <div style={{
                            padding: '1.5rem',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                Объекты синхронизации
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                {[
                                    settings['sync_products'] === 'true' && 'Товары',
                                    settings['sync_categories'] === 'true' && 'Категории',
                                    settings['sync_counterparties'] === 'true' && 'Контрагенты',
                                    settings['sync_sales'] === 'true' && 'Продажи'
                                ].filter(Boolean).join(', ') || 'Не выбраны'}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <button
                            onClick={async () => {
                                try {
                                    await schedulerAPI.trigger();
                                    setMessage({ type: 'success', text: 'Синхронизация запущена вручную' });
                                    loadSyncLog();
                                } catch (error) {
                                    setMessage({ type: 'error', text: error.response?.data?.error || error.message });
                                }
                            }}
                            className="btn btn-primary"
                        >
                            <Play size={18} />
                            Запустить сейчас
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await schedulerAPI.reload();
                                    setMessage({ type: 'success', text: 'Настройки планировщика перезагружены' });
                                } catch (error) {
                                    setMessage({ type: 'error', text: error.response?.data?.error || error.message });
                                }
                            }}
                            className="btn btn-secondary"
                        >
                            <RefreshCw size={18} />
                            Перезагрузить настройки
                        </button>
                    </div>
                </div>
            </div>

            {/* Статистика */}
            {syncStats && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h2 className="card-title">
                            <Clock size={20} />
                            Статистика синхронизации
                        </h2>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-4 gap-3">
                            <div style={{
                                padding: '1rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    {syncStats.recentSyncs?.length || 0}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)' }}>{t('sync1csettings.sinhronizatsiy_segodnya', 'Синхронизаций сегодня')}</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                    {syncStats.devices?.reduce((sum, d) => sum + (d.online || 0), 0) || 0}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)' }}>{t('sync1csettings.ustroystv_onlayn', 'Устройств онлайн')}</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>
                                    {syncStats.pendingConflicts || 0}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)' }}>{t('sync1csettings.konfliktov', 'Конфликтов')}</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-info)' }}>
                                    {syncStats.stats?.total_products || 0}
                                </div>
                                <div style={{ color: 'var(--color-text-muted)' }}>{t('sync1csettings.tovarov_v_sisteme', 'Товаров в системе')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* История синхронизации */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        <FileText size={20} />
                        История синхронизации
                    </h2>
                    <button onClick={loadSyncLog} disabled={loading} className="btn btn-secondary btn-sm">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Обновить
                    </button>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('sync1csettings.data_vremya', 'Дата/Время')}</th>
                                <th>{t('sync1csettings.tip', 'Тип')}</th>
                                <th>{t('sync1csettings.napravlenie', 'Направление')}</th>
                                <th>{t('sync1csettings.status', 'Статус')}</th>
                                <th>{t('sync1csettings.uspeshno', 'Успешно')}</th>
                                <th>{t('sync1csettings.oshibok', 'Ошибок')}</th>
                                <th>{t('sync1csettings.vremya', 'Время')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {syncLog.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        <Database size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                        <p>{t('sync1csettings.istoriya_sinhronizatsii_pusta', 'История синхронизации пуста')}</p>
                                        <p style={{ fontSize: '0.875rem' }}>{t('sync1csettings.nastroyte_podklyuchenie_k_s_i_zapustite_p', 'Настройте подключение к 1С и запустите первую синхронизацию')}</p>
                                    </td>
                                </tr>
                            ) : (
                                syncLog.map((log) => (
                                    <tr key={log.id}>
                                        <td>{formatDate(log.started_at)}</td>
                                        <td>
                                            <span style={{ fontWeight: '500' }}>{log.sync_type}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${log.direction === 'import' ? 'badge-info' : 'badge-success'}`}>
                                                {log.direction === 'import' ? '⬇️ Импорт' : '⬆️ Экспорт'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${log.status === 'success' ? 'badge-success' :
                                                log.status === 'failed' || log.status === 'error' ? 'badge-danger' :
                                                    log.status === 'partial' ? 'badge-warning' :
                                                        'badge-info'
                                                }`}>
                                                {log.status === 'success' ? '✓ Успешно' :
                                                    log.status === 'failed' || log.status === 'error' ? '✗ Ошибка' :
                                                        log.status === 'partial' ? '⚠ Частично' :
                                                            log.status}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                                            {log.records_success || 0}
                                        </td>
                                        <td style={{ color: log.records_error > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: log.records_error > 0 ? 'bold' : 'normal' }}>
                                            {log.records_error || 0}
                                        </td>
                                        <td>{formatDuration(log.duration_ms)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Sync1CSettings;
