import React, { useState, useEffect } from 'react';
import { Settings, Save, ToggleLeft, ToggleRight, Gift, Star, Clock, Users, Percent, DollarSign, Upload, Trash2, Image, Phone, FileText } from 'lucide-react';
import '../styles/Common.css';
import { loyaltyAPI } from '../services/api';
import { useI18n } from '../i18n';

export default function LoyaltySettings() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({
        cashback_percent: 2,
        min_purchase: 10000,
        points_expiry_days: 365,
        welcome_bonus: 0,
        birthday_bonus: 0,
        referral_bonus: 0,
        enabled: true,
        card_logo: null,
        card_phone: '',
        card_text: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await loyaltyAPI.getSettings();
            const data = res.data?.settings || res.data;
            if (data) {
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await loyaltyAPI.updateSettings(settings);
            setMessage({ type: 'success', text: '✅ Настройки сохранены!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            setMessage({ type: 'error', text: '❌ Ошибка сохранения настроек' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Пожалуйста, выберите файл изображения (PNG, JPG)' });
            return;
        }
        
        // Limit to 1.5MB to avoid database size issues with too large base64
        if (file.size > 1.5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Размер файла не должен превышать 1.5 МБ' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            handleChange('card_logo', event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        handleChange('card_logo', null);
    };

    if (loading) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title">
                    <Settings size={24} />
                    <h1>{t('loyaltysettings.nastroyki_programmy_loyalnosti', 'Настройки программы лояльности')}</h1>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Save size={16} />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>

            {message && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    background: message.type === 'success' ? 'var(--success-bg, #d4edda)' : 'var(--danger-bg, #f8d7da)',
                    color: message.type === 'success' ? 'var(--success-color, #155724)' : 'var(--danger-color, #721c24)',
                    border: `1px solid ${message.type === 'success' ? 'var(--success-border, #c3e6cb)' : 'var(--danger-border, #f5c6cb)'}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '20px' }}>

                {/* Основные настройки */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>
                        <Percent size={20} style={{ color: 'var(--primary)' }} />
                        Основные настройки
                    </h3>

                    <div style={{ marginBottom: '16px' }}>
                        <div
                            onClick={() => handleChange('enabled', !settings.enabled)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                                background: settings.enabled ? 'var(--success-bg, #d4edda)' : 'var(--bg-secondary, #f8f9fa)',
                                border: `1px solid ${settings.enabled ? 'var(--success-border, #c3e6cb)' : 'var(--border-color, #dee2e6)'}`
                            }}
                        >
                            <span style={{ fontWeight: 500 }}>{t('loyaltysettings.programma_loyalnosti', 'Программа лояльности')}</span>
                            {settings.enabled ? (
                                <ToggleRight size={28} style={{ color: 'var(--success-color, #28a745)' }} />
                            ) : (
                                <ToggleLeft size={28} style={{ color: 'var(--text-muted, #6c757d)' }} />
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Процент кэшбека (%)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.cashback_percent}
                            onChange={(e) => handleChange('cashback_percent', parseFloat(e.target.value) || 0)}
                            min="0" max="100" step="0.5"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            За каждую покупку клиент получает {settings.cashback_percent}% от суммы в баллах
                        </small>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Минимальная сумма покупки (сум)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.min_purchase}
                            onChange={(e) => handleChange('min_purchase', parseInt(e.target.value) || 0)}
                            min="0" step="1000"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            Баллы начисляются только при покупке от {settings.min_purchase?.toLocaleString()} сум
                        </small>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Срок действия баллов (дней)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.points_expiry_days}
                            onChange={(e) => handleChange('points_expiry_days', parseInt(e.target.value) || 0)}
                            min="0" step="30"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            0 = баллы не сгорают
                        </small>
                    </div>
                </div>

                {/* Бонусы */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>
                        <Gift size={20} style={{ color: 'var(--primary)' }} />
                        Бонусы
                    </h3>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <Star size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Приветственный бонус (баллов)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.welcome_bonus}
                            onChange={(e) => handleChange('welcome_bonus', parseInt(e.target.value) || 0)}
                            min="0" step="100"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            Начисляется при создании карты лояльности
                        </small>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <Gift size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Бонус на день рождения (баллов)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.birthday_bonus}
                            onChange={(e) => handleChange('birthday_bonus', parseInt(e.target.value) || 0)}
                            min="0" step="100"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            Реферальный бонус (баллов)
                        </label>
                        <input
                            type="number"
                            className="form-input"
                            value={settings.referral_bonus}
                            onChange={(e) => handleChange('referral_bonus', parseInt(e.target.value) || 0)}
                            min="0" step="100"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            Начисляется, когда клиент приглашает нового
                        </small>
                    </div>
                </div>
            </div>

            {/* Внешний вид карты лояльности */}
            <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>
                    <Image size={20} style={{ color: 'var(--primary)' }} />
                    Внешний вид карты лояльности
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                    {/* Настройки вида */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* Загрузка Логотипа */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <Image size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Логотип организации
                            </label>
                            
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                    <Upload size={14} />
                                    Выбрать изображение
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                </label>
                                
                                {settings.card_logo && (
                                    <button className="btn btn-danger" onClick={handleRemoveLogo} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}>
                                        <Trash2 size={14} />
                                        Удалить логотип
                                    </button>
                                )}
                            </div>
                            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                                Рекомендуется горизонтальный логотип с прозрачным фоном (PNG/JPG, макс 1.5 МБ).
                            </small>
                        </div>

                        {/* Произвольный телефон */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <Phone size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Телефон для связи на карте
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.card_phone || ''}
                                onChange={(e) => handleChange('card_phone', e.target.value)}
                                placeholder="Например: +998 90 123 45 67"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                Будет отображаться в верхнем правом углу карты лояльности
                            </small>
                        </div>

                        {/* Дополнительные данные */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Дополнительные данные (адрес, сайт, инфо)
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.card_text || ''}
                                onChange={(e) => handleChange('card_text', e.target.value)}
                                placeholder="Например: г. Ташкент, ул. Навои, 15 или www.mypos.uz"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #dee2e6)', fontSize: '14px' }}
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                Будет отображаться рядом с именем клиента
                            </small>
                        </div>
                    </div>

                    {/* Живой предпросмотр */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                            ✨ Интерактивный предпросмотр карты:
                        </div>
                        
                        {/* Карта */}
                        <div style={{
                            width: '320px', height: '200px',
                            background: settings.card_logo ? `url(${settings.card_logo}) no-repeat center center / cover` : 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%)',
                            borderRadius: '16px',
                            padding: '24px',
                            color: 'white',
                            position: 'relative',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            overflow: 'hidden'
                        }}>
                            {/* Волна водяного знака */}
                            {!settings.card_logo && (
                                <div style={{
                                    content: '""',
                                    position: 'absolute',
                                    top: '-80px', right: '-80px',
                                    width: '200px', height: '200px',
                                    background: 'rgba(255,215,0,0.04)',
                                    borderRadius: '50%',
                                    pointerEvents: 'none'
                                }}></div>
                            )}

                            {/* Верхняя строка */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                                {!settings.card_logo ? (
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                        SmartPOS <span style={{ color: '#ffd700' }}>Бонус</span>
                                    </div>
                                ) : (
                                    <div></div>
                                )}
                                
                                {settings.card_phone ? (
                                    <div style={{ fontSize: '10px', opacity: 0.9, fontWeight: 500 }}>
                                        📞 {settings.card_phone}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '9px', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                        ★ Gold
                                    </div>
                                )}
                            </div>

                            {/* Номер карты */}
                            <div style={{
                                fontSize: '18px', letterSpacing: '3px',
                                fontFamily: 'monospace', marginTop: '20px', zIndex: 1
                            }}>
                                9999 1234 5678 9012
                            </div>

                            {/* Данные клиента */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px', zIndex: 1 }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>
                                        ИВАН ИВАНОВ
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#ffd700', marginTop: '2px' }}>
                                        Баланс: 2 500 баллов
                                    </div>
                                </div>
                                
                                {settings.card_text && (
                                    <div style={{ fontSize: '10px', opacity: 0.8, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        {settings.card_text}
                                    </div>
                                )}
                            </div>

                            {/* Баркод подложка */}
                            <div style={{
                                background: 'white', padding: '3px 6px', borderRadius: '4px',
                                textAlign: 'center', marginTop: '10px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{ color: '#aaa', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px' }}>
                                    ||||| BARCODE |||||
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Информационный блок */}
            <div className="card" style={{ padding: '20px', marginTop: '20px', background: 'var(--bg-secondary, #f8f9fa)' }}>
                <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>{t('loyaltysettings.kak_rabotaet_programma_loyalnosti', '💡 Как работает программа лояльности')}</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                    <li>{t('loyaltysettings.pri_kazhdoy_pokupke_na_summu_ot', 'При каждой покупке на сумму от')} <strong>{settings.min_purchase?.toLocaleString()} сум</strong> {t('loyaltysettings.klient_poluchaet', 'клиент получает')} <strong>{settings.cashback_percent}%</strong> {t('loyaltysettings.ot_summy_v_ballah', 'от суммы в баллах')}</li>
                    <li>{t('loyaltysettings.ball_sum_pri_oplate_ballami', '1 балл = 1 сум при оплате баллами')}</li>
                    <li>{t('loyaltysettings.bally_mozhno_ispolzovat_dlya_chastichnoy_i', 'Баллы можно использовать для частичной или полной оплаты следующих покупок')}</li>
                    {settings.welcome_bonus > 0 && <li>{t('loyaltysettings.novye_klienty_poluchayut', 'Новые клиенты получают')} <strong>{settings.welcome_bonus}</strong> {t('loyaltysettings.privetstvennyh_ballov', 'приветственных баллов')}</li>}
                    {settings.birthday_bonus > 0 && <li>{t('loyaltysettings.v_den_rozhdeniya_klient_poluchaet', 'В день рождения клиент получает')} <strong>{settings.birthday_bonus}</strong> {t('loyaltysettings.bonusnyh_ballov', 'бонусных баллов')}</li>}
                    {settings.points_expiry_days > 0 && <li>{t('loyaltysettings.bally_deystvitelny_v_techenie', 'Баллы действительны в течение')} <strong>{settings.points_expiry_days}</strong> {t('loyaltysettings.dney', 'дней')}</li>}
                </ul>
            </div>
        </div>
    );
}
