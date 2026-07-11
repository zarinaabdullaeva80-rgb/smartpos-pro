import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { 
    Monitor, Lock, Unlock, Key, Settings, Wifi, WifiOff, RefreshCw, 
    AlertCircle, CheckCircle, Eye, EyeOff, Info, LogIn, Server, Search, Cloud, Clock 
} from 'lucide-react';
import LicenseTimer from '../components/LicenseTimer';
import { getServerMode, setServerMode, setApiUrl, getApiUrl, getCloudUrl, setCloudUrl, getLicenseServerUrl, autoDiscoverServer, testServerConnection, SERVER_MODES } from '../config/settings';
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
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || 'http://127.0.0.1:5000/api');
    const [cloudUrl, setCloudUrlInput] = useState(getCloudUrl());
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

    // Проверка подключения к облачному серверу Railway
    const CLOUD_API_URL = 'https://smartpos-pro-production-f885.up.railway.app/api';

    const checkServerConnection = async () => {
        setServerChecking(true);
        try {
            // Всегда подключаемся к облачному серверу Railway
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${CLOUD_API_URL}/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log('[Server] Connected to Railway cloud');
                setApiUrl(CLOUD_API_URL);
                setServerConnected(true);
                setConnectionStatus('connected');
                setServerChecking(false);
                setError('');
                return true;
            }
        } catch (err) {
            console.log('[Server] Railway not available:', err.message);
        }

        setServerConnected(false);
        setConnectionStatus('error');
        setServerChecking(false);
        setError('Нет подключения к серверу. Проверьте интернет-соединение.');
        return false;
    };

    // Загрузить сохранённые настройки и проверить лицензию
    useEffect(() => {
        const savedLicense = localStorage.getItem('license_key');
        const savedServer = localStorage.getItem('server_url');
        if (savedLicense) setLicenseKey(savedLicense);
        if (savedServer) setServerUrl(savedServer);

        // Автоматическая инициализация: cloud → лицензия → автовход
        // Жёстко устанавливаем облачный URL при каждом запуске
        setApiUrl('https://smartpos-pro-production-f885.up.railway.app/api');
        setServerMode(SERVER_MODES.CLOUD);

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
                const isValid = await checkSavedLicense(savedLicense);
                if (!isValid) return; // Остановка если лицензия невалидна
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
        // ★ Никакого setInterval — проверка лицензии делается ТОЛЬКО:
        //   1) Один раз при старте (читаем из localStorage, если нужно — запрос к серверу)
        //   2) Когда пользователь вручную нажимает кнопку «Активировать»
    }, []);

    // ─── Загрузка лицензии при старте (ТОЛЬКО из localStorage — без запроса к серверу) ───
    // Вызывается автоматически 1 раз при монтировании компонента.
    // Сетевой запрос НЕ делается — используем данные, сохранённые при предыдущей активации.
    const checkSavedLicense = async (key) => {
        setError('');
        try {
            // Сначала читаем сохранённые данные с компьютера клиента
            const savedInfo = localStorage.getItem('license_info');
            if (savedInfo) {
                const info = JSON.parse(savedInfo);
                setLicenseInfo(info);
                setLicenseValid(true);
                setMode('login');
                // Восстанавливаем URL сервера из сохранённых данных
                if (info.server_url) {
                    const savedServerUrl = localStorage.getItem('server_url');
                    if (!savedServerUrl) {
                        setApiUrl(info.server_url);
                        setServerUrl(info.server_url);
                    }
                }
                return true;
            }

            // Кеша нет — делаем запрос к серверу (единственный раз при первом запуске)
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
                // Сохраняем на компьютере клиента — при следующем запуске читаем отсюда
                localStorage.setItem('license_info', JSON.stringify(data.license));
                if (data.license.server_url) {
                    const savedServerUrl = localStorage.getItem('server_url');
                    if (!savedServerUrl) {
                        setApiUrl(data.license.server_url);
                        setServerUrl(data.license.server_url);
                    }
                }
                return true;
            } else if (response.status === 403 && data.error &&
                (data.error.includes('истекла') || data.error.includes('revoked'))) {
                // Лицензия явно отозвана — удаляем с компьютера клиента
                setLicenseValid(false);
                setMode('license');
                localStorage.removeItem('license_key');
                localStorage.removeItem('license_info');
                return false;
            } else {
                setLicenseValid(false);
                setMode('license');
                setError(data.error || 'Не удалось проверить лицензию');
                return false;
            }
        } catch (err) {
            // Сеть недоступна — работаем офлайн с данными из localStorage
            console.warn('[License] Offline mode — using cached data:', err.message);
            const savedInfo = localStorage.getItem('license_info');
            if (savedInfo) {
                setLicenseInfo(JSON.parse(savedInfo));
                setLicenseValid(true);
                setMode('login');
                return true;
            } else {
                setLicenseValid(false);
                setMode('license');
                return false;
            }
        } finally {
            setLicenseChecking(false);
        }
    };

    // ─── Активация лицензии ────────────────────────────────────────────────────
    // Вызывается ТОЛЬКО при нажатии кнопки «Активировать».
    // После успешной активации данные сохраняются в localStorage на компьютере клиента.
    // При следующем запуске приложения данные читаются из localStorage — без запроса к серверу.
    const validateLicense = async () => {
        if (!licenseKey.trim()) {
            setError('Введите лицензионный ключ');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const licenseUrl = await getLicenseServerUrl();
            const response = await fetch(`${licenseUrl}/license/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: licenseKey })
            });

            const data = await response.json();

            if (data.valid) {
                setLicenseInfo(data.license);
                setLicenseValid(true);

                // ★ Сохраняем данные на компьютере клиента (localStorage)
                localStorage.setItem('license_key', licenseKey.trim());
                localStorage.setItem('license_info', JSON.stringify(data.license));
                // Сохраняем URL сервера из лицензии
                if (data.license.server_url) {
                    localStorage.setItem('server_url', data.license.server_url);
                    setApiUrl(data.license.server_url);
                    setServerUrl(data.license.server_url);
                } else if (serverUrl) {
                    localStorage.setItem('server_url', serverUrl);
                }

                setSuccess('✅ Лицензия активирована! Данные сохранены на этом компьютере.');
                setTimeout(() => { setSuccess(''); setMode('login'); }, 3000);
            } else {
                setError(data.error || 'Лицензия недействительна');
            }
        } catch (err) {
            console.error('[License] Validation error:', err);
            setError('Ошибка подключения. Проверьте интернет-соединение.');
        } finally {
            setLoading(false);
        }
    };

    // Вход в систему
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        setError('');
        if (!serverConnected) {
            setError('Нет подключения к серверу. Проверьте настройки.');
            return;
        }
        if (!licenseValid && !isMobile) {
            setError('Сначала активируйте лицензию');
            setMode('license');
            return;
        }
        
        setLoading(true);

        try {
            // ★ Передаём license_key для проверки принадлежности на сервере
            const savedLicenseKey = localStorage.getItem('license_key');
            const loginPayload = { 
                ...credentials,
                ...(savedLicenseKey ? { license_key: savedLicenseKey } : {})
            };
            
            console.log('[Login] Attempting login for:', credentials.username);
            const response = await authAPI.login(loginPayload);
            
            if (response.data && response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));

                // Обновить информацию о лицензии из ответа сервера
                // ВАЖНО: всегда обновляем, чтобы не осталось устаревших данных
                if (response.data.license) {
                    localStorage.setItem('license_info', JSON.stringify(response.data.license));
                } else {
                    // Сервер не вернул лицензию — очищаем старую, чтобы checkLicense пропустил локальную проверку
                    // (checkLicense без licenseInfo.id не будет проверять expiry)
                    localStorage.removeItem('license_info');
                }

                // Сохранить имя пользователя для удобства
                if (rememberMe) {
                    localStorage.setItem('saved_username', credentials.username);
                    localStorage.setItem('remember_me', 'true');
                } else {
                    localStorage.removeItem('saved_username');
                    localStorage.setItem('remember_me', 'false');
                }
                
                localStorage.removeItem('saved_password');
                setSuccess('Успешный вход!');
                onLogin();
            }
        } catch (err) {
            console.error('[Login] Error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Ошибка входа';
            
            if (errorMsg.includes('jwt expired')) {
                setError('Сессия истекла. Пожалуйста, введите пароль заново.');
                localStorage.removeItem('token');
            } else if (err.message === 'Network Error') {
                setError('Сервер недоступен (ошибка сети). Проверьте адрес в настройках.');
            } else {
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // Сохранить настройки сервера
    const saveServerSettings = async () => {
        setServerMode(srvMode);
        
        if (srvMode === SERVER_MODES.OWN) {
            // Свой сервер: используем введённый адрес (или дефолтный localhost)
            const url = serverUrl || 'http://127.0.0.1:5000/api';
            setApiUrl(url);
        } else if (srvMode === SERVER_MODES.CLOUD) {
            // Облако: используем введённый облачный URL
            setCloudUrl(cloudUrl);
            setApiUrl(cloudUrl);
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
                    <p>{mode === 'license' ? 'Активация лицензии' : 'Войдите в систему'}</p>
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
