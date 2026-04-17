import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import {
    Server, Wifi, WifiOff, RefreshCw, Copy, CheckCircle,
    AlertCircle, Clock, Monitor, Smartphone, Globe, Cloud
} from 'lucide-react';
import { getServerMode, getApiUrl, SERVER_MODES, testServerConnection } from '../config/settings';
import '../styles/ServerStatus.css';

function ServerStatus() {
    const [serverInfo, setServerInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restarting, setRestarting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [healthData, setHealthData] = useState(null);
    const [connectedDevices, setConnectedDevices] = useState([]);

    const isElectron = !!window.electron?.getServerInfo;
    const serverMode = getServerMode();

    const fetchServerInfo = useCallback(async () => {
        try {
            if (serverMode === SERVER_MODES.SERVER && isElectron) {
                // Режим своего сервера
                const info = await window.electron.getServerInfo();
                setServerInfo(info);
            } else {
                // Режим WiFi клиента или облака — показываем удалённый сервер
                const apiUrl = getApiUrl();
                const baseUrl = apiUrl.replace('/api', '');
                let hostname = 'localhost';
                try { hostname = new URL(baseUrl).hostname; } catch (e) { }
                const result = await testServerConnection(apiUrl);
                setServerInfo({
                    status: result.ok ? 'running' : 'error',
                    port: 5000,
                    connectionUrl: baseUrl,
                    apiUrl: apiUrl,
                    primaryIP: hostname,
                    localIPs: [{ name: serverMode === SERVER_MODES.CLOUD ? 'Облако' : 'WiFi', address: hostname }],
                    hostname: hostname,
                    mode: serverMode,
                });
            }
        } catch (err) {
            console.error('Failed to get server info:', err);
        } finally {
            setLoading(false);
        }
    }, [isElectron, serverMode]);

    const fetchHealth = useCallback(async () => {
        try {
            const apiUrl = serverInfo?.apiUrl || localStorage.getItem('api_url') || 'http://localhost:5000/api';
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/health`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (response.ok) {
                const data = await response.json();
                setHealthData(data);
            }
        } catch (err) {
            // Server might not be responding
            setHealthData(null);
        }
    }, [serverInfo]);

    useEffect(() => {
        fetchServerInfo();
        const interval = setInterval(fetchServerInfo, 5000);
        return () => clearInterval(interval);
    }, [fetchServerInfo]);

    useEffect(() => {
        if (serverInfo?.status === 'running') {
            fetchHealth();
            const interval = setInterval(fetchHealth, 10000);
            return () => clearInterval(interval);
        }
    }, [serverInfo?.status, fetchHealth]);

    // Загрузка подключённых устройств
    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const apiUrl = getApiUrl();
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`${apiUrl}/sync-status/overview`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setConnectedDevices(data.devices || []);
                }
            } catch (e) { /* сервер может не поддерживать */ }
        };
        fetchDevices();
        const interval = setInterval(fetchDevices, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleRestart = async () => {
        if (!isElectron) return;
        setRestarting(true);
        try {
            await window.electron.restartServer();
            setTimeout(async () => {
                await fetchServerInfo();
                setRestarting(false);
            }, 3000);
        } catch (err) {
            setRestarting(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '—';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}ч ${m}м`;
        if (m > 0) return `${m}м ${s}с`;
        return `${s}с`;
    };

    if (loading) {
        return (
            <div className="server-status-card loading">
                <RefreshCw className="spin" size={20} />
                <span>Загрузка...</span>
            </div>
        );
    }

    const isOnline = serverInfo?.status === 'running' || healthData;
    const connectionUrl = serverInfo?.connectionUrl || getApiUrl().replace('/api', '');

    // Заголовок в зависимости от режима
    const getModeTitle = () => {
        if (serverMode === SERVER_MODES.CLIENT) return `Подключён к ${serverInfo?.primaryIP || 'WiFi'}`;
        if (serverMode === SERVER_MODES.CLOUD) return `Облачный сервер`;
        return 'Встроенный сервер';
    };

    const getModeIcon = () => {
        if (serverMode === SERVER_MODES.CLIENT) return <Wifi size={20} />;
        if (serverMode === SERVER_MODES.CLOUD) return <Cloud size={20} />;
        return <Server size={20} />;
    };

    return (
        <div className="server-status-container">
            {/* Main Status Card */}
            <div className={`server-status-card ${isOnline ? 'online' : 'offline'}`}>
                <div className="status-header">
                    <div className="status-indicator">
                        <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                        {getModeIcon()}
                        <h3>{getModeTitle()}</h3>
                    </div>
                    <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? 'Работает' : serverInfo?.status === 'error' ? 'Ошибка' : 'Остановлен'}
                    </span>
                </div>

                {serverInfo?.error && (
                    <div className="status-error">
                        <AlertCircle size={16} />
                        <span>{serverInfo.error}</span>
                    </div>
                )}

                <div className="status-details">
                    <div className="detail-item">
                        <Clock size={14} />
                        <span>Аптайм:</span>
                        <strong>{formatUptime(serverInfo?.uptime)}</strong>
                    </div>
                    <div className="detail-item">
                        <Globe size={14} />
                        <span>Порт:</span>
                        <strong>{serverInfo?.port || 5000}</strong>
                    </div>
                    <div className="detail-item">
                        <Monitor size={14} />
                        <span>Хост:</span>
                        <strong>{serverInfo?.hostname || '—'}</strong>
                    </div>
                    {healthData?.database && (
                        <div className="detail-item">
                            <CheckCircle size={14} className="text-green" />
                            <span>БД:</span>
                            <strong>Подключена</strong>
                        </div>
                    )}
                </div>

                {isElectron && serverMode === SERVER_MODES.SERVER && (
                    <button
                        className="restart-btn"
                        onClick={handleRestart}
                        disabled={restarting}
                    >
                        <RefreshCw size={16} className={restarting ? 'spin' : ''} />
                        {restarting ? 'Перезапуск...' : 'Перезапустить сервер'}
                    </button>
                )}

                {/* Подключённые устройства */}
                {connectedDevices.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Smartphone size={14} />
                            <span>Подключённые устройства ({connectedDevices.length})</span>
                        </div>
                        {connectedDevices.map((dev, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.4rem 0.6rem', borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: '0.25rem', fontSize: '0.8rem'
                            }}>
                                <span>{dev.device_name || dev.device_type || 'Устройство'}</span>
                                <span style={{ color: dev.is_online ? '#22c55e' : '#9ca3af' }}>
                                    {dev.is_online ? '• Онлайн' : 'Офлайн'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Connection Info Card */}
            <div className="server-connection-card">
                <div className="connection-header">
                    <Smartphone size={20} />
                    <h3>Подключение мобильного</h3>
                </div>

                <p className="connection-instruction">
                    При первом запуске мобильного приложения SmartPOS Pro
                    отсканируйте QR-код камерой, или введите адрес вручную:
                </p>

                <div className="connection-url-box">
                    <div className="url-display">
                        <Wifi size={16} />
                        <code>{connectionUrl}</code>
                    </div>
                    <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(connectionUrl)}
                        title="Скопировать"
                    >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                </div>

                <div className="qr-section">
                    <QRCode
                        value={connectionUrl}
                        size={160}
                        level="M"
                        includeMargin={true}
                        bgColor="#1e293b"
                        fgColor="#e2e8f0"
                    />
                    <span className="qr-label">📱 Сканируйте при первом запуске приложения</span>
                </div>

                {serverInfo?.localIPs?.length > 1 && (
                    <div className="alt-ips">
                        <span className="alt-label">Другие адреса в сети:</span>
                        {serverInfo.localIPs.slice(1).map((ip, i) => (
                            <div key={i} className="alt-ip" onClick={() => copyToClipboard(`http://${ip.address}:${serverInfo.port}`)}>
                                <code>{ip.address}:{serverInfo.port}</code>
                                <span className="alt-name">{ip.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="connection-steps">
                    <div className="step">
                        <div className="step-num">1</div>
                        <span>Убедитесь что телефон подключён к той же WiFi</span>
                    </div>
                    <div className="step">
                        <div className="step-num">2</div>
                        <span>Установите и откройте SmartPOS Pro на телефоне</span>
                    </div>
                    <div className="step">
                        <div className="step-num">3</div>
                        <span>Нажмите «📱 Сканировать QR-код» или введите адрес вручную</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ServerStatus;
