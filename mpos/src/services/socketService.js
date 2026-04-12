import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/settings';

/**
 * Real-time WebSocket сервис для мобильного приложения
 * Использует нативный WebSocket (встроен в React Native) вместо socket.io-client
 * Совместим с Socket.IO сервером через WebSocket транспорт
 */
class SocketService {
    static ws = null;
    static isConnected = false;
    static listeners = {};
    static reconnectTimer = null;
    static reconnectAttempts = 0;
    static maxReconnectAttempts = 10;
    static shouldReconnect = false;
    static serverUrl = null;

    /**
     * Подключиться к серверу
     */
    static connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        
        this.shouldReconnect = true;
        this._doConnect();
    }

    static _doConnect() {
        try {
            const apiUrl = getApiUrl() || 'http://localhost:5000/api';
            // Преобразуем http → ws, убираем /api суффикс
            const baseUrl = apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');
            this.serverUrl = `${baseUrl}/socket.io/?EIO=4&transport=websocket`;

            console.log('[Socket] Connecting to:', this.serverUrl);
            
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('[Socket] Connected');
                this._notify('connect', { connected: true });

                // Отправить регистрацию устройства
                AsyncStorage.getItem('device_id').then(deviceId => {
                    if (deviceId) {
                        this._send('register:device', { device_id: deviceId });
                    }
                }).catch(() => {});
            };

            this.ws.onmessage = (event) => {
                try {
                    const raw = event.data;
                    // Socket.IO encodes messages with a numeric prefix
                    // e.g. "42[\"product:updated\",{...}]"
                    if (typeof raw === 'string' && raw.startsWith('42')) {
                        const payload = JSON.parse(raw.slice(2));
                        const [eventName, data] = payload;
                        this._notify(eventName, data);
                    }
                } catch (e) { /* ignore parse errors */ }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                console.log('[Socket] Disconnected');
                this._notify('disconnect', {});
                this._scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.log('[Socket] Error (non-critical):', error?.message || 'connection error');
            };

        } catch (e) {
            console.log('[Socket] Connect error:', e.message);
            this._scheduleReconnect();
        }
    }

    static _send(event, data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(`42${JSON.stringify([event, data])}`);
            } catch (e) { /* ignore */ }
        }
    }

    static _scheduleReconnect() {
        if (!this.shouldReconnect) return;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[Socket] Max reconnect attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(2000 * this.reconnectAttempts, 30000);
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this._doConnect(), delay);
    }

    /**
     * Отключиться
     */
    static disconnect() {
        this.shouldReconnect = false;
        clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    /**
     * Подписаться на событие
     */
    static subscribe(event, key, callback) {
        if (!this.listeners[event]) this.listeners[event] = {};
        this.listeners[event][key] = callback;
    }

    /**
     * Отписаться от события
     */
    static unsubscribe(event, key) {
        if (this.listeners[event]) {
            delete this.listeners[event][key];
        }
    }

    static _notify(event, data) {
        const callbacks = this.listeners[event] || {};
        Object.values(callbacks).forEach(cb => {
            try { cb(data); } catch (e) { /* ignore */ }
        });
    }

    static getStatus() {
        return {
            connected: this.isConnected,
            socketId: null,
        };
    }
}

export default SocketService;
