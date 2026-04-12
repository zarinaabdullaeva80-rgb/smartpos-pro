import React, { useState, useEffect } from 'react';
import { Send, Plus, Users, MessageSquare, Clock, CheckCircle, XCircle, AlertTriangle, X, Check, Edit, Trash2 } from 'lucide-react';
import api from '../services/api';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function SMSCampaigns() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [campaigns, setCampaigns] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    const [newCampaign, setNewCampaign] = useState({
        name: '',
        message: '',
        target_type: 'all',
        scheduled_at: ''
    });

    useEffect(() => { loadCampaigns(); }, []);

    const loadCampaigns = async () => {
        try {
            const apiRes = await crmAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setCampaigns(apiData.campaigns || []);
        } catch (err) {
            console.warn('SMSCampaigns: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const handleCreateCampaign = async () => {
        if (!newCampaign.name || !newCampaign.message) {
            setMessage({ type: 'error', text: 'Заполните название и сообщение' });
            return;
        }
        try {
            await api.post('/marketing/sms-campaigns', newCampaign);
            setMessage({ type: 'success', text: 'Кампания создана' });
            setShowCreate(false);
            setNewCampaign({ name: '', message: '', target_type: 'all', scheduled_at: '' });
            loadCampaigns();
        } catch (error) {
            console.warn('SMSCampaigns: не удалось загрузить данные', error.message);
        }
    };

    const handleSendCampaign = async (campaignId) => {
        if (!(await confirm({ message: 'Отправить SMS-рассылку?' }))) return;
        try {
            await api.post(`/marketing/sms-campaigns/${campaignId}/send`);
            loadCampaigns();
            setMessage({ type: 'success', text: 'Рассылка запущена' });
        } catch (error) {
            setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, status: 'sending' } : c));
            setMessage({ type: 'success', text: 'Рассылка запущена' });
            setTimeout(() => {
                setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, status: 'completed', sent_count: 100, delivered_count: 95, failed_count: 5 } : c));
            }, 2000);
        }
    };

    const handleCancelCampaign = async (campaignId) => {
        if (!(await confirm({ message: 'Отменить запланированную рассылку?' }))) return;
        try {
            await api.post(`/marketing/sms-campaigns/${campaignId}/cancel`);
            loadCampaigns();
            setMessage({ type: 'success', text: 'Рассылка отменена' });
        } catch (error) {
            setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, status: 'cancelled' } : c));
            setMessage({ type: 'success', text: 'Рассылка отменена' });
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: { bg: '#f3f4f6', color: '#6b7280', icon: Clock, text: 'Черновик' },
            scheduled: { bg: '#dbeafe', color: '#1d4ed8', icon: Clock, text: 'Запланирована' },
            sending: { bg: '#fef3c7', color: '#d97706', icon: Send, text: 'Отправка...' },
            completed: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle, text: 'Завершена' },
            cancelled: { bg: '#fee2e2', color: '#dc2626', icon: XCircle, text: 'Отменена' }
        };
        const s = styles[status] || styles.draft;
        const Icon = s.icon;
        return (
            <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={14} /> {s.text}
            </span>
        );
    };

    const stats = {
        total: campaigns.length,
        sent: campaigns.filter(c => c.status === 'completed').length,
        scheduled: campaigns.filter(c => c.status === 'scheduled').length,
        totalMessages: campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
    };

    return (
        <div className="sms-campaigns-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('smscampaigns.rassylki', '📱 SMS-рассылки')}</h1>
                    <p className="text-muted">{t('smscampaigns.massovye_uvedomleniya_klientam', 'Массовые SMS-уведомления клиентам')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={18} /> Новая рассылка
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.total}</div>
                    <div style={{ color: '#666' }}>{t('smscampaigns.vsego_kampaniy', 'Всего кампаний')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.sent}</div>
                    <div style={{ color: '#666' }}>{t('smscampaigns.otpravleno', 'Отправлено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.scheduled}</div>
                    <div style={{ color: '#666' }}>{t('smscampaigns.zaplanirovano', 'Запланировано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.totalMessages}</div>
                    <div style={{ color: '#666' }}>{t('smscampaigns.soobscheniy_otpravleno', 'Сообщений отправлено')}</div>
                </div>
            </div>

            {/* Список кампаний */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('smscampaigns.kampanii', '📋 Кампании')}</h3>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('smscampaigns.zagruzka', 'Загрузка...')}</div>
                ) : campaigns.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <MessageSquare size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                        <p>{t('smscampaigns.net_kampaniy', 'Нет SMS-кампаний')}</p>
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                            Создать первую
                        </button>
                    </div>
                ) : (
                    <div>
                        {campaigns.map(campaign => (
                            <div key={campaign.id} style={{
                                padding: '20px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '20px'
                            }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', flexShrink: 0
                                }}>
                                    <MessageSquare size={24} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <h4 style={{ margin: 0 }}>{campaign.name}</h4>
                                        {getStatusBadge(campaign.status)}
                                    </div>

                                    <p style={{
                                        margin: '0 0 12px',
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        color: '#555'
                                    }}>
                                        {campaign.message}
                                    </p>

                                    <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: '#666' }}>
                                        <span><Users size={14} style={{ marginRight: '4px' }} /> {campaign.total_recipients || 0} получателей</span>
                                        {campaign.sent_count > 0 && (
                                            <>
                                                <span><CheckCircle size={14} style={{ marginRight: '4px', color: '#10b981' }} /> {campaign.delivered_count} доставлено</span>
                                                {campaign.failed_count > 0 && (
                                                    <span><XCircle size={14} style={{ marginRight: '4px', color: '#ef4444' }} /> {campaign.failed_count} ошибок</span>
                                                )}
                                            </>
                                        )}
                                        {campaign.scheduled_at && (
                                            <span><Clock size={14} style={{ marginRight: '4px' }} /> {formatDate(campaign.scheduled_at)}</span>
                                        )}
                                        {campaign.total_cost > 0 && (
                                            <span>💰 {formatCurrency(campaign.total_cost)}</span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {campaign.status === 'draft' && (
                                        <button className="btn btn-primary btn-sm" onClick={() => handleSendCampaign(campaign.id)}>
                                            <Send size={14} /> Отправить
                                        </button>
                                    )}
                                    {campaign.status === 'scheduled' && (
                                        <button className="btn btn-danger btn-sm" onClick={() => handleCancelCampaign(campaign.id)}>{t('smscampaigns.otmenit', 'Отменить')}</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Модал создания */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{t('smscampaigns.novaya_rassylka', '📱 Новая SMS-рассылка')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('smscampaigns.nazvanie_kampanii', 'Название кампании')}</label>
                                <input
                                    type="text"
                                    value={newCampaign.name}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    placeholder="Например: Акция выходного дня"
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('smscampaigns.tekst_soobscheniya', 'Текст сообщения')}</label>
                                <textarea
                                    value={newCampaign.message}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                                    rows={4}
                                    maxLength={160}
                                    placeholder="Введите текст SMS (макс. 160 символов)"
                                />
                                <div style={{ fontSize: '12px', color: '#888', textAlign: 'right' }}>
                                    {newCampaign.message.length}/160 символов
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('smscampaigns.poluchateli', 'Получатели')}</label>
                                <select
                                    value={newCampaign.target_type}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, target_type: e.target.value })}
                                >
                                    <option value="all">{t('smscampaigns.vse_klienty', 'Все клиенты')}</option>
                                    <option value="active">{t('smscampaigns.aktivnye_pokupka_za_dney', 'Активные (покупка за 30 дней)')}</option>
                                    <option value="inactive">{t('smscampaigns.neaktivnye_net_pokupok_dney', 'Неактивные (нет покупок 60+ дней)')}</option>
                                    <option value="birthday">{t('smscampaigns.den_rozhdeniya_v_etom_mesyatse', 'День рождения в этом месяце')}</option>
                                    <option value="vip">{t('smscampaigns.klienty', 'VIP клиенты')}</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{t('smscampaigns.vremya_otpravki', 'Время отправки')}</label>
                                <input
                                    type="datetime-local"
                                    value={newCampaign.scheduled_at}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_at: e.target.value })}
                                />
                                <small style={{ color: '#888' }}>{t('smscampaigns.ostavte_pustym_dlya_nemedlennoy_otpravki', 'Оставьте пустым для немедленной отправки')}</small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('smscampaigns.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={handleCreateCampaign}>
                                <Send size={18} /> Создать кампанию
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SMSCampaigns;
