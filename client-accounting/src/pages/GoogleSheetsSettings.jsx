import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/settings';
import { Cloud, Table, RefreshCw, CheckCircle, AlertCircle, Settings, Download, Upload, FileSpreadsheet, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { settingsAPI, syncAPI } from '../services/api';
import { useI18n } from '../i18n';

function GoogleSheetsSettings() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({
        enabled: false,
        spreadsheet_id: '',
        service_account_email: '',
        service_account_key: '',
        sync_products: true,
        sync_sales: true,
        sync_inventory: true,
        sync_statistics: true,
        auto_sync: false,
        sync_interval: 30, // минуты
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncType, setSyncType] = useState(null);
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSettings(prev => ({ ...prev, ...apiData }));
            setLastSync(apiData.last_sync);
        } catch (err) {
            console.warn('GoogleSheetsSettings.jsx: API недоступен');
        }
        setLoading(false);
    };

    const saveSettings = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await syncAPI.saveGoogleSheetsSettings(settings);
            const data = res.data || res;
            if (data.success) {
                setMessage({ type: 'success', text: 'Настройки сохранены!' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Ошибка сохранения' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Ошибка подключения к серверу' });
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        setTesting(true);
        setMessage(null);
        try {
            const res = await syncAPI.testGoogleSheets({
                spreadsheet_id: settings.spreadsheet_id,
                service_account_email: settings.service_account_email,
                service_account_key: settings.service_account_key
            });
            const data = res.data || res;
            if (data.success) {
                setMessage({ type: 'success', text: `✅ Подключение успешно! Таблица: ${data.spreadsheet_title || 'OK'}` });
            } else {
                setMessage({ type: 'error', text: data.error || 'Ошибка подключения к Google Sheets' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Ошибка подключения к серверу' });
        } finally {
            setTesting(false);
        }
    };

    const triggerSync = async (type) => {
        setSyncing(true);
        setSyncType(type);
        setMessage(null);
        try {
            const res = await syncAPI.triggerSync({ type });
            const data = res.data || res;
            if (data.success) {
                setMessage({ type: 'success', text: `Синхронизация "${type}" выполнена успешно!` });
                setLastSync(new Date().toISOString());
            } else {
                setMessage({ type: 'error', text: data.error || 'Ошибка синхронизации' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Ошибка подключения к серверу' });
        } finally {
            setSyncing(false);
            setSyncType(null);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                setSettings(prev => ({
                    ...prev,
                    service_account_email: json.client_email || '',
                    service_account_key: json.private_key || ''
                }));
                setMessage({ type: 'success', text: '✅ Сервисный аккаунт загружен!' });
            } catch (err) {
                setMessage({ type: 'error', text: 'Ошибка чтения JSON файла' });
            }
        };
        reader.readAsText(file);
    };

    if (loading) {
        return (
            <div className="page-container">
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ width: 40, height: 40 }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileSpreadsheet size={28} color="var(--color-primary)" />
                    Google Sheets синхронизация
                </h2>
                <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
                    Синхронизируйте данные с Google Таблицами
                </p>
            </div>

            {/* Сообщения */}
            {message && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.type === 'success' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Основной переключатель */}
            <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t('googlesheetssettings.sinhronizatsiya', 'Синхронизация Google Sheets')}</h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                            {settings.enabled ? 'Включена' : 'Выключена'}
                        </p>
                    </div>
                    <button
                        className={`btn ${settings.enabled ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {settings.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        {settings.enabled ? 'Вкл' : 'Выкл'}
                    </button>
                </div>
            </div>

            {settings.enabled && (
                <>
                    {/* Настройки подключения */}
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-body">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                                <Settings size={20} />
                                Настройки подключения
                            </h3>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label>{t('googlesheetssettings.tablitsy', 'ID Google Таблицы')}</label>
                                <input
                                    type="text"
                                    value={settings.spreadsheet_id}
                                    onChange={(e) => setSettings(prev => ({ ...prev, spreadsheet_id: e.target.value }))}
                                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                                    style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                                />
                                <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    Скопируйте ID из URL таблицы: docs.google.com/spreadsheets/d/<strong>{t('googlesheetssettings.tablitsy', 'ID_ТАБЛИЦЫ')}</strong>/edit
                                </small>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label>{t('googlesheetssettings.servisnyy_akkaunt_klyuch', 'Сервисный аккаунт (JSON ключ)')}</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                                        <Upload size={16} style={{ marginRight: '0.5rem' }} />
                                        Загрузить JSON файл
                                        <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label>{t('googlesheetssettings.servisnogo_akkaunta', 'Email сервисного аккаунта')}</label>
                                <input
                                    type="email"
                                    value={settings.service_account_email}
                                    onChange={(e) => setSettings(prev => ({ ...prev, service_account_email: e.target.value }))}
                                    placeholder="myservice@myproject.iam.gserviceaccount.com"
                                    style={{ fontSize: '0.875rem' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label>{t('googlesheetssettings.privatnyy_klyuch', 'Приватный ключ')}</label>
                                <textarea
                                    value={settings.service_account_key ? '••••••• (загружен)' : ''}
                                    readOnly
                                    placeholder="Загрузите JSON файл сервисного аккаунта"
                                    rows={2}
                                    style={{ fontSize: '0.875rem', resize: 'none' }}
                                />
                            </div>

                            <div style={{
                                padding: '0.75rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                                lineHeight: 1.5
                            }}>
                                <strong>{t('googlesheetssettings.kak_poluchit_servisnyy_akkaunt', 'Как получить сервисный аккаунт:')}</strong><br />
                                1. Откройте <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a><br />
                                2. Создайте проект → Включите Google Sheets API<br />
                                3. Создайте Service Account → Скачайте JSON ключ<br />
                                4. Откройте Google Таблицу → Поделитесь с email сервисного аккаунта
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={testConnection}
                                    disabled={testing || !settings.spreadsheet_id}
                                    style={{ flex: 1 }}
                                >
                                    {testing ? (
                                        <><RefreshCw size={16} className="spin" /> {t('googlesheetssettings.proverka', 'Проверка...')}</>
                                    ) : (
                                        <><Cloud size={16} /> {t('googlesheetssettings.test_podklyucheniya', 'Тест подключения')}</>
                                    )}
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={saveSettings}
                                    disabled={saving}
                                    style={{ flex: 1 }}
                                >
                                    {saving ? (
                                        <><RefreshCw size={16} className="spin" /> {t('googlesheetssettings.sohranenie', 'Сохранение...')}</>
                                    ) : (
                                        <><CheckCircle size={16} /> {t('googlesheetssettings.sohranit', 'Сохранить')}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Выбор данных для синхронизации */}
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-body">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                                <Table size={20} />
                                Данные для синхронизации
                            </h3>

                            {[
                                { key: 'sync_products', label: 'Товары', desc: 'Наименования, цены, остатки' },
                                { key: 'sync_sales', label: 'Продажи', desc: 'Чеки, суммы, кассиры' },
                                { key: 'sync_inventory', label: 'Остатки', desc: 'Текущие запасы на складах' },
                                { key: 'sync_statistics', label: 'Статистика', desc: 'Сводка по периодам' },
                            ].map(item => (
                                <div key={item.key} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 0',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{item.label}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{item.desc}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => triggerSync(item.key.replace('sync_', ''))}
                                            disabled={syncing}
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                        >
                                            {syncing && syncType === item.key.replace('sync_', '') ? (
                                                <RefreshCw size={14} className="spin" />
                                            ) : (
                                                <Upload size={14} />
                                            )}
                                        </button>
                                        <button
                                            className={`btn btn-sm ${settings[item.key] ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSettings(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                            style={{ minWidth: '50px' }}
                                        >
                                            {settings[item.key] ? 'Вкл' : 'Выкл'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Автосинхронизация */}
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-body">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
                                <Clock size={20} />
                                Автосинхронизация
                            </h3>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span>{t('googlesheetssettings.avtomaticheskaya_sinhronizatsiya', 'Автоматическая синхронизация')}</span>
                                <button
                                    className={`btn btn-sm ${settings.auto_sync ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSettings(prev => ({ ...prev, auto_sync: !prev.auto_sync }))}
                                >
                                    {settings.auto_sync ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    {settings.auto_sync ? ' Вкл' : ' Выкл'}
                                </button>
                            </div>

                            {settings.auto_sync && (
                                <div className="form-group">
                                    <label>{t('googlesheetssettings.interval_minuty', 'Интервал (минуты)')}</label>
                                    <select
                                        value={settings.sync_interval}
                                        onChange={(e) => setSettings(prev => ({ ...prev, sync_interval: parseInt(e.target.value) }))}
                                    >
                                        <option value={5}>{t('googlesheetssettings.kazhdye_minut', 'Каждые 5 минут')}</option>
                                        <option value={15}>{t('googlesheetssettings.kazhdye_minut', 'Каждые 15 минут')}</option>
                                        <option value={30}>{t('googlesheetssettings.kazhdye_minut', 'Каждые 30 минут')}</option>
                                        <option value={60}>{t('googlesheetssettings.kazhdyy_chas', 'Каждый час')}</option>
                                        <option value={360}>{t('googlesheetssettings.kazhdye_chasov', 'Каждые 6 часов')}</option>
                                        <option value={1440}>{t('googlesheetssettings.raz_v_den', 'Раз в день')}</option>
                                    </select>
                                </div>
                            )}

                            {lastSync && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                                    Последняя синхронизация: {new Date(lastSync).toLocaleString('ru-RU')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Синхронизировать всё */}
                    <button
                        className="btn btn-primary w-full"
                        onClick={() => triggerSync('all')}
                        disabled={syncing}
                        style={{ marginBottom: '1rem', padding: '1rem' }}
                    >
                        {syncing && syncType === 'all' ? (
                            <><RefreshCw size={20} className="spin" /> {t('googlesheetssettings.sinhronizatsiya', 'Синхронизация...')}</>
                        ) : (
                            <><Download size={20} /> {t('googlesheetssettings.sinhronizirovat_vse_dannye', 'Синхронизировать все данные')}</>
                        )}
                    </button>
                </>
            )}
        </div>
    );
}

export default GoogleSheetsSettings;
