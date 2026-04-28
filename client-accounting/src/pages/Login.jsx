import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { 
    Monitor, Lock, Unlock, Key, Settings, Wifi, WifiOff, RefreshCw, 
    AlertCircle, CheckCircle, Eye, EyeOff, Info, LogIn, Server, Search, Cloud, Clock 
} from 'lucide-react';
import LicenseTimer from '../components/LicenseTimer';
import { getServerMode, setServerMode, setApiUrl, getApiUrl, getLicenseServerUrl, autoDiscoverServer, testServerConnection, SERVER_MODES } from '../config/settings';
import { useI18n } from '../i18n';
import '../styles/Login.css';

function Login({ onLogin }) {
    // Определяем мобильное/PWA устройство (только телефоны/планшеты)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    
    const [mode, setMode] = useState(isMobile ? 'settings' : 'login'); // 'login', 'license', 'settings'
    const { t } = useI18n();
    const [credentials, setCredentials] = useState(() => {
        const savedUser = localStorage.getItem('saved_username');
        return { username: savedUser || '', password: '' };
    });
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('remember_me') === 'true');
    const [licenseKey, setLicenseKey] = useState('');
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || '');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [licenseInfo, setLicenseInfo] = useState(null);
    const [licenseValid, setLicenseValid] = useState(false);
    const [licenseChecking, setLicenseChecking] = useState(true);

    // Статус подключения к серверу
    const [serverConnected, setServerConnected] = useState(false);
    const [serverChecking, setServerChecking] = useState(true);

    // Режим сервера
    const [srvMode, setSrvMode] = useState(getServerMode());
    const [discovering, setDiscovering] = useState(false);
    const [discoverProgress, setDiscoverProgress] = useState({ scanned: 0, total: 0 });
    const [connectionStatus, setConnectionStatus] = useState(null); // 'connected', 'error', null
    const [testing, setTesting] = useState(false);
    const [serverInfo, setServerInfo] = useState(null); // { connectionUrl, primaryIP, localIPs }

    // Получить информацию о сервере (IP адреса) — для показа мобильным
    useEffect(() => {
        const fetchServerInfo = async () => {
            if (window.electron?.getServerInfo) {
                try {
                    const info = await window.electron.getServerInfo();
                    setServerInfo(info);
                } catch (e) {
                    console.log('[Login] Could not get server info:', e.message);
                }
            }
        };
        fetchServerInfo();
    }, [srvMode]);

    // Проверка подключения к серверу
    const checkServerConnection = async () => {
        setServerChecking(true);
        try {
            const apiUrl = getApiUrl();
            const baseUrl = apiUrl.replace(/\/api\/?$/, '');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${baseUrl}/api/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log('[Server] Connected to:', baseUrl);
                setServerConnected(true);
                setConnectionStatus('connected');
                setServerChecking(false);
                setError('');
                return true;
            }
        } catch (err) {
            console.log('[Server] Not available:', err.message);
        }

        // Попробовать автопоиск на 127.0.0.1:5000
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch('http://127.0.0.1:5000/api/health', {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log('[Server] Auto-discovered at 127.0.0.1:5000');
                setApiUrl('http://127.0.0.1:5000/api');
                setServerUrl('http://127.0.0.1:5000/api');
                setServerConnected(true);
                setConnectionStatus('connected');
                setServerChecking(false);
                setError('');
                return true;
            }
        } catch (err) {
            // localhost:5000 тоже не доступен
        }

        setServerConnected(false);
        setConnectionStatus('error');
        setServerChecking(false);
        return false;
    };

    // Загрузить сохранённые настройки и проверить лицензию
    useEffect(() => {
        const savedLicense = localStorage.getItem('license_key');
        const savedServer = localStorage.getItem('server_url');
        if (savedLicense) setLicenseKey(savedLicense);
        if (savedServer) setServerUrl(savedServer);

        // Автоматическая инициализация: сервер → лицензия → автовход
        const init = async () => {
            const connected = await checkServerConnection();

            // Мобильное устройство — пропускаем лицензию (сервер сам проверяет)
            if (isMobile) {
                setLicenseChecking(false);
                setLicenseValid(true);
                if (connected) {
                    setMode('login');
                } else {
                    setMode('settings');
                }
            } else if (savedLicense) {
                await checkSavedLicense(savedLicense);
            } else {
                setLicenseChecking(false);
                setMode('license');
                return; // Нет лицензии — ждём ввода
            }

            // Автовход если есть сохранённый токен
            const savedToken = localStorage.getItem('token');
            const remember = localStorage.getItem('remember_me') === 'true';

            if (connected && savedToken) {
                console.log('[AutoLogin] Attempting token-based auto-login');
                setSuccess('Автовход...');
                try {
                    const response = await authAPI.getCurrentUser();
                    const user = response.data;
                    if (user && user.id) {
                        localStorage.setItem('user', JSON.stringify(user));
                        onLogin();
                        return;
                    }
                } catch (err) {
                    console.log('[AutoLogin] Token expired:', err.message);
                    localStorage.removeItem('token');
                    // Токен протух — пользователь введёт пароль вручную
                    setSuccess('');
                }
            }
        };
        init();

        // Автоповтор проверки каждые 10 секунд если нет подключения
        const interval = setInterval(async () => {
            const connected = await checkServerConnection();
            if (connected && !licenseValid) {
                const savedLic = localStorage.getItem('license_key');
                if (savedLic) checkSavedLicense(savedLic);
            }
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // Проверка сохранённой лицензии при загрузке
    const checkSavedLicense = async (key) => {
        try {
            // Проверяем на центральном сервере лицензирования
            const licenseUrl = await getLicenseServerUrl();
            const response = await fetch(`${licenseUrl}/license/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: key })
            });
            const data = await response.json();
            if (data.valid) {
                setLicenseInfo(data.license);
                setLicenseValid(true);
                setMode('login');
                setError('');
                setSuccess('Лицензия подтверждена');
                // Автонастройка сервера по лицензии
                if (data.license.server_url) {
                    const savedServerUrl = localStorage.getItem('server_url');
                    if (!savedServerUrl) {
                        setApiUrl(data.license.server_url);
                        setServerUrl(data.license.server_url);
                    }
                }
            } else {
                setLicenseValid(false);
                setMode('license');
                localStorage.removeItem('license_key');
            }
        } catch (err) {
            // Не удалось проверить — разрешить вход (офлайн режим)
            const savedInfo = localStorage.getItem('license_info');
            if (savedInfo) {
                setLicenseInfo(JSON.parse(savedInfo));
                setLicenseValid(true);
                setMode('login');
            } else {
                setLicenseValid(false);
                setMode('license');
            }
        } finally {
            setLicenseChecking(false);
        }
    };

    // Проверка лицензии
    const validateLicense = async () => {
        if (!licenseKey.trim()) {
            setError('Введите лицензионный ключ');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Проверяем лицензию на центральном сервере
            const licenseUrl = await getLicenseServerUrl();
            console.log('[License] Validating on:', licenseUrl);
            console.log('[License] Key:', licenseKey);

            const response = await fetch(`${licenseUrl}/license/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: licenseKey })
            });

            console.log('[License] Response status:', response.status);
            const data = await response.json();
            console.log('[License] Response data:', data);

            if (data.valid) {
                setLicenseInfo(data.license);
                setLicenseValid(true);
                localStorage.setItem('license_key', licenseKey);
                localStorage.setItem('license_info', JSON.stringify(data.license));
                if (serverUrl) localStorage.setItem('server_url', serverUrl);

                // Автонастройка сервера по лицензии (если вручную не указано)
                if (data.license.server_url) {
                    const savedServerUrl = localStorage.getItem('server_url');
                    if (!savedServerUrl) {
                        setApiUrl(data.license.server_url);
                        setServerUrl(data.license.server_url);
                        setSuccess(`✅ Лицензия активирована! Сервер: ${data.license.server_url}`);
                    } else {
                        setSuccess('✅ Лицензия активирована!');
                    }
                } else {
                    setSuccess('✅ Лицензия активирована!');
                }

                setTimeout(() => { setSuccess(''); setMode('login'); }, 2000);
            } else {
                setError(data.error || 'Лицензия недействительна');
            }
        } catch (err) {
            console.error('[License] Validation error:', err);
            const licenseUrl = await getLicenseServerUrl();
            setError(`Ошибка подключения к серверу лицензирования (${licenseUrl}). ${err.message || ''}`);
        } finally {
            setLoading(false);
        }
    };

    // Вход в систему
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!serverConnected) {
            setError('Нет подключения к серверу. Проверьте настройки.');
            return;
        }
        if (!licenseValid && !isMobile) {
            setError('Сначала активируйте лицензию');
            setMode('license');
            return;
        }
        setError('');
        setLoading(true);

        try {
            // ★ Передаём license_key для проверки принадлежности на сервере
            const savedLicenseKey = localStorage.getItem('license_key');
            const loginPayload = { 
                ...credentials,
                ...(savedLicenseKey ? { license_key: savedLicenseKey } : {})
            };
            const response = await authAPI.login(loginPayload);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Сохранить информацию о лицензии если есть
            if (response.data.license) {
                localStorage.setItem('license_info', JSON.stringify(response.data.license));
            }

            // Сохранить имя пользователя для удобства (пароль НЕ сохраняем!)
            if (rememberMe) {
                localStorage.setItem('saved_username', credentials.username);
                localStorage.setItem('remember_me', 'true');
            } else {
                localStorage.removeItem('saved_username');
                localStorage.setItem('remember_me', 'false');
            }
            // Очистка устаревшего saved_password
            localStorage.removeItem('saved_password');

            onLogin();
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    // Сохранить настройки сервера
    const saveServerSettings = async () => {
        setServerMode(srvMode);
        if (srvMode === SERVER_MODES.OWN) {
            // Свой сервер: используем локальный адрес или введённый пользователем
            const ownUrl = serverUrl || 'http://127.0.0.1:5000/api';
            setApiUrl(ownUrl);
        } else if (srvMode === SERVER_MODES.CLOUD) {
            // Облако: используем введённый URL облачного сервера
            if (serverUrl) {
                setApiUrl(serverUrl);
            }
        }
        // Уведомить Electron о смене режима
        if (window.electron?.setServerMode) {
            window.electron.setServerMode(srvMode);
        }
        setSuccess('Настройки сохранены');
        // Перепроверить подключение с новыми настройками
        setTimeout(async () => {
            setSuccess('');
            await checkServerConnection();
            setMode('login');
        }, 800);
    };

    // Автопоиск сервера WiFi
    const handleAutoDiscover = async () => {
        setDiscovering(true);
        setConnectionStatus(null);
        setError('');
        try {
            const foundUrl = await autoDiscoverServer((scanned, total) => {
                setDiscoverProgress({ scanned, total });
            });
            if (foundUrl) {
                setServerUrl(foundUrl);
                setApiUrl(foundUrl);
                setConnectionStatus('connected');
                setSuccess(`Сервер найден: ${foundUrl.replace('/api', '')}`);
            } else {
                setConnectionStatus('error');
                setError('Сервер не найден в WiFi сети. Проверьте что сервер запущен и устройства в одной сети.');
            }
        } catch (e) {
            setConnectionStatus('error');
            setError('Ошибка поиска: ' + e.message);
        } finally {
            setDiscovering(false);
        }
    };

    // Тест подключения
    const handleTestConnection = async () => {
        if (!serverUrl) { setError('Введите адрес сервера'); return; }
        setTesting(true);
        setConnectionStatus(null);
        setError('');
        const result = await testServerConnection(serverUrl);
        if (result.ok) {
            setConnectionStatus('connected');
            setSuccess('Сервер доступен');
        } else {
            setConnectionStatus('error');
            setError(`Ошибка подключения: ${result.error}`);
        }
        setTesting(false);
    };

    if (licenseChecking) {
        return (
            <div className="login-container">
                <div className="login-card glass" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }}></div>
                    <p>{t('login.proverka_litsenzii', 'Проверка лицензии...')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card glass">
                <div className="login-header">
                    <div className="login-icon">
                        <Monitor size={42} strokeWidth={1.5} />
                    </div>
                    <h1>SmartPOS Pro</h1>
                    <p>{mode === 'license' ? 'Активация лицензии' : mode === 'settings' ? 'Подключение к серверу' : 'Войдите в систему'}</p>
                </div>

                {/* Табы переключения режима */}
                <div className="login-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            setError('');
                            setSuccess('');
                            (isMobile || licenseValid) ? setMode('login') : (setError('Сначала активируйте лицензию'), setMode('license'));
                        }}
                        style={{ flex: 1, opacity: (isMobile || licenseValid) ? 1 : 0.5 }}
                    >
                        {(isMobile || licenseValid) ? <Unlock size={16} /> : <Lock size={16} />} {t('auth.loginBtn', 'Вход')}
                    </button>
                    {!isMobile && (
                        <button
                            type="button"
                            className={`btn btn-sm ${mode === 'license' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                                setError('');
                                setSuccess('');
                                setMode('license');
                            }}
                            style={{ flex: 1 }}
                        >
                            <Key size={16} /> Лицензия {licenseValid && <CheckCircle size={12} color="#22c55e" />}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`btn btn-sm ${mode === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            setError('');
                            setSuccess('');
                            setMode('settings');
                        }}
                        style={{ flex: 1 }}
                    >
                        <Settings size={16} /> Сервер
                    </button>
                </div>

                {/* Статус сервера */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    backgroundColor: serverConnected ? 'rgba(34, 197, 94, 0.1)' : serverChecking ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: serverConnected ? '#22c55e' : serverChecking ? '#3b82f6' : '#ef4444',
                    border: `1px solid ${serverConnected ? 'rgba(34, 197, 94, 0.2)' : serverChecking ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                    {serverConnected ? (
                        <><Wifi size={14} /> {t('login.server_podklyuchyon', 'Сервер подключён')}</>
                    ) : serverChecking ? (
                        <><RefreshCw size={14} className="spin" /> {t('login.poisk_servera', 'Поиск сервера...')}</>
                    ) : (
                        <><WifiOff size={14} /> {t('login.server_ne_nayden', 'Сервер не найден')}</>
                    )}
                    {!serverConnected && !serverChecking && (
                        <button
                            type="button"
                            onClick={checkServerConnection}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <RefreshCw size={12} /> Повторить
                        </button>
                    )}
                </div>

                {/* Сообщения */}
                {error && (
                    <div className="alert alert-danger fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}
                {success && (
                    <div className="alert alert-success fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '0.75rem', borderRadius: '8px' }}>
                        <CheckCircle size={18} /> {success}
                    </div>
                )}

                {/* Форма входа */}
                {mode === 'login' && (
                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label>{t('auth.username')}</label>
                            <input
                                type="text"
                                value={credentials.username}
                                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                placeholder="Введите имя пользователя"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>{t('auth.password')}</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                    placeholder="Введите пароль"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex="-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Запомнить меня */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                            />
                            <label htmlFor="rememberMe" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                                {t('auth.rememberMe')}
                            </label>
                        </div>

                        {/* Показать информацию о лицензии если есть */}
                        {licenseInfo && (
                            <div style={{
                                padding: '0.75rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.875rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <Info size={16} color="var(--color-primary)" />
                                            <strong>Лицензия: {licenseInfo.type}</strong>
                                        </div>
                                        {licenseInfo.expires_at && (
                                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                                Действует до: {new Date(licenseInfo.expires_at).toLocaleDateString('ru-RU')}
                                            </div>
                                        )}
                                    </div>
                                    {licenseInfo.expires_at && (
                                        <div style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                                            <LicenseTimer 
                                                expiryDate={licenseInfo.expires_at} 
                                                showDate={false} 
                                                showTime={false} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary w-full" disabled={loading || !serverConnected}>
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: 20, height: 20 }}></div>
                                    {t('auth.loggingIn')}
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    {t('auth.loginBtn')}
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Форма активации лицензии */}
                {mode === 'license' && (
                    <div className="login-form">
                        <div className="form-group">
                            <label>{t('login.litsenzionnyy_klyuch', 'Лицензионный ключ')}</label>
                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                style={{ fontFamily: 'monospace', letterSpacing: '2px' }}
                            />
                        </div>

                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                            color: 'var(--color-text-muted)'
                        }}>
                            <Info size={16} style={{ marginRight: '0.5rem' }} />
                            Введите лицензионный ключ, полученный при покупке программы
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary w-full"
                            onClick={validateLicense}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: 20, height: 20 }}></div>
                                    {t('login.proverka', 'Проверка...')}
                                </>
                            ) : (
                                <>
                                    <Key size={20} />
                                    Активировать лицензию
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Настройки сервера */}
                {mode === 'settings' && (
                    <div className="login-form">
                        {/* Выбор режима — 2 плитки */}
                        <label style={{ marginBottom: '0.75rem', display: 'block', fontWeight: 600, fontSize: '1rem' }}>
                            {t('login.rezhim_podklyucheniya', 'Режим подключения')}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            {/* Плитка: Свой сервер */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSrvMode(SERVER_MODES.OWN);
                                    setError('');
                                    setSuccess('');
                                    setConnectionStatus(null);
                                    setServerUrl('http://127.0.0.1:5000/api');
                                }}
                                style={{
                                    padding: '1rem 0.75rem',
                                    borderRadius: '12px',
                                    border: srvMode === SERVER_MODES.OWN ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.1)',
                                    backgroundColor: srvMode === SERVER_MODES.OWN ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease',
                                    color: srvMode === SERVER_MODES.OWN ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                }}
                            >
                                <Monitor size={28} />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Свой сервер</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'center', lineHeight: 1.3 }}>
                                    Данные на вашем ПК.{'\n'}WiFi + мобильный интернет
                                </span>
                            </button>

                            {/* Плитка: Облако */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSrvMode(SERVER_MODES.CLOUD);
                                    setError('');
                                    setSuccess('');
                                    setConnectionStatus(null);
                                    setServerUrl('');
                                }}
                                style={{
                                    padding: '1rem 0.75rem',
                                    borderRadius: '12px',
                                    border: srvMode === SERVER_MODES.CLOUD ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.1)',
                                    backgroundColor: srvMode === SERVER_MODES.CLOUD ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease',
                                    color: srvMode === SERVER_MODES.CLOUD ? '#3b82f6' : 'var(--color-text-muted)',
                                }}
                            >
                                <Cloud size={28} />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Облако</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'center', lineHeight: 1.3 }}>
                                    Данные в облаке + копия{'\n'}на вашем ПК
                                </span>
                            </button>
                        </div>

                        {/* ===== Панель: Свой сервер ===== */}
                        {srvMode === SERVER_MODES.OWN && (
                            <>
                                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <CheckCircle size={16} color="#22c55e" />
                                        <span style={{ fontWeight: 600 }}>Сервер на вашем ПК (порт 5000)</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                        • Все данные хранятся на вашем компьютере<br/>
                                        • Сотрудники подключаются по WiFi или через интернет<br/>
                                        • При сбое связи данные сохраняются локально
                                    </div>
                                </div>

                                {/* Информация для мобильных */}
                                <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    📱 Для подключения мобильных устройств:<br/>
                                    {serverInfo?.connectionUrl ? (
                                        <>
                                            Адрес: <strong style={{ color: 'var(--color-primary)', fontSize: '0.9rem', userSelect: 'all' }}>{serverInfo.connectionUrl}</strong>
                                        </>
                                    ) : (
                                        'Введите IP этого ПК:5000 в мобильном приложении'
                                    )}
                                </div>

                                {/* Ручной ввод адреса или WiFi поиск */}
                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.85rem' }}>Адрес сервера (автоматически или вручную)</label>
                                    <input
                                        type="text"
                                        value={serverUrl}
                                        onChange={(e) => setServerUrl(e.target.value)}
                                        placeholder="http://127.0.0.1:5000/api"
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleAutoDiscover}
                                        disabled={discovering}
                                        style={{ flex: 1, fontSize: '0.8rem' }}
                                    >
                                        {discovering ? (
                                            <><RefreshCw size={14} className="spin" /> Поиск... ({discoverProgress.scanned}/{discoverProgress.total || '?'})</>
                                        ) : (
                                            <><Search size={14} /> 🔍 Найти в WiFi</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleTestConnection}
                                        disabled={testing}
                                        style={{ flex: 1, fontSize: '0.8rem' }}
                                    >
                                        {testing ? (
                                            <><RefreshCw size={14} className="spin" /> Проверка...</>
                                        ) : (
                                            <><Wifi size={14} /> Проверить</>
                                        )}
                                    </button>
                                </div>

                                {connectionStatus && (
                                    <div style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '8px',
                                        marginBottom: '0.75rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        backgroundColor: connectionStatus === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: connectionStatus === 'connected' ? '#22c55e' : '#ef4444',
                                    }}>
                                        {connectionStatus === 'connected' ? <CheckCircle size={16} /> : <WifiOff size={16} />}
                                        {connectionStatus === 'connected' ? '✅ Сервер доступен' : '❌ Нет подключения'}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ===== Панель: Облако ===== */}
                        {srvMode === SERVER_MODES.CLOUD && (
                            <>
                                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <Cloud size={16} color="#3b82f6" />
                                        <span style={{ fontWeight: 600 }}>Облачный сервер Railway</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                        • Данные в облаке + резервная копия на вашем ПК<br/>
                                        • Работает с любого устройства через интернет<br/>
                                        • При отсутствии интернета — работа через мобильную сеть
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.85rem' }}>URL облачного сервера</label>
                                    <input
                                        type="url"
                                        value={serverUrl}
                                        onChange={(e) => setServerUrl(e.target.value)}
                                        placeholder="https://your-server.up.railway.app/api"
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-secondary w-full"
                                    onClick={handleTestConnection}
                                    disabled={testing}
                                    style={{ marginBottom: '0.75rem' }}
                                >
                                    {testing ? (
                                        <><RefreshCw size={16} className="spin" /> Проверка...</>
                                    ) : (
                                        <><Cloud size={16} /> Проверить подключение</>
                                    )}
                                </button>

                                {connectionStatus && (
                                    <div style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '8px',
                                        marginBottom: '0.75rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        backgroundColor: connectionStatus === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: connectionStatus === 'connected' ? '#22c55e' : '#ef4444',
                                    }}>
                                        {connectionStatus === 'connected' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        {connectionStatus === 'connected' ? '✅ Облако доступно' : '❌ Нет подключения'}
                                    </div>
                                )}
                            </>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary w-full"
                            onClick={saveServerSettings}
                            style={{ marginTop: '0.5rem' }}
                        >
                            <Server size={20} />
                            Сохранить настройки
                        </button>
                    </div>
                )}

                {/* Переключатель языка */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                    {[
                        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
                        { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
                    ].map(l => {
                        const lang = localStorage.getItem('smartpos_lang') || 'ru';
                        return (
                            <button
                                key={l.code}
                                type="button"
                                className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    localStorage.setItem('smartpos_lang', l.code);
                                    window.location.reload();
                                }}
                                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                            >
                                {l.flag} {l.name}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default Login;
