import React, { useState, useEffect } from 'react';
import { HardDrive, Download, Upload, Clock, CheckCircle, XCircle, Settings, Play, Trash2, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/ToastProvider';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function Backups() {
    const { t } = useI18n();
    const toast = useToast();
    const confirm = useConfirm();
    const [backups, setBackups] = useState([]);
    const [status, setStatus] = useState(null);
    const [settings, setSettings] = useState({
        is_enabled: true,
        backup_frequency: 'daily',
        backup_time: '03:00',
        retention_days: 7,
        backup_location: 'local',
        compress: false,
        encrypt: false
    });
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [backupsRes, statusRes] = await Promise.all([
                api.get('/database/backups'),
                api.get('/database/backup/status')
            ]);

            // Преобразуем данные API в формат компонента
            const apiBackups = (backupsRes.data.backups || []).map((b, i) => ({
                id: i + 1,
                backup_type: b.name.startsWith('auto_') ? 'scheduled' : 'manual',
                status: 'completed',
                file_size: b.size,
                created_at: b.created
            }));

            setBackups(apiBackups);
            setStatus(statusRes.data);
        } catch (error) {
            console.error('Error loading backups:', error);
        } finally {
            setLoading(false);
        }
    };

    const createBackup = async () => {
        setCreating(true);
        try {
            await api.post('/database/backup/auto');
            await loadData();
        } catch (error) {
            toast.info('Ошибка создания бэкапа: ' + (error.response?.data?.error || error.message));
        } finally {
            setCreating(false);
        }
    };

    const deleteBackup = async (backup) => {
        const filename = backups.find(b => b.id === backup.id)?.name ||
            `auto_backup_${new Date(backup.created_at).toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql`;
        if (!(await confirm({ variant: 'danger', message: `Удалить бэкап?` }))) return;
        try {
            await api.delete(`/database/backup/${encodeURIComponent(filename)}`);
            await loadData();
        } catch (error) {
            toast.info('Ошибка удаления: ' + error.message);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        const gb = bytes / (1024 * 1024 * 1024);
        const mb = bytes / (1024 * 1024);
        return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';
    const formatDuration = (sec) => sec ? `${sec} сек` : '-';

    const getStatusBadge = (status) => {
        if (status === 'completed') {
            return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={16} /> {t('backups.uspeshno', 'Успешно')}</span>;
        } else if (status === 'failed') {
            return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={16} /> {t('backups.oshibka', 'Ошибка')}</span>;
        } else if (status === 'running') {
            return <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={16} /> {t('backups.v_protsesse', 'В процессе...')}</span>;
        }
        return status;
    };

    const stats = {
        total: backups.length,
        successful: backups.filter(b => b.status === 'completed').length,
        failed: backups.filter(b => b.status === 'failed').length,
        totalSize: backups.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.file_size || 0), 0)
    };

    return (
        <div className="backups-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('backups.rezervnye_kopii', '💾 Резервные копии')}</h1>
                    <p className="text-muted">{t('backups.avtomaticheskoe_i_ruchnoe_rezervnoe_kopiro', 'Автоматическое и ручное резервное копирование')}</p>
                </div>
                <button className="btn btn-primary" onClick={createBackup} disabled={creating}>
                    {creating ? (
                        <><Clock size={18} className="spin" /> {t('backups.sozdanie', 'Создание...')}</>
                    ) : (
                        <><Play size={18} /> {t('backups.sozdat_bekap', 'Создать бэкап')}</>
                    )}
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <HardDrive size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total}</div>
                    <div style={{ color: '#666' }}>{t('backups.vsego_bekapov', 'Всего бэкапов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <CheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.successful}</div>
                    <div style={{ color: '#666' }}>{t('backups.uspeshnyh', 'Успешных')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <XCircle size={32} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.failed}</div>
                    <div style={{ color: '#666' }}>{t('backups.oshibok', 'Ошибок')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Download size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatSize(stats.totalSize)}</div>
                    <div style={{ color: '#666' }}>{t('backups.obschiy_razmer', 'Общий размер')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Список бэкапов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('backups.istoriya_bekapov', '📋 История бэкапов')}</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('backups.data', 'Дата')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('backups.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('backups.razmer', 'Размер')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('backups.vremya', 'Время')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backups.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('backups.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>{t('backups.zagruzka', 'Загрузка...')}</td></tr>
                            ) : backups.map(backup => (
                                <tr key={backup.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>{formatDate(backup.created_at)}</td>
                                    <td style={{ padding: '12px' }}>
                                        {backup.backup_type === 'scheduled' ? '🕐 Авто' : '✋ Ручной'}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatSize(backup.file_size)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatDuration(backup.duration_seconds)}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(backup.status)}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {backup.status === 'completed' && (
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('backups.skachat', 'Скачать')}>
                                                    <Download size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('backups.vosstanovit', 'Восстановить')}>
                                                    <Upload size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('backups.udalit', 'Удалить')} style={{ color: '#ef4444' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {backup.status === 'failed' && (
                                            <span style={{ fontSize: '12px', color: '#ef4444' }}>{backup.error_message}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Настройки */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Settings size={18} />
                        <h3 style={{ margin: 0 }}>{t('backups.nastroyki', 'Настройки')}</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={settings.is_enabled} onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })} />
                                Автоматическое резервирование
                            </label>
                        </div>

                        <div className="form-group">
                            <label>{t('backups.chastota', 'Частота')}</label>
                            <select value={settings.backup_frequency} onChange={(e) => setSettings({ ...settings, backup_frequency: e.target.value })}>
                                <option value="hourly">{t('backups.kazhdyy_chas', 'Каждый час')}</option>
                                <option value="daily">{t('backups.ezhednevno', 'Ежедневно')}</option>
                                <option value="weekly">{t('backups.ezhenedelno', 'Еженедельно')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>{t('backups.vremya_bekapa', 'Время бэкапа')}</label>
                            <input type="time" value={settings.backup_time} onChange={(e) => setSettings({ ...settings, backup_time: e.target.value })} />
                        </div>

                        <div className="form-group">
                            <label>{t('backups.hranit_dney', 'Хранить (дней)')}</label>
                            <input type="number" value={settings.retention_days} onChange={(e) => setSettings({ ...settings, retention_days: parseInt(e.target.value) || 7 })} />
                        </div>

                        <div className="form-group">
                            <label>{t('backups.hranilische', 'Хранилище')}</label>
                            <select value={settings.backup_location} onChange={(e) => setSettings({ ...settings, backup_location: e.target.value })}>
                                <option value="local">{t('backups.lokalno', 'Локально')}</option>
                                <option value="s3">Amazon S3</option>
                                <option value="google_drive">Google Drive</option>
                                <option value="yandex_disk">{t('backups.yandeksdisk', 'Яндекс.Диск')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={settings.compress} onChange={(e) => setSettings({ ...settings, compress: e.target.checked })} />
                                Сжимать бэкапы
                            </label>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={settings.encrypt} onChange={(e) => setSettings({ ...settings, encrypt: e.target.checked })} />
                                Шифровать бэкапы
                            </label>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => toast.success('Настройки сохранены (локально)')}>
                            Сохранить настройки
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Backups;
