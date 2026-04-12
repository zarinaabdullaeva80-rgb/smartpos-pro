import React, { useState, useEffect } from 'react';
import { Bell, Send, Plus, Search, Filter, Check, Clock, Users, Target, Smartphone } from 'lucide-react';
import { notificationsAPI } from '../services/api';
import { useI18n } from '../i18n';

function PushNotifications() {
    const { t } = useI18n();
    const [notifications, setNotifications] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await notificationsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setNotifications(apiData.notifications || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('PushNotifications: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            sent: { label: 'Отправлено', color: '#10b981', bg: '#dcfce7' },
            scheduled: { label: 'Запланировано', color: '#3b82f6', bg: '#dbeafe' },
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6' }
        };
        return statuses[status] || statuses.draft;
    };

    const getTargetLabel = (target) => {
        const targets = {
            all: '👥 Все пользователи',
            segment: '🎯 Сегмент',
            birthday: '🎂 День рождения',
            abandoned: '🛒 Брошенные корзины'
        };
        return targets[target] || target;
    };

    const [message, setMessage] = useState(null);
    const handleNewNotification = () => setMessage({ type: 'info', text: 'Создание нового push-уведомления...' });

    return (
        <div className="push-notifications-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('pushnotifications.uvedomleniya', '🔔 Push-уведомления')}</h1>
                    <p className="text-muted">{t('pushnotifications.otpravka_uvedomleniy_na_ustroystva_klien', 'Отправка уведомлений на устройства клиентов')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewNotification}>
                    <Plus size={18} /> Новое уведомление
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Send size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_sent}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Отправлено</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.delivered_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('pushnotifications.dostavleno', 'Доставлено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Bell size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.open_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('pushnotifications.otkryto', 'Открыто')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Smartphone size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.subscribers}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('pushnotifications.podpischikov', 'Подписчиков')}</div>
                </div>
            </div>

            {/* Список уведомлений */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('pushnotifications.istoriya_uvedomleniy', '📋 История уведомлений')}</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '250px' }} />
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('pushnotifications.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px', padding: '16px' }}>
                        {notifications.map(notif => {
                            const statusInfo = getStatusInfo(notif.status);

                            return (
                                <div key={notif.id} style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '20px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px' }}>{notif.title}</h4>
                                            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{notif.body}</p>
                                        </div>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}>
                                            {statusInfo.label}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', color: '#888' }}>
                                            {getTargetLabel(notif.target)}
                                        </span>

                                        {notif.status === 'sent' ? (
                                            <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                                                <span>📤 {notif.sent}</span>
                                                <span style={{ color: '#10b981' }}>✓ {notif.delivered}</span>
                                                <span style={{ color: '#3b82f6' }}>👁 {notif.opened}</span>
                                                <span style={{ color: '#888' }}>{notif.sent_at}</span>
                                            </div>
                                        ) : (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#3b82f6' }}>
                                                <Clock size={14} /> {notif.scheduled_at}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PushNotifications;
