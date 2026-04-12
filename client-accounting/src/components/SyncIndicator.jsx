/**
 * SyncIndicator - Индикатор статуса синхронизации
 * Показывает online/offline статус и количество pending изменений
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import {
    getSyncStatus,
    addSyncListener,
    manualSync,
    startAutoSync
} from '../services/syncService';
import { getPendingCount } from '../services/localStorageService';

const SyncIndicator = () => {
    const [status, setStatus] = useState({
        isOnline: false,
        isSyncing: false,
        pendingCount: 0
    });
    const [lastEvent, setLastEvent] = useState(null);

    useEffect(() => {
        // Запускаем автосинхронизацию
        startAutoSync();

        // Начальное состояние
        setStatus(getSyncStatus());

        // Подписываемся на события
        const unsubscribe = addSyncListener((event) => {
            setLastEvent(event);
            setStatus(getSyncStatus());

            // Скрыть событие через 3 секунды
            setTimeout(() => setLastEvent(null), 3000);
        });

        // Периодически обновляем pending count
        const interval = setInterval(() => {
            setStatus(prev => ({
                ...prev,
                pendingCount: getPendingCount()
            }));
        }, 5000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const handleManualSync = async () => {
        const result = await manualSync();
        console.log('[SyncIndicator] Manual sync result:', result);
    };

    const getStatusIcon = () => {
        if (status.isSyncing) {
            return <RefreshCw className="sync-icon spinning" size={16} />;
        }
        if (status.isOnline) {
            return <Wifi className="sync-icon online" size={16} />;
        }
        return <WifiOff className="sync-icon offline" size={16} />;
    };

    const getStatusText = () => {
        if (status.isSyncing) return 'Синхронизация...';
        if (status.isOnline) return 'Онлайн';
        return 'Офлайн';
    };

    const getEventMessage = () => {
        if (!lastEvent) return null;
        switch (lastEvent.type) {
            case 'online':
                return { text: 'Связь восстановлена!', icon: <Check size={14} />, type: 'success' };
            case 'offline':
                return { text: 'Нет связи с сервером', icon: <AlertTriangle size={14} />, type: 'warning' };
            case 'syncComplete':
                return {
                    text: `Синхронизировано: ${lastEvent.synced}`,
                    icon: <Check size={14} />,
                    type: 'success'
                };
            default:
                return null;
        }
    };

    const eventMessage = getEventMessage();

    return (
        <div className="sync-indicator">
            <div
                className={`sync-status ${status.isOnline ? 'online' : 'offline'}`}
                onClick={handleManualSync}
                title="Нажмите для синхронизации"
            >
                {getStatusIcon()}
                <span className="sync-text">{getStatusText()}</span>
                {status.pendingCount > 0 && (
                    <span className="pending-badge">{status.pendingCount}</span>
                )}
            </div>

            {eventMessage && (
                <div className={`sync-message ${eventMessage.type}`}>
                    {eventMessage.icon}
                    <span>{eventMessage.text}</span>
                </div>
            )}

            <style>{`
                .sync-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .sync-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 13px;
                }
                
                .sync-status.online {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                }
                
                .sync-status.offline {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }
                
                .sync-status:hover {
                    transform: scale(1.02);
                }
                
                .sync-icon.spinning {
                    animation: spin 1s linear infinite;
                }
                
                .sync-icon.online {
                    color: #10b981;
                }
                
                .sync-icon.offline {
                    color: #ef4444;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .pending-badge {
                    background: #f59e0b;
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 10px;
                    min-width: 18px;
                    text-align: center;
                }
                
                .sync-message {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    animation: fadeIn 0.3s ease;
                }
                
                .sync-message.success {
                    background: rgba(16, 185, 129, 0.1);
                    color: #10b981;
                }
                
                .sync-message.warning {
                    background: rgba(245, 158, 11, 0.1);
                    color: #f59e0b;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default SyncIndicator;
