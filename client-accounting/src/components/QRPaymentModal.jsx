import React, { useState, useEffect } from 'react';
import { QrCode, CreditCard, Smartphone, CheckCircle, RefreshCw, X, Copy, ExternalLink } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useToast } from '../components/ToastProvider';

/**
 * Конфигурация платёжных систем
 */
const PAYMENT_SYSTEMS = {
    payme: {
        id: 'payme',
        name: 'Payme',
        color: '#00CCCC',
        icon: '💳',
        merchantId: 'DEMO_PAYME', // Замените на реальный
        generateUrl: (merchantId, amount, orderId) =>
            `https://payme.uz/checkout/${merchantId}?a=${Math.round(amount * 100)}&o=${orderId}`
    },
    click: {
        id: 'click',
        name: 'Click',
        color: '#00A2E8',
        icon: '📱',
        serviceId: 'DEMO_SERVICE', // Замените на реальный
        merchantId: 'DEMO_CLICK',
        generateUrl: (merchantId, amount, orderId, serviceId) =>
            `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${Math.round(amount)}&transaction_param=${orderId}`
    },
    uzum: {
        id: 'uzum',
        name: 'UZUM',
        color: '#7B2D8E',
        icon: '🟣',
        merchantId: 'DEMO_UZUM', // Замените на реальный
        generateUrl: (merchantId, amount, orderId) =>
            `https://uzumbank.uz/pay?m=${merchantId}&a=${Math.round(amount)}&r=${orderId}`
    }
};

function QRPaymentModal({ isOpen, onClose, amount, orderId, onPaymentConfirmed }) {
    const toast = useToast();
    const [selectedSystem, setSelectedSystem] = useState('payme');
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const system = PAYMENT_SYSTEMS[selectedSystem];
    const paymentUrl = selectedSystem === 'click'
        ? system.generateUrl(system.merchantId, amount, orderId, system.serviceId)
        : system.generateUrl(system.merchantId, amount, orderId);

    const isDemo = system.merchantId.includes('DEMO');

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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2><QrCode size={24} /> QR-оплата</h2>
                    <button onClick={onClose} className="btn-close">×</button>
                </div>

                <div className="modal-body">
                    {/* Предупреждение демо */}
                    {isDemo && (
                        <div className="alert alert-warning" style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: '#fff3cd', color: '#856404' }}>
                            ⚠️ Демо-режим. Настройте Merchant ID в компоненте QRPaymentModal.
                        </div>
                    )}

                    {/* Сумма */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <p style={{ color: '#666', margin: 0 }}>К оплате:</p>
                        <h2 style={{ color: '#10b981', fontSize: '32px', margin: '8px 0' }}>{formatCurrency(amount)}</h2>
                        <p style={{ color: '#888', fontSize: '14px' }}>Заказ: {orderId}</p>
                    </div>

                    {/* Выбор системы */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                        {Object.values(PAYMENT_SYSTEMS).map(sys => (
                            <button
                                key={sys.id}
                                className={`btn ${selectedSystem === sys.id ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                    background: selectedSystem === sys.id ? sys.color : undefined,
                                    borderColor: sys.color
                                }}
                                onClick={() => setSelectedSystem(sys.id)}
                            >
                                {sys.icon} {sys.name}
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
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '16px' }}>
                        Отсканируйте QR-код в приложении <strong>{system.name}</strong>
                    </p>

                    {/* Ссылка */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleCopyLink}
                        >
                            <Copy size={16} /> {copied ? 'Скопировано!' : 'Копировать ссылку'}
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => window.open(paymentUrl, '_blank')}
                        >
                            <ExternalLink size={16} /> Открыть
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
