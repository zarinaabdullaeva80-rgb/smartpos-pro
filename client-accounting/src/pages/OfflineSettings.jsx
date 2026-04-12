import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Database, Download, Upload, Check, AlertTriangle, Smartphone } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function OfflineSettings() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({});
    const [syncStatus, setSyncStatus] = useState({});
    const [offlineData, setOfflineData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSettings(apiData.settings || {});
            setSyncStatus(apiData.syncStatus || {});
            setOfflineData(apiData.offlineData || {});
        } catch (err) {
            console.warn('OfflineSettings: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const totalSize = Object.values(offlineData).reduce((sum, d) => sum + parseFloat(d.size), 0).toFixed(1);

    const triggerSync = () => {
        setSyncStatus({ ...syncStatus, status: 'syncing' });
        setTimeout(() => {
            setSyncStatus({
                ...syncStatus,
                status: 'synced',
                last_sync: new Date().toISOString(),
                pending_uploads: 0,
                pending_downloads: 0
            });
        }, 2000);
    };

    return (
        <div className="offline-settings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('offlinesettings.offlayn_rezhim', '📱 PWA / Оффлайн режим')}</h1>
                    <p className="text-muted">{t('offlinesettings.nastroyki_raboty_bez_interneta', 'Настройки работы без интернета')}</p>
                </div>
                <button className="btn btn-primary" onClick={triggerSync} disabled={syncStatus.status === 'syncing'}>
                    <RefreshCw size={18} className={syncStatus.status === 'syncing' ? 'spinning' : ''} />
                    {syncStatus.status === 'syncing' ? 'Синхронизация...' : 'Синхронизировать'}
                </button>
            </div>

            {/* Статус синхронизации */}
            <div className="card" style={{
                marginBottom: '20px',
                padding: '20px',
                background: syncStatus.status === 'synced'
                    ? 'linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)'
                    : syncStatus.status === 'error'
                        ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        width: '60px', height: '60px',
                        borderRadius: '50%',
                        background: syncStatus.status === 'synced' ? '#10b981'
                            : syncStatus.status === 'error' ? '#ef4444' : '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {syncStatus.status === 'synced' ? <Cloud size={28} color="white" />
                            : syncStatus.status === 'error' ? <CloudOff size={28} color="white" />
                                : <RefreshCw size={28} color="white" className="spinning" />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px' }}>
                            {syncStatus.status === 'synced' ? '✅ Данные синхронизированы'
                                : syncStatus.status === 'error' ? '❌ Ошибка синхронизации'
                                    : '🔄 Синхронизация...'}
                        </h3>
                        <p style={{ margin: 0, color: '#666' }}>
                            Последняя синхронизация: {formatDate(syncStatus.last_sync)}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <Upload size={20} style={{ marginBottom: '4px' }} />
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{syncStatus.pending_uploads}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{t('offlinesettings.k_otpravke', 'К отправке')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <Download size={20} style={{ marginBottom: '4px' }} />
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{syncStatus.pending_downloads}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{t('offlinesettings.k_zagruzke', 'К загрузке')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Настройки */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('offlinesettings.nastroyki', '⚙️ Настройки')}</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Smartphone size={24} color="#3b82f6" />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t('offlinesettings.rezhim', 'PWA режим')}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('offlinesettings.ustanovka_kak_prilozhenie', 'Установка как приложение')}</div>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={settings.pwa_enabled} onChange={(e) => setSettings({ ...settings, pwa_enabled: e.target.checked })} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <WifiOff size={24} color="#f59e0b" />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t('offlinesettings.offlayn_rezhim', 'Оффлайн режим')}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('offlinesettings.rabota_bez_interneta', 'Работа без интернета')}</div>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={settings.offline_mode} onChange={(e) => setSettings({ ...settings, offline_mode: e.target.checked })} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <RefreshCw size={24} color="#10b981" />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t('offlinesettings.avto_sinhronizatsiya', 'Авто-синхронизация')}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>Каждые {settings.sync_interval} мин</div>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={settings.auto_sync} onChange={(e) => setSettings({ ...settings, auto_sync: e.target.checked })} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Wifi size={24} color="#8b5cf6" />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{t('offlinesettings.tolko_cherez', 'Только через Wi-Fi')}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('offlinesettings.ekonomiya_mobilnogo_trafika', 'Экономия мобильного трафика')}</div>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={settings.sync_on_wifi_only} onChange={(e) => setSettings({ ...settings, sync_on_wifi_only: e.target.checked })} />
                                    <span className="slider"></span>
                                </label>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>{t('offlinesettings.interval_sinhronizatsii_minut', 'Интервал синхронизации (минут)')}</label>
                                <select value={settings.sync_interval} onChange={(e) => setSettings({ ...settings, sync_interval: parseInt(e.target.value) })}>
                                    <option value="1">{t('offlinesettings.kazhduyu_minutu', 'Каждую минуту')}</option>
                                    <option value="5">{t('offlinesettings.kazhdye_minut', 'Каждые 5 минут')}</option>
                                    <option value="15">{t('offlinesettings.kazhdye_minut', 'Каждые 15 минут')}</option>
                                    <option value="30">{t('offlinesettings.kazhdye_minut', 'Каждые 30 минут')}</option>
                                    <option value="60">{t('offlinesettings.kazhdyy_chas', 'Каждый час')}</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>{t('offlinesettings.maksimum_dney_offlayn', 'Максимум дней оффлайн')}</label>
                                <select value={settings.max_offline_days} onChange={(e) => setSettings({ ...settings, max_offline_days: parseInt(e.target.value) })}>
                                    <option value="1">{t('offlinesettings.den', '1 день')}</option>
                                    <option value="3">{t('offlinesettings.dnya', '3 дня')}</option>
                                    <option value="7">{t('offlinesettings.dney', '7 дней')}</option>
                                    <option value="14">{t('offlinesettings.dney', '14 дней')}</option>
                                    <option value="30">{t('offlinesettings.dney', '30 дней')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Оффлайн данные */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('offlinesettings.offlayn_dannye', '💾 Оффлайн данные')}</h3>
                        <span style={{ color: '#888' }}>{totalSize} MB</span>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('offlinesettings.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div>
                            {Object.entries(offlineData).map(([key, data]) => (
                                <div key={key} style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <Database size={20} color="#888" />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{key}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            {data.count} записей • {data.size}
                                        </div>
                                    </div>
                                    {data.synced ? (
                                        <Check size={20} color="#10b981" />
                                    ) : (
                                        <AlertTriangle size={20} color="#f59e0b" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ padding: '16px' }}>
                        <button className="btn btn-secondary" style={{ width: '100%' }}>
                            <Download size={16} /> Обновить все данные
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 26px;
                }
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .3s;
                    border-radius: 26px;
                }
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                    border-radius: 50%;
                }
                input:checked + .slider {
                    background-color: #10b981;
                }
                input:checked + .slider:before {
                    transform: translateX(24px);
                }
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default OfflineSettings;
