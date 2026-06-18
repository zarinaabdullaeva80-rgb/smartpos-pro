import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, Clock, LogOut, AlertTriangle, RefreshCw, MapPin, Shield, Key } from 'lucide-react';
import { sessionsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function UserSessions() {
    const { t } = useI18n();
    const toast = useToast();
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState({ active: 0, desktop: 0, mobile: 0, suspicious: 0 });
    const [loading, setLoading] = useState(true);
    
    // Extra security states
    const [loginAttempts, setLoginAttempts] = useState([]);
    const [blockedIps, setBlockedIps] = useState([]);
    const [loadingAttempts, setLoadingAttempts] = useState(false);
    const [loadingBlocked, setLoadingBlocked] = useState(false);
    const [ipToBlock, setIpToBlock] = useState({ ip_address: '', reason: '', duration_hours: 24 });

    useEffect(() => { loadData(); }, []);

    const loadLoginAttempts = async () => {
        setLoadingAttempts(true);
        try {
            const res = await sessionsAPI.getLoginAttempts({ hours: 24 });
            const data = res.data || res;
            setLoginAttempts(data.attempts || []);
        } catch (error) {
            console.error('Ошибка загрузки истории входов:', error);
            setLoginAttempts([]);
        } finally {
            setLoadingAttempts(false);
        }
    };

    const loadBlockedIps = async () => {
        setLoadingBlocked(true);
        try {
            const res = await sessionsAPI.getBlockedIps();
            const data = res.data || res;
            setBlockedIps(data.blockedIps || []);
        } catch (error) {
            console.error('Ошибка загрузки заблокированных IP:', error);
            setBlockedIps([]);
        } finally {
            setLoadingBlocked(false);
        }
    };

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

            await loadLoginAttempts();
            await loadBlockedIps();
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
            toast.success('Сессия успешно завершена');
        } catch (error) {
            console.error('Ошибка завершения сессии:', error);
            toast.error('Ошибка завершения сессии');
        }
    };

    const handleTerminateAll = async () => {
        if (!confirm('Завершить ВСЕ сессии (кроме текущей)?')) return;
        try {
            await sessionsAPI.terminateAll();
            toast.success('Все другие сессии успешно завершены');
            loadData();
        } catch (error) {
            console.error('Ошибка:', error);
            toast.error('Ошибка завершения сессий');
        }
    };

    const handleBlockIp = async (e) => {
        e.preventDefault();
        if (!ipToBlock.ip_address) return;
        try {
            await sessionsAPI.blockIp(ipToBlock);
            toast.success(`IP ${ipToBlock.ip_address} успешно заблокирован`);
            setIpToBlock({ ip_address: '', reason: '', duration_hours: 24 });
            loadBlockedIps();
        } catch (error) {
            console.error('Ошибка блокировки IP:', error);
            toast.error('Не удалось заблокировать IP');
        }
    };

    const handleUnblockIp = async (ip) => {
        if (!confirm(`Разблокировать IP ${ip}?`)) return;
        try {
            await sessionsAPI.unblockIp(ip);
            toast.success(`IP ${ip} разблокирован`);
            loadBlockedIps();
        } catch (error) {
            console.error('Ошибка разблокировки IP:', error);
            toast.error('Не удалось разблокировать IP');
        }
    };

    return (
        <div className="user-sessions-page fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1>🖥️ Устройства</h1>
                    <p className="text-muted">Управление активными сессиями и безопасностью входов</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={loadData}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                    <button className="btn btn-primary" style={{ background: '#ef4444' }} onClick={handleTerminateAll}>
                        <LogOut size={18} /> Завершить все другие
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Globe size={28} color="#10b981" style={{ marginBottom: '8px', display: 'inline-block' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.active}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Активных сессий</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Monitor size={28} color="#3b82f6" style={{ marginBottom: '8px', display: 'inline-block' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.desktop}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Компьютеры</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Smartphone size={28} color="#f59e0b" style={{ marginBottom: '8px', display: 'inline-block' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.mobile}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Мобильные</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={28} color={stats.suspicious > 0 ? '#ef4444' : '#888'} style={{ marginBottom: '8px', display: 'inline-block' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: stats.suspicious > 0 ? '#ef4444' : '#888' }}>{stats.suspicious}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Подозрительные</div>
                </div>
            </div>

            {/* Таблица сессий */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>📋 Активные сессии</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка сессий...</div>
                ) : (
                    <div className="table-container">
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Пользователь</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Устройство</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>IP / Локация</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Начало</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Активность</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(session => {
                                    const DeviceIcon = session.device_type === 'mobile' ? Smartphone : Monitor;

                                    return (
                                        <tr key={session.id} style={{
                                            borderBottom: '1px solid var(--border-color)',
                                            background: session.current ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
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
                                                {session.location && (
                                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <MapPin size={12} /> {session.location}
                                                    </div>
                                                )}
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
                                                    <Clock size={14} /> {session.current ? 'Текущий сеанс' : session.last_active}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {!session.current && (
                                                    <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => handleTerminate(session.id)}>
                                                        <LogOut size={14} /> Завершить
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Входы & Блокировка IP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                {/* История входов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>🔑 История входов (последние 24ч)</h3>
                    </div>
                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Время</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Имя / IP</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingAttempts ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem' }}>Загрузка истории...</td></tr>
                                ) : loginAttempts.length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)' }}>Нет записей входов</td></tr>
                                ) : loginAttempts.map((attempt, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontSize: '12px' }}>{new Date(attempt.created_at).toLocaleString('ru')}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{attempt.username}</div>
                                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#888' }}>{attempt.ip_address}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {attempt.success ? (
                                                <span style={{ color: '#00ff88', fontSize: '12px', fontWeight: 600 }}>Успешно</span>
                                            ) : (
                                                <span style={{ color: '#ff003c', fontSize: '12px', fontWeight: 600 }} title={attempt.failure_reason}>
                                                    Ошибка ({attempt.failure_reason || 'пароль'})
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Блокировка IP */}
                <div>
                    <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                        <h3 style={{ margin: '0 0 16px 0' }}>🛡️ Заблокировать IP-адрес</h3>
                        <form onSubmit={handleBlockIp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '6px', color: '#c9b0e8' }}>IP адрес *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Например, 192.168.1.50"
                                    value={ipToBlock.ip_address}
                                    onChange={(e) => setIpToBlock({ ...ipToBlock, ip_address: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '6px', color: '#c9b0e8' }}>Причина блокировки</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Подозрение на брутфорс"
                                    value={ipToBlock.reason}
                                    onChange={(e) => setIpToBlock({ ...ipToBlock, reason: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '6px', color: '#c9b0e8' }}>Срок блокировки (часов)</label>
                                <input
                                    type="number"
                                    className="input"
                                    min="1"
                                    max="8760"
                                    value={ipToBlock.duration_hours}
                                    onChange={(e) => setIpToBlock({ ...ipToBlock, duration_hours: parseInt(e.target.value) || 24 })}
                                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                                <Shield size={16} /> Заблокировать IP
                            </button>
                        </form>
                    </div>

                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>🛡️ Список заблокированных IP</h3>
                        </div>
                        <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>IP / Причина</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>До</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingBlocked ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem' }}>Загрузка списка...</td></tr>
                                    ) : blockedIps.length === 0 ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)' }}>Нет заблокированных IP</td></tr>
                                    ) : blockedIps.map((ipBlock, index) => (
                                        <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{ipBlock.ip_address}</div>
                                                <div style={{ fontSize: '11px', color: '#888' }}>{ipBlock.reason || 'Без причины'}</div>
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '12px' }}>
                                                {ipBlock.blocked_until ? new Date(ipBlock.blocked_until).toLocaleString('ru') : 'Постоянно'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleUnblockIp(ipBlock.ip_address)} style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#00ff88', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                    Разблокировать
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UserSessions;
