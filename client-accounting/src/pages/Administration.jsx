import React, { useState, useEffect, useCallback } from 'react';
import {
    Server, Database, HardDrive, ShieldCheck, Users, Activity,
    Eye, EyeOff, RefreshCw, Plus, Trash2, Key, UserPlus, X, Check,
    Cpu, MemoryStick, Globe, Clock, AlertTriangle, Settings, Monitor,
    Download, Upload, Calendar, Search, Filter, LogOut, Shield, Copy, History,
    Pause, Play, BarChart3, Zap
} from 'lucide-react';
import { usersAdminAPI, systemAdminAPI, backupAdminAPI, sessionsAPI, databaseAdminAPI, licenseAdminAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';

function Administration() {
    const { t } = useI18n();
    const toast = useToast();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('monitoring');
    const [loading, setLoading] = useState(true);

    // ===== MONITORING STATE =====
    const [metrics, setMetrics] = useState(null);
    const [services, setServices] = useState(null);
    const [connections, setConnections] = useState(0);

    // ===== USERS STATE =====
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', fullName: '', roleId: '' });

    // ===== SESSIONS STATE =====
    const [sessions, setSessions] = useState([]);

    // ===== BACKUPS STATE =====
    const [backups, setBackups] = useState([]);

    // ===== LOGS STATE =====
    const [logs, setLogs] = useState([]);
    const [logFilter, setLogFilter] = useState('all');

    // ===== DATABASE STATE =====
    const [dbInfo, setDbInfo] = useState(null);

    // ===== LICENSES STATE =====
    const [licenses, setLicenses] = useState([]);
    const [licenseHistory, setLicenseHistory] = useState([]);
    const [licenseSubTab, setLicenseSubTab] = useState('monitoring');
    const [visibleKeys, setVisibleKeys] = useState({});

    // Load data based on active tab
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'monitoring': {
                    const [metricsRes, servicesRes, connRes] = await Promise.all([
                        systemAdminAPI.getMetrics(),
                        systemAdminAPI.getServices(),
                        systemAdminAPI.getConnections()
                    ]);
                    setMetrics(metricsRes.data || metricsRes);
                    setServices((servicesRes.data || servicesRes).services || {});
                    setConnections((connRes.data || connRes).websocket || 0);
                    break;
                }
                case 'users': {
                    const [usersRes, rolesRes] = await Promise.all([
                        usersAdminAPI.getAll(),
                        usersAdminAPI.getRoles()
                    ]);
                    setUsers((usersRes.data || usersRes).users || usersRes.data || []);
                    setRoles(rolesRes.data || rolesRes || []);
                    break;
                }
                case 'sessions': {
                    const res = await sessionsAPI.getAll();
                    setSessions((res.data || res).sessions || []);
                    break;
                }
                case 'backups': {
                    const res = await backupAdminAPI.getAll();
                    setBackups((res.data || res).backups || []);
                    break;
                }
                case 'logs': {
                    const res = await systemAdminAPI.getLogs({ limit: 100, type: logFilter });
                    setLogs((res.data || res).logs || []);
                    break;
                }
                case 'database': {
                    const res = await databaseAdminAPI.getInfo();
                    setDbInfo(res.data || res);
                    break;
                }
                case 'licenses': {
                    const [licRes, histRes] = await Promise.all([
                        licenseAdminAPI.getAll(),
                        licenseAdminAPI.getHistory()
                    ]);
                    setLicenses((licRes.data || licRes).licenses || []);
                    setLicenseHistory((histRes.data || histRes).history || []);
                    break;
                }
            }
        } catch (err) {
            console.warn('Administration: не удалось загрузить данные', err.message);
        }
    }, [activeTab, logFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-refresh monitoring every 10 seconds
    useEffect(() => {
        if (activeTab !== 'monitoring') return;
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [activeTab, loadData]);

    // ===== ACTIONS =====
    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.fullName) {
            toast.error('Заполните обязательные поля');
            return;
        }
        try {
            const res = await usersAdminAPI.create(newUser);
            const data = res.data || res;
            toast.success(`Пользователь создан. Пароль: ${data.password || 'см. email'}`);
            setShowUserModal(false);
            setNewUser({ username: '', email: '', fullName: '', roleId: '' });
            loadData();
        } catch (err) {
            toast.error('Ошибка создания: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleResetPassword = async (userId, username) => {
        if (await confirm({ message: `Сбросить пароль для ${username}?` })) {
            try {
                const res = await usersAdminAPI.resetPassword(userId);
                const data = res.data || res;
                toast.success(`Новый пароль: ${data.password || 'отправлен на email'}`);
            } catch (err) {
                toast.error('Ошибка сброса пароля');
            }
        }
    };

    const handleToggleUser = async (userId, isActive) => {
        try {
            await usersAdminAPI.update(userId, { isActive: !isActive });
            toast.success(isActive ? 'Пользователь деактивирован' : 'Пользователь активирован');
            loadData();
        } catch (err) {
            toast.error('Ошибка обновления');
        }
    };

    const handleTerminateSession = async (sessionId) => {
        if (await confirm({ message: 'Завершить сессию пользователя?' })) {
            try {
                await sessionsAPI.terminate(sessionId);
                toast.success('Сессия завершена');
                loadData();
            } catch (err) {
                toast.error('Ошибка завершения сессии');
            }
        }
    };

    const handleCreateBackup = async () => {
        toast.info('Создание резервной копии...');
        try {
            await backupAdminAPI.create({ type: 'manual' });
            toast.success('Резервная копия создана');
            loadData();
        } catch (err) {
            toast.error('Ошибка создания бэкапа');
        }
    };

    const handleDeleteBackup = async (id, name) => {
        if (await confirm({ message: `Удалить бэкап ${name}?` })) {
            try {
                await backupAdminAPI.delete(id);
                toast.success('Бэкап удалён');
                loadData();
            } catch (err) {
                toast.error('Ошибка удаления');
            }
        }
    };

    const handleOptimizeDB = async () => {
        if (await confirm({ message: 'Оптимизировать базу данных? Это может занять несколько минут.' })) {
            toast.info('Оптимизация...');
            try {
                await databaseAdminAPI.optimize();
                toast.success('Оптимизация завершена');
            } catch (err) {
                toast.error('Ошибка оптимизации');
            }
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '0с';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}д ${h}ч`;
        if (h > 0) return `${h}ч ${m}м`;
        return `${m}м`;
    };

    const tabs = [
        { id: 'monitoring', label: 'Мониторинг', icon: Activity },
        { id: 'users', label: 'Пользователи', icon: Users },
        { id: 'licenses', label: 'Лицензии', icon: Key },
        { id: 'sessions', label: 'Сессии', icon: Globe },
        { id: 'backups', label: 'Бэкапы', icon: HardDrive },
        { id: 'database', label: 'База данных', icon: Database },
        { id: 'logs', label: 'Логи сервера', icon: Monitor }
    ];

    // ===== RENDER TABS =====
    const renderMonitoring = () => (
        <div>
            {/* System Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Cpu size={20} color="#3b82f6" />
                        <span style={{ color: '#888', fontSize: '13px' }}>CPU</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{metrics?.cpu?.usage?.toFixed(1) || 0}%</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{metrics?.cpu?.cores || 0} ядер • {metrics?.cpu?.model?.split(' ').slice(0, 3).join(' ') || ''}</div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${metrics?.cpu?.usage || 0}%`, height: '100%', background: (metrics?.cpu?.usage || 0) > 80 ? '#ef4444' : '#3b82f6', borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <MemoryStick size={20} color="#10b981" />
                        <span style={{ color: '#888', fontSize: '13px' }}>RAM</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{metrics?.memory?.usagePercent?.toFixed(1) || 0}%</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{formatBytes(metrics?.memory?.used)} / {formatBytes(metrics?.memory?.total)}</div>
                    <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${metrics?.memory?.usagePercent || 0}%`, height: '100%', background: (metrics?.memory?.usagePercent || 0) > 80 ? '#ef4444' : '#10b981', borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Database size={20} color="#8b5cf6" />
                        <span style={{ color: '#888', fontSize: '13px' }}>PostgreSQL</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{metrics?.database?.size || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{metrics?.database?.activeConnections || 0} подключений</div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Clock size={20} color="#f59e0b" />
                        <span style={{ color: '#888', fontSize: '13px' }}>Uptime</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatUptime(metrics?.system?.uptime)}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Node {metrics?.system?.nodeVersion || ''}</div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: '4px solid #ec4899' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Globe size={20} color="#ec4899" />
                        <span style={{ color: '#888', fontSize: '13px' }}>{t('administration.soedineniya', 'Соединения')}</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{connections}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{t('administration.klientov', 'WebSocket клиентов')}</div>
                </div>
            </div>

            {/* Services Status */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px' }}>{t('administration.status_servisov', '🔌 Статус сервисов')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {services && Object.entries(services).map(([name, svc]) => (
                        <div key={name} style={{
                            padding: '16px', borderRadius: '8px',
                            background: svc.status === 'online' ? '#dcfce720' : svc.status === 'offline' ? '#fef2f220' : '#f3f4f620',
                            border: `1px solid ${svc.status === 'online' ? '#10b98140' : svc.status === 'offline' ? '#ef444440' : '#88888840'}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: svc.status === 'online' ? '#10b981' : svc.status === 'offline' ? '#ef4444' : '#888',
                                    boxShadow: svc.status === 'online' ? '0 0 8px #10b98180' : 'none'
                                }} />
                                <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{name}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#888' }}>
                                {svc.status === 'online' ? `Работает (${svc.latency}ms)` : svc.status}
                            </div>
                        </div>
                    ))}
                    <div style={{ padding: '16px', borderRadius: '8px', background: '#dbeafe20', border: '1px solid #3b82f640' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f680' }} />
                            <span style={{ fontWeight: 'bold' }}>Node.js</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#888' }}>
                            PID {metrics?.process?.pid} • RAM {formatBytes(metrics?.process?.memoryUsage?.rss)}
                        </div>
                    </div>
                </div>
            </div>

            {/* System Info */}
            <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
                <h3 style={{ margin: '0 0 16px' }}>{t('administration.informatsiya_o_sisteme', '🖥️ Информация о системе')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    {[
                        { label: 'Платформа', value: metrics?.system?.platform || '—' },
                        { label: 'Архитектура', value: metrics?.system?.arch || '—' },
                        { label: 'Hostname', value: metrics?.system?.hostname || '—' },
                        { label: 'Process Uptime', value: formatUptime(metrics?.process?.uptime) }
                    ].map((item, i) => (
                        <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#888' }}>{item.label}</div>
                            <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#888' }}>{users.length} пользователей</div>
                <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
                    <UserPlus size={18} /> Добавить
                </button>
            </div>

            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.polzovatel', 'Пользователь')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.rol', 'Роль')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.status', 'Статус')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.posledniy_vhod', 'Последний вход')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 'bold', fontSize: '14px'
                                        }}>
                                            {(user.full_name || user.username).charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{user.full_name || user.username}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{user.email || user.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
                                        background: user.role_name === 'Администратор' ? '#dbeafe' : user.role_name === 'Менеджер' ? '#fef3c7' : '#f3f4f6',
                                        color: user.role_name === 'Администратор' ? '#3b82f6' : user.role_name === 'Менеджер' ? '#f59e0b' : '#666'
                                    }}>
                                        {user.role_name || 'Не назначена'}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <span style={{
                                        width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block',
                                        background: user.is_active ? '#10b981' : '#ef4444'
                                    }} />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#888' }}>
                                    {user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : 'Никогда'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleResetPassword(user.id, user.username)} title={t('administration.sbrosit_parol', 'Сбросить пароль')}>
                                            <Key size={14} />
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleToggleUser(user.id, user.is_active)} title={user.is_active ? 'Деактивировать' : 'Активировать'}>
                                            {user.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderSessions = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#888' }}>{sessions.length} активных сессий</div>
                <button className="btn btn-secondary" style={{ color: '#ef4444' }} onClick={async () => {
                    if (await confirm({ message: 'Завершить ВСЕ сессии кроме текущей?' })) {
                        try {
                            await sessionsAPI.terminateAll();
                            toast.success('Все сессии завершены');
                            loadData();
                        } catch { toast.error('Ошибка'); }
                    }
                }}>
                    <LogOut size={16} /> Завершить все
                </button>
            </div>
            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.polzovatel', 'Пользователь')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.ustroystvo', 'IP / Устройство')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.nachalo', 'Начало')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.aktivnost', 'Активность')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.username}</td>
                                <td style={{ padding: '12px' }}>
                                    <div>{s.ip}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{s.device}</div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{new Date(s.started_at).toLocaleString('ru-RU')}</td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{new Date(s.last_activity).toLocaleTimeString('ru-RU')}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleTerminateSession(s.id)}>
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderBackups = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', color: '#888' }}>{backups.length} резервных копий</div>
                <button className="btn btn-primary" onClick={handleCreateBackup}>
                    <Download size={18} /> Создать бэкап
                </button>
            </div>
            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.fayl', 'Файл')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.razmer', 'Размер')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.tip', 'Тип')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.data', 'Дата')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.status', 'Статус')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {backups.map(b => (
                            <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <HardDrive size={16} color="#8b5cf6" />
                                        <span style={{ fontWeight: 500 }}>{b.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{b.size}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '2px 10px', borderRadius: '10px', fontSize: '12px',
                                        background: b.type === 'auto' ? '#dbeafe' : '#fef3c7',
                                        color: b.type === 'auto' ? '#3b82f6' : '#f59e0b'
                                    }}>
                                        {b.type === 'auto' ? 'Авто' : 'Ручной'}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{new Date(b.created_at).toLocaleString('ru-RU')}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <Check size={16} color="#10b981" />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={async () => {
                                            if (await confirm({ message: `Восстановить из ${b.name}?` })) {
                                                try { await backupAdminAPI.restore(b.id); toast.success('Восстановление начато'); } catch { toast.error('Ошибка'); }
                                            }
                                        }} title={t('administration.vosstanovit', 'Восстановить')}>
                                            <Upload size={14} />
                                        </button>
                                        <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleDeleteBackup(b.id, b.name)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderDatabase = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="card" style={{ padding: '16px', flex: 1, marginRight: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Database size={32} color="#8b5cf6" />
                    <div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{t('administration.razmer_bazy', 'Размер базы')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dbInfo?.size || '—'}</div>
                    </div>
                </div>
                <div className="card" style={{ padding: '16px', flex: 1, marginRight: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <HardDrive size={32} color="#3b82f6" />
                    <div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{t('administration.tablits', 'Таблиц')}</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{dbInfo?.tables?.length || 0}</div>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={handleOptimizeDB} style={{ alignSelf: 'center' }}>
                    <RefreshCw size={18} /> Оптимизировать
                </button>
            </div>

            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.tablitsa', 'Таблица')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.zapisey', 'Записей')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.razmer', 'Размер')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(dbInfo?.tables || []).map((t, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{t.name}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>{(t.rows || 0).toLocaleString()}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#888' }}>{t.size}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderLogs = () => (
        <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['all', 'info', 'warning', 'error'].map(type => (
                    <button key={type} className={`btn btn-sm ${logFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setLogFilter(type)}>
                        {type === 'all' ? 'Все' : type === 'info' ? '🟢 Info' : type === 'warning' ? '🟡 Warning' : '🔴 Error'}
                    </button>
                ))}
                <button className="btn btn-sm btn-secondary" onClick={loadData} style={{ marginLeft: 'auto' }}>
                    <RefreshCw size={14} /> Обновить
                </button>
            </div>
            <div className="card" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1 }}>
                        <tr>
                            <th style={{ padding: '12px', textAlign: 'left', width: '100px' }}>{t('administration.uroven', 'Уровень')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.soobschenie', 'Сообщение')}</th>
                            <th style={{ padding: '12px', textAlign: 'right', width: '180px' }}>{t('administration.vremya', 'Время')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 12px' }}>
                                    <span style={{
                                        padding: '2px 10px', borderRadius: '10px', fontSize: '11px',
                                        background: log.level === 'error' ? '#fef2f2' : log.level === 'warning' ? '#fefce8' : '#f0fdf4',
                                        color: log.level === 'error' ? '#ef4444' : log.level === 'warning' ? '#f59e0b' : '#10b981'
                                    }}>
                                        {log.level}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace' }}>{log.message}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#888' }}>
                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>{t('administration.net_logov', 'Нет логов')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const handleDeleteLicense = async (id, key) => {
        if (await confirm({ message: `Удалить лицензию ${key?.slice(0, 20)}...? Все связанные данные будут удалены.`, confirmText: 'Удалить', variant: 'danger' })) {
            try {
                await licenseAdminAPI.delete(id);
                toast.success('Лицензия удалена');
                loadData();
            } catch (err) {
                toast.error('Ошибка удаления: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleSuspendLicense = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const actionText = newStatus === 'suspended' ? 'Приостановить' : 'Возобновить';
        if (await confirm({ message: `${actionText} лицензию?`, confirmText: actionText })) {
            try {
                await licenseAdminAPI.update(id, { status: newStatus });
                toast.success(newStatus === 'suspended' ? 'Лицензия приостановлена' : 'Лицензия возобновлена');
                loadData();
            } catch (err) {
                toast.error('Ошибка: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleCopyKey = (key) => {
        navigator.clipboard.writeText(key);
        toast.success('Ключ скопирован');
    };

    const toggleKeyVisibility = (licId) => {
        setVisibleKeys(prev => ({ ...prev, [licId]: !prev[licId] }));
    };

    const actionLabels = {
        'created': '🆕 Создана',
        'updated': '✏️ Обновлена',
        'credentials_reset': '🔑 Сброс пароля',
        'device_activated': '📱 Устройство активировано',
        'device_deactivated': '📴 Устройство деактивировано',
        'customer_device_registered': '📲 Устройство зарегистрировано',
        'customer_device_removed': '🗑️ Устройство удалено',
        'expired': '⏰ Истекла',
        'suspended': '⛔ Приостановлена',
        'resumed': '▶️ Возобновлена'
    };

    const typeLabels = {
        'lifetime': { label: 'Бессрочная', color: '#00ff88', bg: 'rgba(0,255,136,0.12)' },
        'yearly': { label: 'Годовая', color: '#00ccff', bg: 'rgba(0,204,255,0.12)' },
        'monthly': { label: 'Месячная', color: '#ff9500', bg: 'rgba(255,149,0,0.12)' },
        'trial': { label: 'Пробная', color: '#a78bfa', bg: 'rgba(123,47,247,0.12)' }
    };

    const statusColors = {
        'active': { color: '#00ff88', bg: 'rgba(0,255,136,0.12)', label: 'Активна', glow: '0 0 8px rgba(0,255,136,0.3)' },
        'expired': { color: '#ff3355', bg: 'rgba(255,0,60,0.12)', label: 'Истекла', glow: '0 0 8px rgba(255,0,60,0.3)' },
        'suspended': { color: '#ff9500', bg: 'rgba(255,149,0,0.12)', label: 'Приостановлена', glow: '0 0 8px rgba(255,149,0,0.3)' },
        'revoked': { color: '#8a6aad', bg: 'rgba(138,106,173,0.12)', label: 'Отозвана', glow: '0 0 8px rgba(138,106,173,0.3)' }
    };

    // License monitoring stats
    const licenseStats = {
        total: licenses.length,
        active: licenses.filter(l => l.status === 'active').length,
        suspended: licenses.filter(l => l.status === 'suspended').length,
        expired: licenses.filter(l => l.status === 'expired').length,
        totalDevices: licenses.reduce((sum, l) => sum + (l.active_devices || 0), 0),
        maxDevices: licenses.reduce((sum, l) => sum + (l.max_devices || 1), 0)
    };

    const renderLicenseMonitoring = () => (
        <div>
            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', borderLeft: '3px solid #ff0080', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #ff0080, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Key size={20} color="#ff0080" />
                        <span style={{ color: '#8a6aad', fontSize: '13px' }}>{t('administration.vsego_litsenziy', 'Всего лицензий')}</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f0e6ff' }}>{licenseStats.total}</div>
                </div>
                <div className="card" style={{ padding: '20px', borderLeft: '3px solid #00ff88' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Zap size={20} color="#00ff88" />
                        <span style={{ color: '#8a6aad', fontSize: '13px' }}>{t('administration.aktivnye', 'Активные')}</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#00ff88', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>{licenseStats.active}</div>
                    <div style={{ fontSize: '11px', color: '#8a6aad', marginTop: '4px' }}>
                        {licenseStats.total > 0 ? ((licenseStats.active / licenseStats.total) * 100).toFixed(0) : 0}% от всех
                    </div>
                </div>
                <div className="card" style={{ padding: '20px', borderLeft: '3px solid #ff9500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Pause size={20} color="#ff9500" />
                        <span style={{ color: '#8a6aad', fontSize: '13px' }}>{t('administration.priostanovleny', 'Приостановлены')}</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff9500', textShadow: '0 0 10px rgba(255,149,0,0.3)' }}>{licenseStats.suspended}</div>
                </div>
                <div className="card" style={{ padding: '20px', borderLeft: '3px solid #7b2ff7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Monitor size={20} color="#7b2ff7" />
                        <span style={{ color: '#8a6aad', fontSize: '13px' }}>{t('administration.ustroystva', 'Устройства')}</span>
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f0e6ff' }}>{licenseStats.totalDevices}<span style={{ fontSize: '16px', color: '#8a6aad' }}>/{licenseStats.maxDevices}</span></div>
                    <div style={{ height: '4px', background: 'rgba(123,47,247,0.2)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${licenseStats.maxDevices > 0 ? (licenseStats.totalDevices / licenseStats.maxDevices) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #ff0080, #7b2ff7)', borderRadius: '2px', transition: 'width 0.5s' }} />
                    </div>
                </div>
            </div>

            {/* Recent Activity from history */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#f0e6ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="#ff0080" /> Последняя активность
                </h3>
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    {licenseHistory.slice(0, 10).map(h => (
                        <div key={h.id} style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                            borderBottom: '1px solid rgba(123,47,247,0.1)'
                        }}>
                            <span style={{
                                padding: '3px 10px', borderRadius: '10px', fontSize: '11px', whiteSpace: 'nowrap',
                                background: h.action === 'created' ? 'rgba(0,255,136,0.12)' : h.action?.includes('device') ? 'rgba(0,204,255,0.12)' : 'rgba(255,149,0,0.12)',
                                color: h.action === 'created' ? '#00ff88' : h.action?.includes('device') ? '#00ccff' : '#ff9500',
                                border: `1px solid ${h.action === 'created' ? 'rgba(0,255,136,0.3)' : h.action?.includes('device') ? 'rgba(0,204,255,0.3)' : 'rgba(255,149,0,0.3)'}`
                            }}>
                                {actionLabels[h.action] || h.action}
                            </span>
                            <span style={{ flex: 1, fontSize: '13px', color: '#c9b0e8' }}>
                                {h.customer_name || h.company_name || 'Неизвестный клиент'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#8a6aad' }}>
                                {new Date(h.created_at).toLocaleString('ru-RU')}
                            </span>
                        </div>
                    ))}
                    {licenseHistory.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#8a6aad' }}>{t('administration.net_aktivnosti', 'Нет активности')}</div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderLicenses = () => (
        <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button className={`btn btn-sm ${licenseSubTab === 'monitoring' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLicenseSubTab('monitoring')}>
                    <BarChart3 size={14} /> Мониторинг
                </button>
                <button className={`btn btn-sm ${licenseSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLicenseSubTab('list')}>
                    <Key size={14} /> Список лицензий ({licenses.length})
                </button>
                <button className={`btn btn-sm ${licenseSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLicenseSubTab('history')}>
                    <History size={14} /> История ({licenseHistory.length})
                </button>
            </div>

            {licenseSubTab === 'monitoring' ? renderLicenseMonitoring() : licenseSubTab === 'list' ? (
                <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(123,47,247,0.08)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.klient', 'Клиент')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.litsenzionnyy_klyuch', 'Лицензионный ключ')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.login', 'Логин')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.ustroystva', 'Устройства')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.srok', 'Срок')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {licenses.map(lic => {
                                const typeInfo = typeLabels[lic.license_type] || { label: lic.license_type, color: '#8a6aad', bg: 'rgba(138,106,173,0.12)' };
                                const statusInfo = statusColors[lic.status] || { color: '#8a6aad', bg: 'rgba(138,106,173,0.12)', label: lic.status, glow: 'none' };
                                const isKeyVisible = visibleKeys[lic.id];
                                return (
                                    <tr key={lic.id} style={{ borderBottom: '1px solid rgba(123,47,247,0.1)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#f0e6ff' }}>{lic.customer_name || '—'}</div>
                                            <div style={{ fontSize: '12px', color: '#8a6aad' }}>{lic.company_name || ''}</div>
                                        </td>
                                        <td style={{ padding: '12px', maxWidth: '300px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <code style={{
                                                    fontSize: '11px', background: 'rgba(123,47,247,0.1)', padding: '4px 10px', borderRadius: '6px',
                                                    border: '1px solid rgba(123,47,247,0.2)', wordBreak: 'break-all', color: '#c9b0e8',
                                                    maxWidth: isKeyVisible ? '250px' : '150px', display: 'inline-block'
                                                }}>
                                                    {isKeyVisible ? lic.license_key : (lic.license_key ? '••••••••••••••••' : '—')}
                                                </code>
                                                <button onClick={() => toggleKeyVisibility(lic.id)} title={isKeyVisible ? 'Скрыть ключ' : 'Показать ключ'}
                                                    style={{ padding: '3px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                    {isKeyVisible ? <EyeOff size={13} color="#8a6aad" /> : <Eye size={13} color="#8a6aad" />}
                                                </button>
                                                <button onClick={() => handleCopyKey(lic.license_key)} title={t('administration.kopirovat', 'Копировать')}
                                                    style={{ padding: '3px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                    <Copy size={13} color="#8a6aad" />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                                                background: typeInfo.bg, color: typeInfo.color, fontWeight: 'bold',
                                                border: `1px solid ${typeInfo.color}30`
                                            }}>
                                                {typeInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <code style={{ fontSize: '12px', color: '#c9b0e8' }}>{lic.customer_username || '—'}</code>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                                                background: statusInfo.bg, color: statusInfo.color, fontWeight: 'bold',
                                                border: `1px solid ${statusInfo.color}30`,
                                                boxShadow: statusInfo.glow
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#c9b0e8' }}>
                                            <span style={{ color: '#ff0080', fontWeight: 'bold' }}>{lic.active_devices || 0}</span>
                                            <span style={{ color: '#8a6aad' }}> / {lic.max_devices || 1}</span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#8a6aad' }}>
                                            {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('ru-RU') : <span style={{ color: '#00ff88' }}>∞</span>}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                {/* Suspend / Resume */}
                                                {(lic.status === 'active' || lic.status === 'suspended') && (
                                                    <button className="btn btn-sm btn-secondary"
                                                        style={{ color: lic.status === 'active' ? '#ff9500' : '#00ff88' }}
                                                        onClick={() => handleSuspendLicense(lic.id, lic.status)}
                                                        title={lic.status === 'active' ? 'Приостановить' : 'Возобновить'}>
                                                        {lic.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                                    </button>
                                                )}
                                                {/* Delete */}
                                                <button className="btn btn-sm btn-secondary" style={{ color: '#ff3355' }}
                                                    onClick={() => handleDeleteLicense(lic.id, lic.license_key)} title={t('administration.udalit_litsenziyu', 'Удалить лицензию')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {licenses.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#8a6aad' }}>
                                    <Key size={32} style={{ marginBottom: '8px', opacity: 0.3, filter: 'drop-shadow(0 0 8px rgba(123,47,247,0.3))' }} /><br />
                                    Нет лицензий
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* History sub-tab */
                <div className="card" style={{ maxHeight: '600px', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#120020', zIndex: 1 }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.deystvie', 'Действие')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.litsenziya', 'Лицензия')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('administration.klient', 'Клиент')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.kem', 'Кем')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('administration.detali', 'Детали')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('administration.data', 'Дата')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {licenseHistory.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid rgba(123,47,247,0.1)' }}>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                                            background: h.action === 'created' ? 'rgba(0,255,136,0.12)' : h.action?.includes('device') ? 'rgba(0,204,255,0.12)' : 'rgba(255,149,0,0.12)',
                                            color: h.action === 'created' ? '#00ff88' : h.action?.includes('device') ? '#00ccff' : '#ff9500',
                                            border: `1px solid ${h.action === 'created' ? 'rgba(0,255,136,0.3)' : h.action?.includes('device') ? 'rgba(0,204,255,0.3)' : 'rgba(255,149,0,0.3)'}`
                                        }}>
                                            {actionLabels[h.action] || h.action}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <code style={{ fontSize: '11px', color: '#c9b0e8' }}>{h.license_key || '—'}</code>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#c9b0e8' }}>
                                        {h.customer_name || h.company_name || '—'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#8a6aad' }}>
                                        {h.performed_by_username || 'Система'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: '#8a6aad', fontFamily: 'monospace' }}>
                                        {h.details ? (typeof h.details === 'string' ? h.details.slice(0, 40) : JSON.stringify(h.details).slice(0, 40)) : '—'}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#8a6aad' }}>
                                        {new Date(h.created_at).toLocaleString('ru-RU')}
                                    </td>
                                </tr>
                            ))}
                            {licenseHistory.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#8a6aad' }}>
                                    <History size={32} style={{ marginBottom: '8px', opacity: 0.3, filter: 'drop-shadow(0 0 8px rgba(123,47,247,0.3))' }} /><br />
                                    История пуста
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const tabComponents = { monitoring: renderMonitoring, users: renderUsers, licenses: renderLicenses, sessions: renderSessions, backups: renderBackups, database: renderDatabase, logs: renderLogs };

    return (
        <div className="administration-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('administration.administrirovanie', '⚙️ Администрирование')}</h1>
                    <p className="text-muted">{t('administration.monitoring_upravlenie_polzovatelyami_r', 'Мониторинг, управление пользователями, резервные копии')}</p>
                </div>
                <button className="btn btn-secondary" onClick={loadData}>
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} /> Обновить
                </button>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px',
                background: 'var(--bg-secondary)', borderRadius: '12px', overflowX: 'auto'
            }}>
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            flex: '1 0 auto', padding: '10px 16px', border: 'none', cursor: 'pointer',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            fontSize: '13px', transition: 'all 0.2s'
                        }}>
                            <Icon size={16} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                    <RefreshCw size={32} className="spinning" style={{ marginBottom: '12px' }} />
                    <div>{t('administration.zagruzka', 'Загрузка...')}</div>
                </div>
            ) : (
                tabComponents[activeTab] && tabComponents[activeTab]()
            )}

            {/* Create User Modal */}
            {showUserModal && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('administration.novyy_polzovatel', '👤 Новый пользователь')}</h2>
                            <button className="modal-close" onClick={() => setShowUserModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('administration.login', 'Логин *')}</label>
                                <input type="text" className="form-input" value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="username" />
                            </div>
                            <div className="form-group">
                                <label>{t('administration.fio', 'ФИО *')}</label>
                                <input type="text" className="form-input" value={newUser.fullName}
                                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                    placeholder="Иванов Иван Иванович" />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input type="email" className="form-input" value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="user@company.com" />
                            </div>
                            <div className="form-group">
                                <label>{t('administration.rol', 'Роль')}</label>
                                <select className="form-input" value={newUser.roleId}
                                    onChange={e => setNewUser({ ...newUser, roleId: e.target.value })}>
                                    <option value="">{t('administration.vyberite_rol', 'Выберите роль')}</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px', color: '#888' }}>
                                💡 Пароль будет сгенерирован автоматически
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>{t('administration.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={handleCreateUser}>
                                <UserPlus size={18} /> Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Administration;
