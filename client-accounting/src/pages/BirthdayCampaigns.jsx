import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Users, Mail, MessageSquare, Send, Clock, Check, X } from 'lucide-react';
import { crmAPI } from '../services/api';
import { useI18n } from '../i18n';

function BirthdayCampaigns() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({});
    const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
    const [sentMessages, setSentMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await crmAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSettings(apiData.settings || {});
            setUpcomingBirthdays(apiData.upcomingBirthdays || []);
            setSentMessages(apiData.sentMessages || []);
        } catch (err) {
            console.warn('BirthdayCampaigns: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const stats = {
        upcoming: upcomingBirthdays.length,
        sent_month: sentMessages.length,
        conversion: 65
    };

    return (
        <div className="birthday-campaigns-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('birthdaycampaigns.dr_kampanii', '🎂 ДР-кампании')}</h1>
                    <p className="text-muted">{t('birthdaycampaigns.avtomaticheskie_pozdravleniya_i_skidki_ko', 'Автоматические поздравления и скидки ко Дню Рождения')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Calendar size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.upcoming}</div>
                    <div style={{ color: '#666' }}>{t('birthdaycampaigns.dr_na_etoy_nedele', 'ДР на этой неделе')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Send size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.sent_month}</div>
                    <div style={{ color: '#666' }}>{t('birthdaycampaigns.otpravleno_v_yanvare', 'Отправлено в январе')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Gift size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{settings.discount_percent}%</div>
                    <div style={{ color: '#666' }}>{t('birthdaycampaigns.skidka_na_dr', 'Скидка на ДР')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.conversion}%</div>
                    <div style={{ color: '#666' }}>{t('birthdaycampaigns.ispolzovali_skidku', 'Использовали скидку')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
                {/* Настройки и ближайшие ДР */}
                <div>
                    {/* Настройки */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>{t('birthdaycampaigns.nastroyki_kampanii', '⚙️ Настройки кампании')}</h3>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
                                Активна
                            </label>
                        </div>
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('birthdaycampaigns.uvedomlyat_za', 'Уведомлять за')}</label>
                                    <select value={settings.days_before} onChange={(e) => setSettings({ ...settings, days_before: parseInt(e.target.value) })}>
                                        <option value="1">{t('birthdaycampaigns.den', '1 день')}</option>
                                        <option value="3">{t('birthdaycampaigns.dnya', '3 дня')}</option>
                                        <option value="7">{t('birthdaycampaigns.dney', '7 дней')}</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('birthdaycampaigns.skidka', 'Скидка')}</label>
                                    <input type="number" value={settings.discount_percent} onChange={(e) => setSettings({ ...settings, discount_percent: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('birthdaycampaigns.bonusnye_bally', 'Бонусные баллы')}</label>
                                    <input type="number" value={settings.bonus_points} onChange={(e) => setSettings({ ...settings, bonus_points: parseInt(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>{t('birthdaycampaigns.shablon_soobscheniya', 'Шаблон сообщения')}</label>
                                <textarea value={settings.message_template} onChange={(e) => setSettings({ ...settings, message_template: e.target.value })} rows={3} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>{t('birthdaycampaigns.otpravlyat_cherez', 'Отправлять через')}</label>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.send_via?.includes('sms')} onChange={(e) => {
                                            const newVia = e.target.checked
                                                ? [...(settings.send_via || []), 'sms']
                                                : (settings.send_via || []).filter(v => v !== 'sms');
                                            setSettings({ ...settings, send_via: newVia });
                                        }} />
                                        📱 SMS
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.send_via?.includes('telegram')} onChange={(e) => {
                                            const newVia = e.target.checked
                                                ? [...(settings.send_via || []), 'telegram']
                                                : (settings.send_via || []).filter(v => v !== 'telegram');
                                            setSettings({ ...settings, send_via: newVia });
                                        }} />
                                        ✈️ Telegram
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={settings.send_via?.includes('email')} onChange={(e) => {
                                            const newVia = e.target.checked
                                                ? [...(settings.send_via || []), 'email']
                                                : (settings.send_via || []).filter(v => v !== 'email');
                                            setSettings({ ...settings, send_via: newVia });
                                        }} />
                                        📧 Email
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* История отправок */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('birthdaycampaigns.istoriya_otpravok', '📤 История отправок')}</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('birthdaycampaigns.klient', 'Клиент')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('birthdaycampaigns.data', 'Дата')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('birthdaycampaigns.kanal', 'Канал')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('birthdaycampaigns.status', 'Статус')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('birthdaycampaigns.ispolzovano', 'Использовано')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sentMessages.map(msg => (
                                    <tr key={msg.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{msg.customer}</td>
                                        <td style={{ padding: '12px' }}>{formatDate(msg.sent_at)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                background: msg.via === 'Telegram' ? '#dbeafe' : '#fef3c7',
                                                color: msg.via === 'Telegram' ? '#1d4ed8' : '#d97706',
                                                fontSize: '12px'
                                            }}>
                                                {msg.via}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {msg.status === 'delivered' ? (
                                                <Check size={18} color="#10b981" />
                                            ) : (
                                                <X size={18} color="#ef4444" />
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {msg.used ? (
                                                <span style={{ color: '#10b981' }}>{t('birthdaycampaigns.da', '✅ Да')}</span>
                                            ) : (
                                                <span style={{ color: '#888' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Ближайшие ДР */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('birthdaycampaigns.blizhayshie_dni_rozhdeniya', '🎈 Ближайшие Дни Рождения')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('birthdaycampaigns.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div>
                            {upcomingBirthdays.map(bday => (
                                <div key={bday.id} style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        width: '48px', height: '48px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '20px'
                                    }}>
                                        🎂
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{bday.name}</div>
                                        <div style={{ fontSize: '13px', color: '#888' }}>
                                            {formatDate(bday.birthday)} • {bday.phone}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            background: bday.days_until <= 3 ? '#fee2e2' : '#fef3c7',
                                            color: bday.days_until <= 3 ? '#dc2626' : '#d97706',
                                            fontSize: '13px',
                                            fontWeight: 'bold'
                                        }}>
                                            через {bday.days_until} дн.
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BirthdayCampaigns;
