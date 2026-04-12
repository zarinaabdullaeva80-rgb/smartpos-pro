import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Smartphone, SendHorizonal, Settings, Plus, Check, X, Clock, Edit3, Trash2, Save, TestTube, Eye } from 'lucide-react';
import { notificationsAPI, usersAPI, settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function Notifications() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({});
    const [templates, setTemplates] = useState([]);
    const [recentNotifications, setRecentNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [templateModal, setTemplateModal] = useState(null);
    const [message, setMessage] = useState(null);
    const [sending, setSending] = useState(false);
    const [targetUser, setTargetUser] = useState('');
    const [users, setUsers] = useState([]);
    const [broadcastMessage, setBroadcastMessage] = useState({ title: '', message: '' });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await usersAPI.getAll();
                const data = res.data || res;
                setUsers(Array.isArray(data) ? data : data.users || []);
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        fetchUsers();
    }, []);

    const sendTargetedNotification = async () => {
        if (!broadcastMessage.title || !broadcastMessage.message) {
            showMessage('error', 'Заполните заголовок и сообщение');
            return;
        }
        setSending(true);
        try {
            await notificationsAPI.send({
                userId: targetUser || null,
                sendToAll: !targetUser,
                title: broadcastMessage.title,
                message: broadcastMessage.message,
                type: 'info'
            });
            showMessage('success', 'Уведомление отправлено!');
            setBroadcastMessage({ title: '', message: '' });
            setTargetUser('');
        } catch (error) {
            showMessage('error', 'Ошибка: ' + (error.message || 'Неизвестная ошибка'));
        } finally {
            setSending(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsRes, historyRes] = await Promise.all([
                notificationsAPI.getSettings().then(r => r.data || r),
                notificationsAPI.getHistory({ limit: 20 }).then(r => r.data || r)
            ]);

            const s = settingsRes.settings || settingsRes || {};
            setSettings({
                push_enabled: s.push_enabled !== false,
                telegram_enabled: s.telegram_enabled || false,
                email_enabled: s.email_enabled || false,
                sms_enabled: s.sms_enabled || false,
                low_stock_alert: s.low_stock_alert !== false,
                low_stock_threshold: s.low_stock_threshold || 10,
                new_order_alert: s.new_order_alert !== false,
                large_sale_alert: s.large_sale_alert !== false,
                large_sale_threshold: s.large_sale_threshold || 5000000,
                shift_end_reminder: s.shift_end_reminder !== false,
                backup_reminder: s.backup_reminder !== false,
                expiry_alert: s.expiry_alert !== false,
                expiry_days_before: s.expiry_days_before || 30
            });

            setTemplates(s.templates || []);

            const notifs = historyRes.notifications || historyRes || [];
            setRecentNotifications(notifs.map(n => ({
                id: n.id,
                type: n.type || 'info',
                message: n.message || n.title || '',
                time: n.created_at ? new Date(n.created_at).toLocaleString('ru') : '',
                read: n.read || n.is_read || false
            })));
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
            setSettings({
                push_enabled: true, telegram_enabled: false, email_enabled: false, sms_enabled: false,
                low_stock_alert: true, low_stock_threshold: 10, new_order_alert: true,
                large_sale_alert: true, large_sale_threshold: 5000000
            });
            setTemplates([]);
            setRecentNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const getChannelIcon = (channel) => {
        const icons = {
            push: <Bell size={16} />,
            telegram: <SendHorizonal size={16} />,
            email: <Mail size={16} />,
            sms: <Smartphone size={16} />
        };
        return icons[channel] || icons.push;
    };

    const getChannelColor = (channel) => {
        const colors = {
            push: '#ef4444',
            telegram: '#0088cc',
            email: '#10b981',
            sms: '#f59e0b'
        };
        return colors[channel] || '#888';
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleAddTemplate = () => {
        setTemplateModal({
            mode: 'create',
            data: { title: '', event: '', channel: 'push', enabled: true, message: '' }
        });
    };

    const handleEditTemplate = (tpl) => {
        setTemplateModal({
            mode: 'edit',
            data: { ...tpl }
        });
    };

    const handleToggleTemplate = (id) => {
        setTemplates(templates.map(t =>
            t.id === id ? { ...t, enabled: !t.enabled } : t
        ));
        const tpl = templates.find(t => t.id === id);
        showMessage('success', `Шаблон "${tpl.title}" ${!tpl.enabled ? 'включен' : 'отключен'}`);
    };

    const handleDeleteTemplate = (id) => {
        const tpl = templates.find(t => t.id === id);
        if (confirm(`Удалить шаблон "${tpl.title}"?`)) {
            setTemplates(templates.filter(t => t.id !== id));
            showMessage('success', 'Шаблон удалён');
        }
    };

    const handleSaveTemplate = () => {
        if (!templateModal.data.title) {
            showMessage('error', 'Введите название шаблона');
            return;
        }

        if (templateModal.mode === 'create') {
            const newTemplate = {
                ...templateModal.data,
                id: Date.now()
            };
            setTemplates([...templates, newTemplate]);
            showMessage('success', 'Шаблон создан');
        } else {
            setTemplates(templates.map(t =>
                t.id === templateModal.data.id ? templateModal.data : t
            ));
            showMessage('success', 'Шаблон обновлён');
        }
        setTemplateModal(null);
    };

    const handleTestNotification = (tpl) => {
        showMessage('success', `Тестовое уведомление "${tpl.title}" отправлено!`);
    };

    const markAsRead = async (id) => {
        try {
            await notificationsAPI.markRead(id);
            setRecentNotifications(recentNotifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
        } catch (error) {
            console.error('Ошибка пометки уведомления:', error);
            setRecentNotifications(recentNotifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
        }
    };

    return (
        <div className="notifications-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('notifications.uvedomleniya', '🔔 Уведомления')}</h1>
                    <p className="text-muted">{t('notifications.nastroyka_i_uv', 'Настройка Push, Telegram, Email и SMS уведомлений')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddTemplate}>
                    <Plus size={18} /> Добавить шаблон
                </button>
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                        message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' :
                        message.type === 'error' ? 'var(--color-danger)' : 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Check size={18} /> {message.text}
                </div>
            )}

            {/* Каналы */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${settings.push_enabled ? '#ef4444' : '#ccc'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <Bell size={28} color={settings.push_enabled ? '#ef4444' : '#ccc'} />
                        <div
                            onClick={() => setSettings({ ...settings, push_enabled: !settings.push_enabled })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px',
                                backgroundColor: settings.push_enabled ? '#ef4444' : 'rgba(100,100,100,0.3)',
                                cursor: 'pointer', position: 'relative', transition: 'all 0.3s'
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                                position: 'absolute', top: '2px', left: settings.push_enabled ? '22px' : '2px',
                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{t('notifications.uvedomleniya', 'Push-уведомления')}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{t('notifications.brauzernye_uvedomleniya', 'Браузерные уведомления')}</div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${settings.telegram_enabled ? '#0088cc' : '#ccc'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <SendHorizonal size={28} color={settings.telegram_enabled ? '#0088cc' : '#ccc'} />
                        <div
                            onClick={() => setSettings({ ...settings, telegram_enabled: !settings.telegram_enabled })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px',
                                backgroundColor: settings.telegram_enabled ? '#0088cc' : 'rgba(100,100,100,0.3)',
                                cursor: 'pointer', position: 'relative', transition: 'all 0.3s'
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                                position: 'absolute', top: '2px', left: settings.telegram_enabled ? '22px' : '2px',
                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>Telegram</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{t('notifications.mgnovennye_soobscheniya', 'Мгновенные сообщения')}</div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${settings.email_enabled ? '#10b981' : '#ccc'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <Mail size={28} color={settings.email_enabled ? '#10b981' : '#ccc'} />
                        <div
                            onClick={() => setSettings({ ...settings, email_enabled: !settings.email_enabled })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px',
                                backgroundColor: settings.email_enabled ? '#10b981' : 'rgba(100,100,100,0.3)',
                                cursor: 'pointer', position: 'relative', transition: 'all 0.3s'
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                                position: 'absolute', top: '2px', left: settings.email_enabled ? '22px' : '2px',
                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>Email</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{t('notifications.podrobnye_otchyoty', 'Подробные отчёты')}</div>
                </div>

                <div className="card" style={{ padding: '20px', borderLeft: `4px solid ${settings.sms_enabled ? '#f59e0b' : '#ccc'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <Smartphone size={28} color={settings.sms_enabled ? '#f59e0b' : '#ccc'} />
                        <div
                            onClick={() => setSettings({ ...settings, sms_enabled: !settings.sms_enabled })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px',
                                backgroundColor: settings.sms_enabled ? '#f59e0b' : 'rgba(100,100,100,0.3)',
                                cursor: 'pointer', position: 'relative', transition: 'all 0.3s'
                            }}
                        >
                            <div style={{
                                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                                position: 'absolute', top: '2px', left: settings.sms_enabled ? '22px' : '2px',
                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                        </div>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>SMS</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{t('notifications.kritichnye_alerty', 'Критичные алерты')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* События */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('notifications.shablony_uvedomleniy', '📋 Шаблоны уведомлений')}</h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('notifications.sobytie', 'Событие')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('notifications.kanal', 'Канал')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('notifications.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('notifications.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {templates.map(tpl => (
                                <tr key={tpl.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>{tpl.title}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: `${getChannelColor(tpl.channel)}20`,
                                            color: getChannelColor(tpl.channel),
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '13px'
                                        }}>
                                            {getChannelIcon(tpl.channel)}
                                            {tpl.channel.charAt(0).toUpperCase() + tpl.channel.slice(1)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div
                                            onClick={() => handleToggleTemplate(tpl.id)}
                                            style={{
                                                display: 'inline-block', width: '40px', height: '22px', borderRadius: '11px',
                                                backgroundColor: tpl.enabled ? 'var(--color-success)' : 'rgba(100,100,100,0.3)',
                                                cursor: 'pointer', position: 'relative', transition: 'all 0.3s'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
                                                position: 'absolute', top: '2px', left: tpl.enabled ? '20px' : '2px',
                                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleTestNotification(tpl)}
                                                title={t('notifications.test', 'Тест')}
                                            >
                                                <SendHorizonal size={14} />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleEditTemplate(tpl)}
                                                title={t('notifications.redaktirovat', 'Редактировать')}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeleteTemplate(tpl.id)}
                                                title={t('notifications.udalit', 'Удалить')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card" style={{ marginBottom: '16px' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('notifications.otpravit_soobschenie', '✍️ Отправить сообщение')}</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>{t('notifications.poluchatel', 'Получатель')}</label>
                            <select
                                className="form-input"
                                value={targetUser}
                                onChange={e => setTargetUser(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            >
                                <option value="">{t('notifications.vsem_prodavtsam', 'Всем продавцам')}</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>{t('notifications.zagolovok', 'Заголовок')}</label>
                            <input
                                type="text"
                                className="form-input"
                                value={broadcastMessage.title}
                                onChange={e => setBroadcastMessage({ ...broadcastMessage, title: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                placeholder="Срочное объявление"
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>{t('notifications.tekst', 'Текст')}</label>
                            <textarea
                                className="form-input"
                                value={broadcastMessage.message}
                                onChange={e => setBroadcastMessage({ ...broadcastMessage, message: e.target.value })}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', minHeight: '80px' }}
                                placeholder="Текст вашего сообщения..."
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={sendTargetedNotification}
                            disabled={sending}
                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            <SendHorizonal size={18} /> {sending ? 'Отправка...' : 'Отправить'}
                        </button>
                    </div>
                </div>

                {/* Последние уведомления */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('notifications.nedavnie', '🕐 Недавние')}</h3>
                    </div>
                    {recentNotifications.map(notif => (
                        <div
                            key={notif.id}
                            style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                background: notif.read ? 'transparent' : 'var(--primary-light)',
                                cursor: !notif.read ? 'pointer' : 'default'
                            }}
                            onClick={() => !notif.read && markAsRead(notif.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 500, fontSize: '14px' }}>{notif.message}</span>
                                {!notif.read && <div style={{ width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888' }}>
                                <Clock size={12} /> {notif.time}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Template Modal */}
            {templateModal && (
                <div className="modal-overlay" onClick={() => setTemplateModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {templateModal.mode === 'create' ? '➕ Новый шаблон' : `✏️ Редактирование: ${templateModal.data.title}`}
                            </h2>
                            <button className="modal-close" onClick={() => setTemplateModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('notifications.nazvanie_shablona', 'Название шаблона *')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={templateModal.data.title}
                                    onChange={e => setTemplateModal({
                                        ...templateModal,
                                        data: { ...templateModal.data, title: e.target.value }
                                    })}
                                    placeholder="Например: Низкий остаток"
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.sobytie', 'Событие')}</label>
                                <select
                                    className="form-input"
                                    value={templateModal.data.event}
                                    onChange={e => setTemplateModal({
                                        ...templateModal,
                                        data: { ...templateModal.data, event: e.target.value }
                                    })}
                                >
                                    <option value="">{t('notifications.vyberite_sobytie', 'Выберите событие')}</option>
                                    <option value="low_stock">{t('notifications.malo_na_sklade', 'Мало на складе')}</option>
                                    <option value="new_order">{t('notifications.novyy_zakaz', 'Новый заказ')}</option>
                                    <option value="large_sale">{t('notifications.krupnaya_prodazha', 'Крупная продажа')}</option>
                                    <option value="shift_end">{t('notifications.konets_smeny', 'Конец смены')}</option>
                                    <option value="backup_done">{t('notifications.bekap_zavershyon', 'Бэкап завершён')}</option>
                                    <option value="expiry_soon">{t('notifications.srok_godnosti', 'Срок годности')}</option>
                                    <option value="custom">{t('notifications.polzovatelskoe', 'Пользовательское')}</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.kanal_uvedomleniya', 'Канал уведомления')}</label>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    {['push', 'telegram', 'email', 'sms'].map(ch => (
                                        <button
                                            key={ch}
                                            className={`btn ${templateModal.data.channel === ch ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setTemplateModal({
                                                ...templateModal,
                                                data: { ...templateModal.data, channel: ch }
                                            })}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {getChannelIcon(ch)}
                                            {ch.charAt(0).toUpperCase() + ch.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.tekst_soobscheniya', 'Текст сообщения')}</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={templateModal.data.message || ''}
                                    onChange={e => setTemplateModal({
                                        ...templateModal,
                                        data: { ...templateModal.data, message: e.target.value }
                                    })}
                                    placeholder="Используйте переменные: {product}, {quantity}, {amount}"
                                />
                                <small style={{ color: 'var(--color-text-muted)' }}>
                                    Переменные: {'{product}'}, {'{quantity}'}, {'{amount}'}, {'{order_id}'}
                                </small>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={templateModal.data.enabled}
                                        onChange={e => setTemplateModal({
                                            ...templateModal,
                                            data: { ...templateModal.data, enabled: e.target.checked }
                                        })}
                                    />
                                    Активен
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setTemplateModal(null)}>
                                Отмена
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveTemplate}>
                                <Save size={16} /> {templateModal.mode === 'create' ? 'Создать' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Notifications;
