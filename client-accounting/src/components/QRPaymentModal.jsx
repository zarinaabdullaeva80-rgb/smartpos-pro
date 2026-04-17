import React, { useState, useEffect, useMemo } from 'react';
import { QrCode, CreditCard, Smartphone, CheckCircle, RefreshCw, X, Copy, ExternalLink, Settings } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useToast } from '../components/ToastProvider';

/**
 * Конфигурация платёжных систем (defaults)
 */
const PAYMENT_SYSTEMS_DEFAULTS = {
    payme: {
        id: 'payme',
        name: 'Payme',
        color: '#00CCCC',
        icon: '💳',
        generateUrl: (merchantId, amount, orderId) =>
            `https://payme.uz/checkout/${merchantId}?a=${Math.round(amount * 100)}&o=${orderId}`
    },
    click: {
        id: 'click',
        name: 'Click',
        color: '#00A2E8',
        icon: '📱',
        generateUrl: (merchantId, amount, orderId, serviceId) =>
            `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${Math.round(amount)}&transaction_param=${orderId}`
    },
    uzum: {
        id: 'uzum',
        name: 'UZUM',
        color: '#7B2D8E',
        icon: '🟣',
        generateUrl: (merchantId, amount, orderId) =>
            `https://uzumbank.uz/pay?m=${merchantId}&a=${Math.round(amount)}&r=${orderId}`
    }
};

/**
 * Загружает настройки из PaymentSettings (localStorage)
 */
function loadPaymentSettings() {
    try {
        const saved = localStorage.getItem('payment_settings');
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error('[QRPayment] Error loading settings:', e);
    }
    return null;
}

function QRPaymentModal({ isOpen, onClose, amount, orderId, onPaymentConfirmed }) {
    const toast = useToast();
    const [selectedSystem, setSelectedSystem] = useState(null);
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);

    // Получаем настройки из PaymentSettings
    const paymentConfig = useMemo(() => {
        const settings = loadPaymentSettings();
        const systems = [];

        // Payme
        const payme = settings?.payme;
        if (!payme || payme.enabled !== false) {
            systems.push({
                ...PAYMENT_SYSTEMS_DEFAULTS.payme,
                merchantId: payme?.merchantId || '',
                configured: !!payme?.merchantId,
            });
        }

        // Click
        const click = settings?.click;
        if (!click || click.enabled !== false) {
            systems.push({
                ...PAYMENT_SYSTEMS_DEFAULTS.click,
                merchantId: click?.merchantId || '',
                serviceId: click?.serviceId || '',
                configured: !!(click?.merchantId && click?.serviceId),
            });
        }

        // UZUM
        const uzum = settings?.uzum;
        if (!uzum || uzum.enabled !== false) {
            systems.push({
                ...PAYMENT_SYSTEMS_DEFAULTS.uzum,
                merchantId: uzum?.merchantId || '',
                configured: !!uzum?.merchantId,
            });
        }

        return systems;
    }, [isOpen]); // пересчитать при открытии

    // Авто-выбрать первую настроенную систему
    useEffect(() => {
        if (isOpen && paymentConfig.length > 0) {
            const configured = paymentConfig.find(s => s.configured);
            setSelectedSystem(configured?.id || paymentConfig[0]?.id || null);
        }
    }, [isOpen, paymentConfig]);

    if (!isOpen) return null;

    const system = paymentConfig.find(s => s.id === selectedSystem) || paymentConfig[0];
    if (!system) return null;

    const isDemo = !system.configured;

    const paymentUrl = system.id === 'click'
        ? system.generateUrl(
            system.merchantId || 'DEMO_CLICK',
            amount,
            orderId,
            system.serviceId || 'DEMO_SERVICE'
        )
        : system.generateUrl(
            system.merchantId || `DEMO_${system.id.toUpperCase()}`,
            amount,
            orderId
        );

    const handleCopyLink = () => {
        navigator.clipboard.writeText(paymentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        // Симуляция проверки
        await new Promise(resolve => setTimeout(resolve, 1500));
        setChecking(false);
        toast.info('Оплата ещё не получена. Подождите или подтвердите вручную.');
    };

    const handleConfirm = () => {
        if (onPaymentConfirmed) {
            onPaymentConfirmed({
                system: selectedSystem,
                amount,
                orderId,
                confirmedAt: new Date().toISOString()
            });
        }
        onClose();
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    // Проверяем, есть ли хоть одна настроенная система
    const anyConfigured = paymentConfig.some(s => s.configured);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2><QrCode size={24} /> QR-оплата</h2>
                    <button onClick={onClose} className="btn-close">×</button>
                </div>

                <div className="modal-body">
                    {/* Предупреждение: ничего не настроено */}
                    {!anyConfigured && (
                        <div style={{
                            marginBottom: '16px', padding: '14px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                            border: '1px solid #f59e0b', color: '#92400e'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <Settings size={18} />
                                <strong>Настройте платёжные системы</strong>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px' }}>
                                Merchant ID ещё не указаны. QR-коды генерируются в демо-режиме.
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                                Откройте <strong>Настройки → Платёжные системы</strong> и укажите ваши реквизиты.
                            </p>
                        </div>
                    )}

                    {/* Демо-режим для конкретной системы */}
                    {anyConfigured && isDemo && (
                        <div style={{
                            marginBottom: '16px', padding: '12px', borderRadius: '8px',
                            background: '#fff3cd', color: '#856404', fontSize: '13px'
                        }}>
                            ⚠️ <strong>{system.name}</strong> не настроен. Укажите Merchant ID в настройках.
                        </div>
                    )}

                    {/* Сумма */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>К оплате:</p>
                        <h2 style={{ color: '#10b981', fontSize: '32px', margin: '6px 0' }}>{formatCurrency(amount)}</h2>
                        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Заказ: {orderId}</p>
                    </div>

                    {/* Выбор системы */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                        {paymentConfig.map(sys => (
                            <button
                                key={sys.id}
                                className={`btn ${selectedSystem === sys.id ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                    background: selectedSystem === sys.id ? sys.color : undefined,
                                    borderColor: sys.color,
                                    fontSize: '13px',
                                    padding: '6px 14px',
                                    position: 'relative',
                                }}
                                onClick={() => setSelectedSystem(sys.id)}
                            >
                                {sys.icon} {sys.name}
                                {sys.configured && (
                                    <CheckCircle size={12} style={{
                                        position: 'absolute', top: '-4px', right: '-4px',
                                        color: '#10b981', background: '#fff', borderRadius: '50%'
                                    }} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* QR-код */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '20px',
                        background: '#fff',
                        borderRadius: '16px',
                        border: `3px solid ${system.color}`,
                        margin: '0 auto 20px',
                        maxWidth: '280px'
                    }}>
                        <QRCode
                            value={paymentUrl}
                            size={200}
                            fgColor={system.color}
                        />
                    </div>

                    {/* Инструкция */}
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '16px', fontSize: '14px' }}>
                        Отсканируйте QR-код в приложении <strong>{system.name}</strong>
                    </p>

                    {/* Ссылка */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleCopyLink}
                            style={{ fontSize: '12px' }}
                        >
                            <Copy size={14} /> {copied ? 'Скопировано!' : 'Копировать ссылку'}
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => window.open(paymentUrl, '_blank')}
                            style={{ fontSize: '12px' }}
                        >
                            <ExternalLink size={14} /> Открыть
                        </button>
                    </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleCheckStatus}
                        disabled={checking}
                    >
                        <RefreshCw size={16} className={checking ? 'spin' : ''} />
                        {checking ? 'Проверка...' : 'Проверить оплату'}
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={handleConfirm}
                    >
                        <CheckCircle size={16} /> Подтвердить оплату
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                    >
                        Отмена
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
}

export default QRPaymentModal;
