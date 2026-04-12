import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Check, X, Globe, AlertTriangle, Save } from 'lucide-react';
import { sessionsAPI } from '../services/api';
import { useI18n } from '../i18n';

function IPWhitelist() {
    const { t } = useI18n();
    const [ips, setIps] = useState([]);
    const [settings, setSettings] = useState({});
    const [newIp, setNewIp] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await sessionsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setIps(apiData.ips || []);
            setSettings(apiData.settings || apiData || {
            whitelist_enabled: true,
            block_unknown: true,
            log_blocked: true,
            admin_bypass: true
        });
        } catch (err) {
            console.warn('IPWhitelist: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleAddIp = () => {
        if (!newIp.trim()) return;
        setIps([...ips, {
            id: Date.now(),
            ip: newIp,
            description: 'Новый IP',
            type: newIp.includes('/') ? 'range' : 'single',
            enabled: true,
            added: new Date().toISOString().split('T')[0],
            added_by: 'Текущий пользователь'
        }]);
        setNewIp('');
    };

    return (
        <div className="ip-whitelist-page fade-in">
            <div className="page-header">
                <div>
                    <h1>🛡️ IP Whitelist</h1>
                    <p className="text-muted">{t('ipwhitelist.ogranichenie_dostupa_po_adresam', 'Ограничение доступа по IP-адресам')}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Список IP */}
                <div>
                    {/* Добавление IP */}
                    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text"
                                placeholder="IP-адрес или диапазон (например: 192.168.1.0/24)"
                                value={newIp}
                                onChange={(e) => setNewIp(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-primary" onClick={handleAddIp}>
                                <Plus size={18} /> Добавить
                            </button>
                        </div>
                    </div>

                    {/* Таблица */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('ipwhitelist.razreshyonnye_adresa', '📋 Разрешённые IP-адреса')}</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('ipwhitelist.diapazon', 'IP / Диапазон')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('ipwhitelist.opisanie', 'Описание')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('ipwhitelist.tip', 'Тип')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('ipwhitelist.status', 'Статус')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('ipwhitelist.deystviya', 'Действия')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ips.map(ip => (
                                    <tr key={ip.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: ip.enabled ? 1 : 0.5 }}>
                                        <td style={{ padding: '12px' }}>
                                            <code style={{
                                                background: 'var(--bg-secondary)',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '13px'
                                            }}>
                                                {ip.ip}
                                            </code>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{ip.description}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>
                                                Добавлен: {ip.added} ({ip.added_by})
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: ip.type === 'range' ? '#dbeafe' : '#dcfce7',
                                                color: ip.type === 'range' ? '#3b82f6' : '#10b981',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '11px'
                                            }}>
                                                {ip.type === 'range' ? 'Диапазон' : 'Одиночный'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {ip.enabled ? (
                                                <span style={{
                                                    background: '#dcfce7',
                                                    color: '#10b981',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    <Check size={12} /> Активен
                                                </span>
                                            ) : (
                                                <span style={{
                                                    background: '#f3f4f6',
                                                    color: '#888',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px'
                                                }}>
                                                    Отключен
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button className="btn btn-sm btn-secondary" style={{ marginRight: '4px' }}>
                                                {ip.enabled ? <X size={14} /> : <Check size={14} />}
                                            </button>
                                            <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Настройки */}
                <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
                    <h3 style={{ margin: '0 0 20px' }}>{t('ipwhitelist.nastroyki', '⚙️ Настройки')}</h3>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span>{t('ipwhitelist.vklyuchyon', 'Whitelist включён')}</span>
                            <label style={{
                                width: '44px', height: '24px',
                                background: settings.whitelist_enabled ? '#10b981' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    width: '20px', height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    top: '2px',
                                    left: settings.whitelist_enabled ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span>{t('ipwhitelist.blokirovat_neizvestnye', 'Блокировать неизвестные IP')}</span>
                            <label style={{
                                width: '44px', height: '24px',
                                background: settings.block_unknown ? '#10b981' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    width: '20px', height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    top: '2px',
                                    left: settings.block_unknown ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </label>
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            Запретить доступ с IP не из списка
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span>{t('ipwhitelist.logirovat_blokirovki', 'Логировать блокировки')}</span>
                            <label style={{
                                width: '44px', height: '24px',
                                background: settings.log_blocked ? '#10b981' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    width: '20px', height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    top: '2px',
                                    left: settings.log_blocked ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span>{t('ipwhitelist.administratory_obhodyat', 'Администраторы обходят')}</span>
                            <label style={{
                                width: '44px', height: '24px',
                                background: settings.admin_bypass ? '#10b981' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    width: '20px', height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    top: '2px',
                                    left: settings.admin_bypass ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </label>
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            Администраторы не блокируются
                        </div>
                    </div>

                    <div style={{
                        padding: '12px',
                        background: '#fef3c7',
                        borderRadius: '8px',
                        marginBottom: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                            <AlertTriangle size={16} />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{t('ipwhitelist.vnimanie', 'Внимание!')}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                            Убедитесь, что ваш текущий IP в списке, иначе вы потеряете доступ.
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%' }}>
                        <Save size={16} /> Сохранить
                    </button>
                </div>
            </div>
        </div>
    );
}

export default IPWhitelist;
