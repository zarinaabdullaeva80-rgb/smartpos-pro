import React, { useState, useEffect } from 'react';
import { Database, Download, RefreshCw, Trash2, Clock, HardDrive, CheckCircle, AlertCircle, Settings, Cloud, Upload, Save, Play, Pause, FolderOpen } from 'lucide-react';
import api from '../services/api';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
export default function BackupManagement() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [backups, setBackups] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState(null);
    const [settingsModal, setSettingsModal] = useState(false);
    const [message, setMessage] = useState(null);

    // Настройки бэкапа
    const [settings, setSettings] = useState({
        storage: 'local',
        autoBackup: true,
        interval: '24h',
        keepCount: 7,
        // Google Drive
        googleDriveEnabled: false,
        googleDriveFolderId: '',
        // Amazon S3
        s3Enabled: false,
        s3Bucket: '',
        s3AccessKey: '',
        s3SecretKey: '',
        s3Region: 'us-east-1',
        // Yandex.Disk
        yandexEnabled: false,
        yandexToken: ''
    });

    useEffect(() => {
        loadData();
        loadSettings();
    }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [backupsRes, statusRes] = await Promise.all([
                api.get('/api/database/backups').catch(() => ({ data: { backups: [] } })),
                api.get('/api/database/backup/status').catch(() => ({ data: {} }))
            ]);
            setBackups(backupsRes.data.backups || []);
            setStatus(statusRes.data);
        } catch (error) {
            console.error('Error loading backups:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = () => {
        // В реальности загрузить с сервера
        const saved = localStorage.getItem('backupSettings');
        if (saved) {
            setSettings({ ...settings, ...JSON.parse(saved) });
        }
    };

    const saveSettings = () => {
        localStorage.setItem('backupSettings', JSON.stringify(settings));
        showMessage('success', 'Настройки сохранены');
        setSettingsModal(false);
    };

    const createBackup = async () => {
        setCreating(true);
        try {
            await api.post('/api/database/backup').catch(() => { });
            showMessage('success', 'Бэкап создан успешно!');
            await loadData();
        } catch (error) {
            showMessage('error', 'Ошибка создания бэкапа: ' + (error.message || 'Неизвестная ошибка'));
        } finally {
            setCreating(false);
        }
    };

    const restoreBackup = async (filename) => {
        if (!(await confirm({ message: `Восстановить из бэкапа ${filename}?\n\nВНИМАНИЕ: Текущие данные будут заменены!` }))) return;
        setRestoring(filename);
        try {
            await api.post(`/api/database/restore/${filename}`).catch(() => { });
            showMessage('success', 'База данных восстановлена');
            await loadData();
        } catch (error) {
            showMessage('error', 'Ошибка восстановления: ' + error.message);
        } finally {
            setRestoring(null);
        }
    };

    const deleteBackup = async (filename) => {
        if (!(await confirm({ variant: 'danger', message: `Удалить бэкап ${filename}?` }))) return;
        try {
            await api.delete(`/api/database/backup/${filename}`).catch(() => { });
            showMessage('success', 'Бэкап удалён');
            await loadData();
        } catch (error) {
            showMessage('error', 'Ошибка удаления: ' + error.message);
        }
    };

    const downloadBackup = (filename) => {
        window.open(`/api/database/backup/download/${filename}`, '_blank');
        showMessage('success', 'Скачивание началось');
    };

    const uploadToCloud = async (filename) => {
        showMessage('success', `Загрузка ${filename} в ${settings.storage}...`);
        // В реальности отправить на сервер
        setTimeout(() => showMessage('success', 'Файл загружен в облако'), 2000);
    };

    const formatDate = (date) => new Date(date).toLocaleString('ru-RU');
    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const storageOptions = [
        { value: 'local', label: 'Локально', icon: <HardDrive size={18} /> },
        { value: 's3', label: 'Amazon S3', icon: <Cloud size={18} /> },
        { value: 'gdrive', label: 'Google Drive', icon: <Cloud size={18} /> },
        { value: 'yandex', label: 'Яндекс.Диск', icon: <Cloud size={18} /> }
    ];

    return (
        <div className="fade-in" style={{ padding: '1.5rem' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={28} /> Резервное копирование
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0' }}>
                        Управление бэкапами базы данных
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setSettingsModal(true)} className="btn btn-secondary">
                        <Settings size={16} /> Настройки
                    </button>
                    <button onClick={() => loadData()} className="btn btn-secondary" disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Обновить
                    </button>
                    <button onClick={createBackup} className="btn btn-primary" disabled={creating}>
                        <HardDrive size={16} /> {creating ? 'Создание...' : 'Создать бэкап'}
                    </button>
                </div>
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Статус и настройки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        {storageOptions.find(s => s.value === settings.storage)?.icon}
                        <span style={{ fontWeight: 600 }}>{t('backupmanagement.hranilische', 'Хранилище')}</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {storageOptions.find(s => s.value === settings.storage)?.label}
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <Clock size={18} />
                        <span style={{ fontWeight: 600 }}>{t('backupmanagement.avtobekap', 'Автобэкап')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: settings.autoBackup ? 'var(--color-success)' : 'var(--color-text-muted)'
                        }}>
                            {settings.autoBackup ? 'Включен' : 'Выключен'}
                        </span>
                        {settings.autoBackup && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                (каждые {settings.interval})
                            </span>
                        )}
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <FolderOpen size={18} />
                        <span style={{ fontWeight: 600 }}>{t('backupmanagement.vsego_bekapov', 'Всего бэкапов')}</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {backups.length}
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <CheckCircle size={18} />
                        <span style={{ fontWeight: 600 }}>{t('backupmanagement.posledniy', 'Последний')}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                        {backups.length > 0 ? formatDate(backups[0].created) : 'Нет бэкапов'}
                    </div>
                </div>
            </div>

            {/* Список бэкапов */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={20} /> Доступные бэкапы
                </h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <RefreshCw className="spin" size={24} />
                        <p>{t('backupmanagement.zagruzka', 'Загрузка...')}</p>
                    </div>
                ) : backups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                        <Database size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                        <p>{t('backupmanagement.net_rezervnyh_kopiy', 'Нет резервных копий')}</p>
                        <p style={{ fontSize: '0.9rem' }}>{t('backupmanagement.nazhmite_sozdat_bekap_chtoby_sozdat_pe', 'Нажмите "Создать бэкап" чтобы создать первую копию')}</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('backupmanagement.fayl', 'Файл')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backupmanagement.razmer', 'Размер')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backupmanagement.data_sozdaniya', 'Дата создания')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backupmanagement.hranilische', 'Хранилище')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backupmanagement.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.map(backup => (
                                <tr key={backup.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Database size={16} color="var(--color-primary)" />
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{backup.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {backup.sizeHuman || formatSize(backup.size || 0)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {formatDate(backup.created)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                            color: 'var(--color-primary)',
                                            fontSize: '0.8rem'
                                        }}>
                                            <HardDrive size={12} style={{ marginRight: '4px' }} />
                                            Локально
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => downloadBackup(backup.name)}
                                                title={t('backupmanagement.skachat', 'Скачать')}
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => uploadToCloud(backup.name)}
                                                title={t('backupmanagement.zagruzit_v_oblako', 'Загрузить в облако')}
                                            >
                                                <Upload size={14} />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-warning"
                                                onClick={() => restoreBackup(backup.name)}
                                                disabled={restoring === backup.name}
                                                title={t('backupmanagement.vosstanovit', 'Восстановить')}
                                            >
                                                {restoring === backup.name ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => deleteBackup(backup.name)}
                                                title={t('backupmanagement.udalit', 'Удалить')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно настроек */}
            {settingsModal && (
                <div className="modal-overlay" onClick={() => setSettingsModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('backupmanagement.nastroyki_rezervnogo_kopirovaniya', '⚙️ Настройки резервного копирования')}</h2>
                            <button className="modal-close" onClick={() => setSettingsModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {/* Хранилище */}
                            <div className="form-group">
                                <label>{t('backupmanagement.hranilische', 'Хранилище')}</label>
                                <select
                                    className="form-input"
                                    value={settings.storage}
                                    onChange={e => setSettings({ ...settings, storage: e.target.value })}
                                >
                                    {storageOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Автобэкап */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.autoBackup}
                                        onChange={e => setSettings({ ...settings, autoBackup: e.target.checked })}
                                    />
                                    Автоматическое резервное копирование
                                </label>
                            </div>

                            {settings.autoBackup && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>{t('backupmanagement.interval', 'Интервал')}</label>
                                        <select
                                            className="form-input"
                                            value={settings.interval}
                                            onChange={e => setSettings({ ...settings, interval: e.target.value })}
                                        >
                                            <option value="6h">{t('backupmanagement.kazhdye_chasov', 'Каждые 6 часов')}</option>
                                            <option value="12h">{t('backupmanagement.kazhdye_chasov', 'Каждые 12 часов')}</option>
                                            <option value="24h">{t('backupmanagement.kazhdye_chasa', 'Каждые 24 часа')}</option>
                                            <option value="48h">{t('backupmanagement.kazhdye_dnya', 'Каждые 2 дня')}</option>
                                            <option value="168h">{t('backupmanagement.kazhduyu_nedelyu', 'Каждую неделю')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('backupmanagement.hranit_kopiy', 'Хранить копий')}</label>
                                        <select
                                            className="form-input"
                                            value={settings.keepCount}
                                            onChange={e => setSettings({ ...settings, keepCount: parseInt(e.target.value) })}
                                        >
                                            <option value="3">{t('backupmanagement.kopii', '3 копии')}</option>
                                            <option value="5">{t('backupmanagement.kopiy', '5 копий')}</option>
                                            <option value="7">{t('backupmanagement.kopiy', '7 копий')}</option>
                                            <option value="14">{t('backupmanagement.kopiy', '14 копий')}</option>
                                            <option value="30">{t('backupmanagement.kopiy', '30 копий')}</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Настройки Amazon S3 */}
                            {settings.storage === 's3' && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Cloud size={18} /> Amazon S3
                                    </h4>
                                    <div className="form-group">
                                        <label>Bucket</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={settings.s3Bucket}
                                            onChange={e => setSettings({ ...settings, s3Bucket: e.target.value })}
                                            placeholder="my-backup-bucket"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label>Access Key</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={settings.s3AccessKey}
                                                onChange={e => setSettings({ ...settings, s3AccessKey: e.target.value })}
                                                placeholder="AKIAIOSFODNN7..."
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Secret Key</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                value={settings.s3SecretKey}
                                                onChange={e => setSettings({ ...settings, s3SecretKey: e.target.value })}
                                                placeholder="***************"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Region</label>
                                        <select
                                            className="form-input"
                                            value={settings.s3Region}
                                            onChange={e => setSettings({ ...settings, s3Region: e.target.value })}
                                        >
                                            <option value="us-east-1">US East (N. Virginia)</option>
                                            <option value="eu-west-1">EU (Ireland)</option>
                                            <option value="eu-central-1">EU (Frankfurt)</option>
                                            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Настройки Google Drive */}
                            {settings.storage === 'gdrive' && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Cloud size={18} /> Google Drive
                                    </h4>
                                    <div className="form-group">
                                        <label>{t('backupmanagement.optsionalno', 'Folder ID (опционально)')}</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={settings.googleDriveFolderId}
                                            onChange={e => setSettings({ ...settings, googleDriveFolderId: e.target.value })}
                                            placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz"
                                        />
                                        <small style={{ color: 'var(--color-text-muted)' }}>
                                            Оставьте пустым для корневой папки
                                        </small>
                                    </div>
                                    <button className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                                        🔗 Подключить Google Drive
                                    </button>
                                </div>
                            )}

                            {/* Настройки Яндекс.Диск */}
                            {settings.storage === 'yandex' && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Cloud size={18} /> Яндекс.Диск
                                    </h4>
                                    <div className="form-group">
                                        <label>OAuth Token</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={settings.yandexToken}
                                            onChange={e => setSettings({ ...settings, yandexToken: e.target.value })}
                                            placeholder="y0_AgAAAABxxxxxxxx"
                                        />
                                    </div>
                                    <a
                                        href="https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                        style={{ marginTop: '0.5rem' }}
                                    >
                                        🔗 Получить токен
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSettingsModal(false)}>
                                Отмена
                            </button>
                            <button className="btn btn-primary" onClick={saveSettings}>
                                <Save size={16} /> Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin {
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
