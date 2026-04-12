import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send, Plus, Users, Eye, MousePointer, Check, Trash2, X, AlertCircle, Loader } from 'lucide-react';
import { crmAPI,  emailCampaignsAPI } from '../services/api';
import { connectSocket } from '../services/api';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function EmailCampaigns() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [campaigns, setCampaigns] = useState([]);
    const [stats, setStats] = useState({ total_sent: 0, avg_open_rate: 0, avg_click_rate: 0, subscribers: 0 });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [sending, setSending] = useState({});
    const [message, setMessage] = useState(null);
    const [form, setForm] = useState({ name: '', subject: '', body: '', recipientEmails: '' });
    const [formLoading, setFormLoading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const res = await emailCampaignsAPI.getAll();
            setCampaigns(res.data.campaigns || []);
            setStats(res.data.stats || { total_sent: 0, avg_open_rate: 0, avg_click_rate: 0, subscribers: 0 });
        } catch (err) {
            console.error('EmailCampaigns load error:', err);
            setMessage({ type: 'error', text: 'Ошибка загрузки кампаний' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        // WebSocket: подписаться на события кампаний
        const socket = connectSocket();
        if (socket) {
            socket.on('campaign:sent', (data) => {
                setCampaigns(prev => prev.map(c =>
                    c.id === data.campaignId
                        ? { ...c, status: data.status, sent_count: data.sentCount || c.sent_count }
                        : c
                ));
                setSending(prev => ({ ...prev, [data.campaignId]: false }));
                if (data.status === 'sent') {
                    setMessage({ type: 'success', text: `Кампания отправлена! Доставлено: ${data.sentCount}` });
                } else if (data.status === 'failed') {
                    setMessage({ type: 'error', text: `Ошибка отправки: ${data.error}` });
                }
            });

            socket.on('campaign:created', (data) => {
                setCampaigns(prev => [data.campaign, ...prev]);
            });

            socket.on('campaign:deleted', (data) => {
                setCampaigns(prev => prev.filter(c => c.id !== data.campaignId));
            });
        }

        return () => {
            if (socket) {
                socket.off('campaign:sent');
                socket.off('campaign:created');
                socket.off('campaign:deleted');
            }
        };
    }, [loadData]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.subject || !form.body) {
            setMessage({ type: 'error', text: 'Заполните все обязательные поля' });
            return;
        }
        setFormLoading(true);
        try {
            const recipientEmails = form.recipientEmails
                ? form.recipientEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
                : [];
            await emailCampaignsAPI.create({ ...form, recipientEmails });
            setMessage({ type: 'success', text: 'Кампания создана!' });
            setShowForm(false);
            setForm({ name: '', subject: '', body: '', recipientEmails: '' });
            loadData();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Ошибка создания' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleSend = async (id) => {
        if (!(await confirm({ message: 'Отправить кампанию всем получателям?' }))) return;
        setSending(prev => ({ ...prev, [id]: true }));
        try {
            const res = await emailCampaignsAPI.send(id);
            setMessage({ type: 'info', text: res.data.message });
            // Статус обновится через WebSocket
        } catch (err) {
            setSending(prev => ({ ...prev, [id]: false }));
            setMessage({ type: 'error', text: err.response?.data?.error || 'Ошибка отправки' });
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить кампанию?' }))) return;
        try {
            await emailCampaignsAPI.delete(id);
            setMessage({ type: 'success', text: 'Кампания удалена' });
            // Список обновится через WebSocket
        } catch (err) {
            setMessage({ type: 'error', text: 'Ошибка удаления' });
        }
    };

    const getStatusInfo = (status) => {
        const statuses = {
            sent: { label: 'Отправлено', color: '#10b981', bg: '#dcfce7' },
            sending: { label: 'Отправляется...', color: '#3b82f6', bg: '#dbeafe' },
            scheduled: { label: 'Запланировано', color: '#f59e0b', bg: '#fef3c7' },
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6' },
            failed: { label: 'Ошибка', color: '#ef4444', bg: '#fee2e2' }
        };
        return statuses[status] || statuses.draft;
    };

    return (
        <div className="email-campaigns-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('emailcampaigns.rassylki', '📧 Email-рассылки')}</h1>
                    <p className="text-muted">{t('emailcampaigns.marketingovye_kampanii', 'Маркетинговые email-кампании')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} /> {t('emailcampaigns.novaya_kampaniya', 'Новая кампания')}
                </button>
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                    background: message.type === 'success' ? '#dcfce7' : message.type === 'error' ? '#fee2e2' : '#dbeafe',
                    color: message.type === 'success' ? '#166534' : message.type === 'error' ? '#991b1b' : '#1e40af',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <AlertCircle size={16} />
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Форма создания */}
            {showForm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{t('emailcampaigns.novaya_kampaniya', 'Новая кампания')}</h2>
                            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('emailcampaigns.nazvanie', 'Название *')}</label>
                                <input
                                    className="form-control"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Например: Февральская акция"
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('emailcampaigns.tema_pisma', 'Тема письма *')}</label>
                                <input
                                    className="form-control"
                                    value={form.subject}
                                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                                    placeholder="Тема, которую увидит получатель"
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('emailcampaigns.tekst_pisma', 'Текст письма *')}</label>
                                <textarea
                                    className="form-control"
                                    value={form.body}
                                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                                    placeholder="Текст или HTML-содержимое письма"
                                    rows={6}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                                    Email получателей <span style={{ color: '#888', fontWeight: 400 }}>{t('emailcampaigns.neobyazatelno_esli_pusto_otpravitsya', '(необязательно — если пусто, отправится всем клиентам)')}</span>
                                </label>
                                <textarea
                                    className="form-control"
                                    value={form.recipientEmails}
                                    onChange={e => setForm(p => ({ ...p, recipientEmails: e.target.value }))}
                                    placeholder="email1@example.com, email2@example.com"
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                    {formLoading ? <><Loader size={16} className="spin" /> {t('emailcampaigns.sozdanie', 'Создание...')}</> : <><Check size={16} /> {t('emailcampaigns.sozdat', 'Создать')}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Send size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_sent.toLocaleString()}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('emailcampaigns.otpravleno_pisem', 'Отправлено писем')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Eye size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_open_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Open Rate</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <MousePointer size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_click_rate}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Click Rate</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.subscribers.toLocaleString()}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('emailcampaigns.podpischikov', 'Подписчиков')}</div>
                </div>
            </div>

            {/* Таблица кампаний */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('emailcampaigns.kampanii', '📋 Кампании')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                        <Loader size={24} className="spin" style={{ marginBottom: '8px' }} />
                        <div>{t('emailcampaigns.zagruzka', 'Загрузка...')}</div>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                        <Mail size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <div style={{ fontSize: '16px', marginBottom: '8px' }}>{t('emailcampaigns.net_kampaniy', 'Нет кампаний')}</div>
                        <div style={{ fontSize: '13px' }}>{t('emailcampaigns.nazhmite_novaya_kampaniya_chtoby_sozdat', 'Нажмите «Новая кампания», чтобы создать первую рассылку')}</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('emailcampaigns.kampaniya', 'Кампания')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('emailcampaigns.poluchateli', 'Получатели')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>Отправлено</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('emailcampaigns.otkryto', 'Открыто')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('emailcampaigns.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('emailcampaigns.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(camp => {
                                const statusInfo = getStatusInfo(camp.status);
                                const openRate = camp.sent_count > 0 ? Math.round((camp.opened_count / camp.sent_count) * 100) : 0;
                                const isSending = sending[camp.id];

                                return (
                                    <tr key={camp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '14px' }}>
                                            <div style={{ fontWeight: 500 }}>{camp.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{camp.subject}</div>
                                            {camp.sent_at && (
                                                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                                                    {new Date(camp.sent_at).toLocaleString('ru-RU')}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>{camp.recipients_count || 0}</td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>{camp.sent_count || 0}</td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            {camp.opened_count > 0 ? (
                                                <span style={{ color: openRate > 30 ? '#10b981' : '#f59e0b' }}>
                                                    {camp.opened_count} ({openRate}%)
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {isSending ? 'Отправляется...' : statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                {camp.status !== 'sent' && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleSend(camp.id)}
                                                        disabled={isSending || camp.status === 'sending'}
                                                        title={t('emailcampaigns.otpravit', 'Отправить')}
                                                    >
                                                        {isSending ? <Loader size={14} className="spin" /> : <Send size={14} />}
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDelete(camp.id)}
                                                    title={t('emailcampaigns.udalit', 'Удалить')}
                                                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default EmailCampaigns;
