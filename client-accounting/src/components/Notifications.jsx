import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Bell, Check, CheckCheck, Settings, X } from 'lucide-react';
import '../styles/Notifications.css';


function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const dropdownRef = useRef(null);

    useEffect(() => {
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 30000); // Обновлять каждые 30 сек

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadNotifications();
        }
    }, [isOpen]);

    useEffect(() => {
        if (showSettings) {
            loadSubscriptions();
        }
    }, [showSettings]);

    // Закрытие dropdown при клике вне его
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadUnreadCount = async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await api.get('/notifications', {
                params: { limit: 20 }
            });
            setNotifications(response.data.notifications);
            setUnreadCount(response.data.unreadCount);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    };

    const loadSubscriptions = async () => {
        try {
            const response = await api.get('/notifications/subscriptions');
            setSubscriptions(response.data);
        } catch (error) {
            console.error('Error loading subscriptions:', error);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await api.post(`/notifications/mark-read/${notificationId}`);
            await loadNotifications();
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/notifications/mark-all-read');
            await loadNotifications();
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleToggleSubscription = async (channel, category, currentState) => {
        try {
            await api.put('/notifications/subscriptions', {
                channel,
                category,
                isEnabled: !currentState
            });
            await loadSubscriptions();
        } catch (error) {
            console.error('Error toggling subscription:', error);
        }
    };

    const getNotificationIcon = (type) => {
        const icons = {
            info: '📘',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || '📌';
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'только что';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;
        return `${Math.floor(seconds / 86400)} д назад`;
    };

    return (
        <div className="notifications-container" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                className="notifications-bell"
                onClick={() => setIsOpen(!isOpen)}
                title="Уведомления"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notifications-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="notifications-dropdown">
                    <div className="notifications-header">
                        <h3>Уведомления</h3>
                        <div className="notifications-actions">
                            <button
                                className="btn-icon"
                                onClick={() => setShowSettings(!showSettings)}
                                title="Настройки"
                            >
                                <Settings size={18} />
                            </button>
                            {unreadCount > 0 && (
                                <button
                                    className="btn-icon"
                                    onClick={handleMarkAllAsRead}
                                    title="Отметить все как прочитанные"
                                >
                                    <CheckCheck size={18} />
                                </button>
                            )}
                            <button
                                className="btn-icon"
                                onClick={() => setIsOpen(false)}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {showSettings ? (
                        // Settings View
                        <div className="notifications-settings">
                            <h4>Настройки подписок</h4>
                            <div className="subscriptions-list">
                                {['sale', 'purchase', 'inventory', 'system', 'license'].map(category => (
                                    <div key={category} className="subscription-category">
                                        <h5>{getCategoryName(category)}</h5>
                                        {['email', 'push', 'telegram'].map(channel => {
                                            const sub = subscriptions.find(s => s.channel === channel && s.category === category);
                                            return (
                                                <label key={channel} className="subscription-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={sub?.is_enabled || false}
                                                        onChange={() => handleToggleSubscription(channel, category, sub?.is_enabled)}
                                                    />
                                                    <span>{getChannelName(channel)}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // Notifications List
                        <div className="notifications-list">
                            {notifications.length === 0 ? (
                                <div className="notifications-empty">
                                    <Bell size={48} opacity={0.3} />
                                    <p>Нет уведомлений</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                                        onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-title">{notification.title}</div>
                                            <div className="notification-message">{notification.message}</div>
                                            <div className="notification-meta">
                                                <span className="notification-time">{formatTimeAgo(notification.created_at)}</span>
                                                {!notification.is_read && (
                                                    <span className="notification-new">Новое</span>
                                                )}
                                            </div>
                                        </div>
                                        {notification.action_url && (
                                            <button className="notification-action-btn">
                                                Открыть
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function getCategoryName(category) {
    const names = {
        sale: 'Продажи',
        purchase: 'Закупки',
        inventory: 'Склад',
        system: 'Система',
        license: 'Лицензии'
    };
    return names[category] || category;
}

function getChannelName(channel) {
    const names = {
        email: 'Email',
        push: 'Push-уведомления',
        telegram: 'Telegram'
    };
    return names[channel] || channel;
}

export default Notifications;
