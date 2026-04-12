import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, Check, X, QrCode, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { usersAPI, twoFactorAPI, settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function TwoFactorAuth() {
    const { t } = useI18n();
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersRes, settingsRes] = await Promise.all([
                usersAPI.getAll().then(r => r.data || r),
                settingsAPI.getAll().then(r => r.data || r)
            ]);

            const usersList = usersRes.users || usersRes || [];
            setUsers(usersList.map(u => ({
                id: u.id,
                name: u.full_name || u.username || u.name,
                email: u.email || '',
                role: u.role || 'Пользователь',
                twofa_enabled: u.two_factor_enabled || false,
                method: u.two_factor_enabled ? 'app' : null,
                last_login: u.last_login ? new Date(u.last_login).toLocaleString('ru') : '-'
            })));

            const s = settingsRes.settings || settingsRes || {};
            setSettings({
                require_2fa: s.require_2fa || false,
                allowed_methods: s.allowed_2fa_methods || ['app', 'sms', 'email'],
                backup_codes: s.backup_codes !== false,
                remember_device: s.remember_device || 30
            });
        } catch (error) {
            console.error('Ошибка загрузки 2FA данных:', error);
            setUsers([]);
            setSettings({ require_2fa: false, allowed_methods: ['app', 'sms', 'email'], backup_codes: true, remember_device: 30 });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await settingsAPI.update({
                require_2fa: settings.require_2fa,
                allowed_2fa_methods: settings.allowed_methods,
                backup_codes: settings.backup_codes,
                remember_device: settings.remember_device
            });
            toast.success('Настройки 2FA сохранены');
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            toast.error('Ошибка сохранения настроек');
        }
    };

    const getMethodInfo = (method) => {
        const methods = {
            app: { label: 'Приложение (TOTP)', icon: Smartphone, color: '#3b82f6' },
            sms: { label: 'SMS', icon: Smartphone, color: '#10b981' },
            email: { label: 'Email', icon: Smartphone, color: '#f59e0b' }
        };
        return methods[method] || methods.app;
    };

    const enabledCount = users.filter(u => u.twofa_enabled).length;
    const disabledCount = users.filter(u => !u.twofa_enabled).length;
    const appCount = users.filter(u => u.method === 'app').length;
    const smsCount = users.filter(u => u.method === 'sms').length;

    return (
        <div className="two-factor-auth-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('twofactorauth.avtorizatsiya', '🔐 2FA авторизация')}</h1>
                    <p className="text-muted">{t('twofactorauth.dvuhfaktornaya_autentifikatsiya', 'Двухфакторная аутентификация')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Shield size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{enabledCount}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('twofactorauth.vklyuchena', '2FA включена')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{disabledCount}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('twofactorauth.bez', 'Без 2FA')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Smartphone size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{appCount}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('twofactorauth.prilozhenie', 'TOTP приложение')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Key size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{smsCount}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>SMS</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Пользователи */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('twofactorauth.polzovateli_i', '👥 Пользователи и 2FA')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('twofactorauth.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('twofactorauth.polzovatel', 'Пользователь')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('twofactorauth.rol', 'Роль')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>2FA</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('twofactorauth.metod', 'Метод')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('twofactorauth.posledniy_vhod', 'Последний вход')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => {
                                    const methodInfo = user.method ? getMethodInfo(user.method) : null;

                                    return (
                                        <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ fontWeight: 500 }}>{user.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{user.email}</div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px'
                                                }}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {user.twofa_enabled ? (
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
                                                        <Check size={12} /> Включена
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        background: '#fee2e2',
                                                        color: '#ef4444',
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <X size={12} /> Выключена
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {methodInfo ? (
                                                    <span style={{
                                                        color: methodInfo.color,
                                                        fontWeight: 500,
                                                        fontSize: '12px'
                                                    }}>
                                                        {methodInfo.label}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                                                {user.last_login}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Настройки */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 20px' }}>{t('twofactorauth.nastroyki', '⚙️ Настройки 2FA')}</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span>{t('twofactorauth.obyazatelnaya', 'Обязательная 2FA')}</span>
                            <label className="switch" style={{
                                width: '44px', height: '24px',
                                background: settings.require_2fa ? '#10b981' : '#ccc',
                                borderRadius: '12px',
                                position: 'relative',
                                cursor: 'pointer'
                            }} onClick={() => setSettings(s => ({ ...s, require_2fa: !s.require_2fa }))}>
                                <span style={{
                                    position: 'absolute',
                                    width: '20px', height: '20px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    top: '2px',
                                    left: settings.require_2fa ? '22px' : '2px',
                                    transition: 'left 0.2s'
                                }} />
                            </label>
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            Требовать 2FA для всех пользователей
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 500 }}>{t('twofactorauth.razreshyonnye_metody', 'Разрешённые методы:')}</div>
                        {['app', 'sms', 'email'].map(method => {
                            const info = getMethodInfo(method);
                            const enabled = settings.allowed_methods?.includes(method);

                            return (
                                <div key={method} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px',
                                    marginBottom: '4px',
                                    background: enabled ? `${info.color}10` : 'transparent',
                                    borderRadius: '8px'
                                }}>
                                    <input type="checkbox" checked={enabled} onChange={() => {
                                        setSettings(s => ({
                                            ...s,
                                            allowed_methods: enabled
                                                ? s.allowed_methods.filter(m => m !== method)
                                                : [...(s.allowed_methods || []), method]
                                        }));
                                    }} />
                                    <span style={{ color: enabled ? info.color : '#888' }}>{info.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>{t('twofactorauth.rezervnye_kody', 'Резервные коды')}</span>
                            <Check size={16} color="#10b981" />
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                            Генерировать резервные коды при настройке
                        </div>
                    </div>

                    <div>
                        <div style={{ marginBottom: '8px', fontWeight: 500 }}>{t('twofactorauth.zapominat_ustroystvo', 'Запоминать устройство:')}</div>
                        <select style={{ width: '100%' }} value={settings.remember_device} onChange={e => setSettings(s => ({ ...s, remember_device: parseInt(e.target.value) }))}>
                            <option value={0}>{t('twofactorauth.nikogda', 'Никогда')}</option>
                            <option value={7}>{t('twofactorauth.dney', '7 дней')}</option>
                            <option value={30}>{t('twofactorauth.dney', '30 дней')}</option>
                            <option value={90}>{t('twofactorauth.dney', '90 дней')}</option>
                        </select>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={handleSaveSettings}>
                        <RefreshCw size={16} /> Сохранить настройки
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TwoFactorAuth;
