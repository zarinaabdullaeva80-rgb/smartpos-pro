import React, { useState, useEffect } from 'react';
import { Send, Bot, Trash2, CheckCircle, XCircle, Settings, RefreshCw, Copy, ExternalLink, AlertTriangle, Zap } from 'lucide-react';
import api from '../services/api';
import { useI18n } from '../i18n';

function TelegramSettings() {
    const { t } = useI18n();
    const [chats, setChats] = useState([]);
    const [botSettings, setBotSettings] = useState(null);
    const [botToken, setBotToken] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState(null);
    const [step, setStep] = useState(1);
    const [webhookUrl, setWebhookUrl] = useState('');

    useEffect(() => {
        loadBotSettings();
        loadChats();
    }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const loadBotSettings = async () => {
        try {
            const apiRes = await telegramAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setBotSettings(response.data);
            setStep(3);
        } catch (err) {
            console.warn('TelegramSettings: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const loadChats = async () => {
        try {
            const response = await api.get('/api/telegram/chats');
            setChats(response.data);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    };

    const saveBotToken = async () => {
        if (!botToken.trim() || !botToken.includes(':')) {
            showMessage('error', 'Введите корректный токен бота (формат: 123456:ABC-DEF...)');
            return;
        }

        setSaving(true);
        try {
            const response = await api.post('/api/telegram/bot-settings', { botToken });
            if (response.data.success) {
                showMessage('success', `Бот @${response.data.bot.username} успешно подключен!`);
                setBotSettings({
                    configured: true,
                    bot: response.data.bot
                });
                setStep(2);
                setBotToken('');
            }
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Ошибка сохранения токена');
        } finally {
            setSaving(false);
        }
    };

    const setupWebhook = async () => {
        if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
            showMessage('error', 'Введите корректный HTTPS URL вашего сервера');
            return;
        }

        setSaving(true);
        try {
            const response = await api.post('/api/telegram/setup-webhook', { webhookBaseUrl: webhookUrl });
            if (response.data.success) {
                showMessage('success', 'Webhook успешно настроен!');
                setStep(3);
                loadBotSettings();
            }
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Ошибка настройки webhook');
        } finally {
            setSaving(false);
        }
    };

    const sendTestMessage = async () => {
        if (!testMessage.trim()) return;

        setSending(true);
        try {
            const response = await api.post('/api/telegram/test-message', { message: testMessage });
            if (response.data.success) {
                showMessage('success', `Отправлено ${response.data.sent} сообщений!`);
                setTestMessage('');
            }
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Ошибка отправки');
        } finally {
            setSending(false);
        }
    };

    const disableBot = async () => {
        if (!confirm('Вы уверены, что хотите отключить бота?')) return;

        try {
            await api.delete('/api/telegram/bot-settings');
            showMessage('success', 'Бот отключен');
            setBotSettings(null);
            setStep(1);
            loadBotSettings();
        } catch (error) {
            showMessage('error', 'Ошибка отключения бота');
        }
    };

    const deleteChat = async (chatId) => {
        if (!confirm('Удалить этот чат?')) return;

        try {
            await api.delete(`/api/telegram/chats/${chatId}`);
            loadChats();
            showMessage('success', 'Чат удалён');
        } catch (error) {
            showMessage('error', 'Ошибка удаления');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showMessage('success', 'Скопировано в буфер обмена');
    };

    if (loading) {
        return (
            <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
                <RefreshCw className="spin" size={32} />
                <p>{t('telegramsettings.zagruzka', 'Загрузка...')}</p>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Bot size={28} /> Telegram Bot
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '0.5rem 0 0' }}>
                        Настройте своего Telegram бота для уведомлений
                    </p>
                </div>
                {botSettings?.configured && (
                    <button className="btn btn-danger" onClick={disableBot}>
                        <XCircle size={16} /> Отключить бота
                    </button>
                )}
            </div>

            {/* Сообщение */}
            {message && (
                <div style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    borderRadius: '8px',
                    backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Статус бота */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={20} /> Статус бота
                    </h2>
                    {botSettings?.configured && (
                        <span style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            color: 'var(--color-success)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={14} /> Активен
                        </span>
                    )}
                </div>

                {botSettings?.configured ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('telegramsettings.imya_bota', 'Имя бота')}</div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{botSettings.bot.firstName}</div>
                        </div>
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Username</div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                                @{botSettings.bot.username}
                            </div>
                        </div>
                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('telegramsettings.aktivnyh_chatov', 'Активных чатов')}</div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{chats.filter(c => c.is_active).length}</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <XCircle size={48} color="var(--color-text-muted)" style={{ marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{t('telegramsettings.bot_ne_nastroen', 'Бот не настроен')}</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            Следуйте инструкции ниже для настройки вашего Telegram бота
                        </p>
                    </div>
                )}
            </div>

            {/* Шаги настройки */}
            {(!botSettings?.configured || step < 3) && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={20} /> Настройка бота
                    </h2>

                    {/* Шаг 1: Создание бота */}
                    <div style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        backgroundColor: step === 1 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-secondary)',
                        border: step === 1 ? '2px solid var(--color-primary)' : 'none'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                backgroundColor: step > 1 ? 'var(--color-success)' : 'var(--color-primary)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                            }}>
                                {step > 1 ? '✓' : '1'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('telegramsettings.sozdayte_bota_v', 'Создайте бота в Telegram')}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    Откройте @BotFather и создайте нового бота
                                </div>
                            </div>
                        </div>

                        {step === 1 && (
                            <div style={{ paddingLeft: '48px' }}>
                                <ol style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                                    <li style={{ marginBottom: '0.5rem' }}>
                                        Откройте Telegram и найдите бота
                                        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                                            style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>
                                            @BotFather <ExternalLink size={12} style={{ display: 'inline' }} />
                                        </a>
                                    </li>
                                    <li style={{ marginBottom: '0.5rem' }}>{t('telegramsettings.otpravte_komandu', 'Отправьте команду')} <code>/newbot</code></li>
                                    <li style={{ marginBottom: '0.5rem' }}>{t('telegramsettings.vvedite_imya_i_dlya_vashego_bota', 'Введите имя и username для вашего бота')}</li>
                                    <li>{t('telegramsettings.skopiruyte_poluchennyy_token_i_vstavte_n', 'Скопируйте полученный токен и вставьте ниже')}</li>
                                </ol>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                        value={botToken}
                                        onChange={(e) => setBotToken(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={saveBotToken}
                                        disabled={saving || !botToken.trim()}
                                    >
                                        {saving ? <RefreshCw className="spin" size={16} /> : <CheckCircle size={16} />}
                                        {saving ? 'Проверка...' : 'Подключить'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Шаг 2: Настройка Webhook */}
                    <div style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        backgroundColor: step === 2 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-secondary)',
                        border: step === 2 ? '2px solid var(--color-primary)' : 'none',
                        opacity: step < 2 ? 0.5 : 1
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: step === 2 ? '1rem' : 0 }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                backgroundColor: step > 2 ? 'var(--color-success)' : step === 2 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                            }}>
                                {step > 2 ? '✓' : '2'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('telegramsettings.nastroyte', 'Настройте Webhook')}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    Укажите URL вашего сервера для получения уведомлений
                                </div>
                            </div>
                        </div>

                        {step === 2 && (
                            <div style={{ paddingLeft: '48px' }}>
                                <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                                    Введите публичный HTTPS URL вашего сервера (например, ngrok или ваш домен):
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="https://your-domain.com"
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={setupWebhook}
                                        disabled={saving || !webhookUrl.trim()}
                                    >
                                        {saving ? <RefreshCw className="spin" size={16} /> : <Zap size={16} />}
                                        Настроить
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Шаг 3: Готово */}
                    <div style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        backgroundColor: step === 3 ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-bg-secondary)',
                        border: step === 3 ? '2px solid var(--color-success)' : 'none',
                        opacity: step < 3 ? 0.5 : 1
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                backgroundColor: step === 3 ? 'var(--color-success)' : 'var(--color-text-muted)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                            }}>
                                {step === 3 ? '✓' : '3'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('telegramsettings.gotovo', 'Готово!')}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    {t('telegramsettings.otpravte_vashemu_botu_v', 'Отправьте /start вашему боту в Telegram')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Отправка тестового сообщения */}
            {botSettings?.configured && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 1rem' }}>{t('telegramsettings.testovoe_soobschenie', '📤 Тестовое сообщение')}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Введите сообщение для теста..."
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={sendTestMessage}
                            disabled={sending || !testMessage.trim()}
                        >
                            {sending ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
                            {sending ? 'Отправка...' : 'Отправить'}
                        </button>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                        Сообщение будет отправлено всем подключенным чатам
                    </p>
                </div>
            )}

            {/* Список чатов */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h2 style={{ margin: '0 0 1rem' }}>💬 Подключенные чаты ({chats.length})</h2>

                {chats.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        <p>{t('telegramsettings.net_podklyuchennyh_chatov', 'Нет подключенных чатов')}</p>
                        <p style={{ fontSize: '0.9rem' }}>{t('telegramsettings.otpravte_vashemu_botu_v', 'Отправьте /start вашему боту в Telegram')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {chats.map((chat) => (
                            <div key={chat.id} style={{
                                padding: '1rem',
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>
                                        {chat.username ? `@${chat.username}` : chat.first_name || 'Неизвестно'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        Chat ID: {chat.chat_id}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        Добавлен: {new Date(chat.created_at).toLocaleString('ru-RU')}
                                    </div>
                                </div>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteChat(chat.id)}
                                    title={t('telegramsettings.udalit_chat', 'Удалить чат')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Инструкции */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💡 Доступные команды бота
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div><code>/start</code> {t('telegramsettings.podklyuchitsya_k_botu', '— Подключиться к боту')}</div>
                    <div><code>/sales</code> {t('telegramsettings.prodazhi_za_segodnya', '— Продажи за сегодня')}</div>
                    <div><code>/stock</code> {t('telegramsettings.kriticheskie_ostatki', '— Критические остатки')}</div>
                </div>
            </div>

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default TelegramSettings;
