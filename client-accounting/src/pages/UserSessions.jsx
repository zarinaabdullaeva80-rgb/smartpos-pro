import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, Clock, LogOut, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { sessionsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function UserSessions() {
    const { t } = useI18n();
    const toast = useToast();
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await sessionsAPI.getAll();
            const data = res.data || res;
            const sessionsList = data.sessions || data || [];

            setSessions(sessionsList.map(s => ({
                id: s.id,
                user: s.user_name || s.username || s.user || 'Пользователь',
                email: s.email || '',
                device: s.user_agent || s.device || 'Неизвестно',
                device_type: (s.user_agent || s.device || '').toLowerCase().includes('mobile') ? 'mobile' : 'desktop',
                ip: s.ip_address || s.ip || '',
                location: s.location || '',
                started: s.created_at ? new Date(s.created_at).toLocaleString('ru') : '',
                last_active: s.last_active ? new Date(s.last_active).toLocaleString('ru') : '',
                current: s.is_current || false
            })));

            const desktopCount = sessionsList.filter(s => !(s.user_agent || '').toLowerCase().includes('mobile')).length;
            const mobileCount = sessionsList.filter(s => (s.user_agent || '').toLowerCase().includes('mobile')).length;
            setStats({
                active: sessionsList.length,
                desktop: desktopCount,
                mobile: mobileCount,
                suspicious: sessionsList.filter(s => s.suspicious).length
            });
        } catch (error) {
            console.error('Ошибка загрузки сессий:', error);
            setSessions([]);
            setStats({ active: 0, desktop: 0, mobile: 0, suspicious: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleTerminate = async (sessionId) => {
        if (!confirm('Завершить сессию?')) return;
        try {
            await sessionsAPI.terminate(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            setStats(prev => ({ ...prev, active: prev.active - 1 }));
        } catch (error) {
            console.error('Ошибка завершения сессии:', error);
            toast.error('Ошибка завершения сессии');
        }
    };

    const handleTerminateAll = async () => {
        if (!confirm('Завершить ВСЕ сессии (кроме текущей)?')) return;
        try {
            for (const session of sessions.filter(s => !s.current)) {
                await sessionsAPI.terminate(session.id);
            }
            loadData();
        } catch (error) {
            console.error('Ошибка:', error);
            toast.error('Ошибка завершения сессий');
        }
    };

    const getDeviceIcon = (type) => {
        return type === 'mobile' ? Smartphone : Monitor;
    };

    return (
        <div className="user-sessions-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('usersessions.sessii_polzovateley', '🖥️ Сессии пользователей')}</h1>
                    <p className="text-muted">{t('usersessions.upravlenie_aktivnymi_sessiyami', 'Управление активными сессиями')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={loadData}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                    <button className="btn btn-primary" style={{ background: '#ef4444' }} onClick={handleTerminateAll}>
                        <LogOut size={18} /> Завершить все
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Globe size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.active}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('usersessions.aktivnyh_sessiy', 'Активных сессий')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Monitor size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.desktop}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('usersessions.desktop', 'Десктоп')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Smartphone size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.mobile}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('usersessions.mobilnye', 'Мобильные')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={28} color={stats.suspicious > 0 ? '#ef4444' : '#888'} style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: stats.suspicious > 0 ? '#ef4444' : '#888' }}>{stats.suspicious}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('usersessions.podozritelnyh', 'Подозрительных')}</div>
                </div>
            </div>

            {/* Таблица сессий */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('usersessions.aktivnye_sessii', '📋 Активные сессии')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('usersessions.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('usersessions.polzovatel', 'Пользователь')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('usersessions.ustroystvo', 'Устройство')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('usersessions.lokatsiya', 'IP / Локация')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('usersessions.nachalo', 'Начало')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('usersessions.aktivnost', 'Активность')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('usersessions.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(session => {
                                const DeviceIcon = getDeviceIcon(session.device_type);

                                return (
                                    <tr key={session.id} style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        background: session.current ? '#dcfce710' : 'transparent'
                                    }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 500 }}>{session.user}</span>
                                                {session.current && (
                                                    <span style={{
                                                        background: '#dcfce7',
                                                        color: '#10b981',
                                                        padding: '2px 8px',
                                                        borderRadius: '8px',
                                                        fontSize: '10px'
                                                    }}>
                                                        Текущая
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{session.email}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <DeviceIcon size={16} color={session.device_type === 'mobile' ? '#f59e0b' : '#3b82f6'} />
                                                <span>{session.device}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <code style={{
                                                background: 'var(--bg-secondary)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                {session.ip}
                                            </code>
                                            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} /> {session.location}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                                            {session.started}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px',
                                                fontSize: '13px'
                                            }}>
                                                <Clock size={14} /> {session.last_active}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {!session.current && (
                                                <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleTerminate(session.id)}>
                                                    <LogOut size={14} /> Завершить
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default UserSessions;
