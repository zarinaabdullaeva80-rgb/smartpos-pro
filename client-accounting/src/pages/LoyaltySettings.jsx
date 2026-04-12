import React, { useState, useEffect } from 'react';
import { Settings, Save, ToggleLeft, ToggleRight, Gift, Star, Clock, Users, Percent, DollarSign } from 'lucide-react';
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
        enabled: true
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>

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
