import React, { useState, useEffect } from 'react';
import { Save, CreditCard, Smartphone, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

/**
 * Страница настроек платёжных систем
 */
function PaymentSettings() {
    const { t } = useI18n();
    const toast = useToast();
    const [settings, setSettings] = useState({
        payme: {
            enabled: true,
            merchantId: '',
            description: 'Payme — популярная платёжная система'
        },
        click: {
            enabled: true,
            serviceId: '',
            merchantId: '',
            secretKey: '',
            description: 'Click — мобильные платежи'
        },
        uzum: {
            enabled: true,
            merchantId: '',
            description: 'UZUM Bank — банковские платежи'
        }
    });

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = () => {
        const saved = localStorage.getItem('payment_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSettings(prev => ({
                    ...prev,
                    payme: { ...prev.payme, ...parsed.payme },
                    click: { ...prev.click, ...parsed.click },
                    uzum: { ...prev.uzum, ...parsed.uzum }
                }));
            } catch (e) {
                console.error('Error loading payment settings:', e);
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            localStorage.setItem('payment_settings', JSON.stringify(settings));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            toast.info('Ошибка сохранения: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateSystem = (system, field, value) => {
        setSettings(prev => ({
            ...prev,
            [system]: {
                ...prev[system],
                [field]: value
            }
        }));
    };

    const isConfigured = (system) => {
        if (system === 'click') {
            return settings.click.serviceId && settings.click.merchantId;
        }
        return settings[system]?.merchantId;
    };

    return (
        <div className="payment-settings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('paymentsettings.nastroyki_platyozhnyh_sistem', '💳 Настройки платёжных систем')}</h1>
                    <p className="text-muted">{t('paymentsettings.nastroyte_dlya_priyoma_plat', 'Настройте Merchant ID для приёма QR-платежей')}</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Сохранение...' : saved ? '✓ Сохранено!' : <><Save size={20} /> {t('paymentsettings.sohranit', 'Сохранить')}</>}
                </button>
            </div>

            {/* Инструкция */}
            <div className="card" style={{ marginBottom: '20px', background: '#f0f9ff', borderLeft: '4px solid #0ea5e9' }}>
                <div style={{ padding: '16px' }}>
                    <h4 style={{ margin: 0, color: '#0369a1' }}>{t('paymentsettings.kak_poluchit', 'ℹ️ Как получить Merchant ID?')}</h4>
                    <p style={{ margin: '8px 0 0', color: '#0c4a6e' }}>
                        Зарегистрируйтесь как мерчант на сайте платёжной системы.
                        После одобрения заявки вы получите идентификаторы для интеграции.
                        Деньги будут зачисляться на расчётный счёт вашей компании.
                    </p>
                </div>
            </div>

            {/* Payme */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: '#00CCCC', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <CreditCard size={24} color="#fff" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0 }}>Payme</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{settings.payme.description}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isConfigured('payme') ? (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={16} /> Настроено
                                </span>
                            ) : (
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={16} /> Не настроено
                                </span>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.payme.enabled}
                                    onChange={(e) => updateSystem('payme', 'enabled', e.target.checked)}
                                />
                                Включено
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Merchant ID</label>
                        <input
                            type="text"
                            value={settings.payme.merchantId}
                            onChange={(e) => updateSystem('payme', 'merchantId', e.target.value)}
                            placeholder="Например: 62abc123def456"
                            disabled={!settings.payme.enabled}
                        />
                    </div>

                    <a href="https://merchant.payme.uz" target="_blank" rel="noopener noreferrer"
                        style={{ color: '#00CCCC', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        Зарегистрироваться на merchant.payme.uz <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Click */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: '#00A2E8', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Smartphone size={24} color="#fff" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0 }}>Click</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{settings.click.description}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isConfigured('click') ? (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={16} /> Настроено
                                </span>
                            ) : (
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={16} /> Не настроено
                                </span>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.click.enabled}
                                    onChange={(e) => updateSystem('click', 'enabled', e.target.checked)}
                                />
                                Включено
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label>Service ID</label>
                            <input
                                type="text"
                                value={settings.click.serviceId}
                                onChange={(e) => updateSystem('click', 'serviceId', e.target.value)}
                                placeholder="12345"
                                disabled={!settings.click.enabled}
                            />
                        </div>
                        <div className="form-group">
                            <label>Merchant ID</label>
                            <input
                                type="text"
                                value={settings.click.merchantId}
                                onChange={(e) => updateSystem('click', 'merchantId', e.target.value)}
                                placeholder="67890"
                                disabled={!settings.click.enabled}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('paymentsettings.dlya_servernoy_integratsii', 'Secret Key (для серверной интеграции)')}</label>
                        <input
                            type="password"
                            value={settings.click.secretKey}
                            onChange={(e) => updateSystem('click', 'secretKey', e.target.value)}
                            placeholder="••••••••••••"
                            disabled={!settings.click.enabled}
                        />
                    </div>

                    <a href="https://merchant.click.uz" target="_blank" rel="noopener noreferrer"
                        style={{ color: '#00A2E8', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        Зарегистрироваться на merchant.click.uz <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* UZUM */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: '#7B2D8E', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <CreditCard size={24} color="#fff" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0 }}>UZUM Bank</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{settings.uzum.description}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isConfigured('uzum') ? (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={16} /> Настроено
                                </span>
                            ) : (
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={16} /> Не настроено
                                </span>
                            )}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.uzum.enabled}
                                    onChange={(e) => updateSystem('uzum', 'enabled', e.target.checked)}
                                />
                                Включено
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Merchant ID</label>
                        <input
                            type="text"
                            value={settings.uzum.merchantId}
                            onChange={(e) => updateSystem('uzum', 'merchantId', e.target.value)}
                            placeholder="Например: uzum_merchant_123"
                            disabled={!settings.uzum.enabled}
                        />
                    </div>

                    <a href="https://business.uzum.uz" target="_blank" rel="noopener noreferrer"
                        style={{ color: '#7B2D8E', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        Зарегистрироваться на business.uzum.uz <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Справка */}
            <div className="card" style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ padding: '16px' }}>
                    <h4 style={{ margin: 0, color: '#92400e' }}>{t('paymentsettings.vazhno', '⚠️ Важно')}</h4>
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px', color: '#78350f' }}>
                        <li>{t('paymentsettings.sohranyonnye_nastroyki_primenyayutsya_k_mobi', 'Сохранённые настройки применяются к мобильному приложению при следующей синхронизации')}</li>
                        <li>{t('paymentsettings.dlya_realnyh_platezhey_neobhodim_odobrenn', 'Для реальных платежей необходим одобренный мерчант-аккаунт')}</li>
                        <li>{t('paymentsettings.komissiya_platyozhnyh_sistem_obychno_pct_o', 'Комиссия платёжных систем: обычно 1-2% от суммы')}</li>
                        <li>{t('paymentsettings.dengi_zachislyayutsya_na_raschyotnyy_schyot_v_t', 'Деньги зачисляются на расчётный счёт в течение 1-3 рабочих дней')}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default PaymentSettings;
