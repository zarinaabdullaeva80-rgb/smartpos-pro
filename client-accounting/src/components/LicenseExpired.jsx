import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function LicenseExpired({ expiryDate }) {
    const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric'
    }) : '';

    const handleExit = () => {
        if (window.electron && window.electron.quitApp) {
            window.electron.quitApp();
        } else {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '20px',
                padding: '48px',
                maxWidth: '480px',
                textAlign: 'center',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.5s ease-out',
            }}>
                <div style={{
                    width: '80px', height: '80px', margin: '0 auto 24px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <AlertTriangle size={40} color="#ef4444" />
                </div>

                <h1 style={{
                    color: '#ef4444', fontSize: '24px', fontWeight: 700,
                    margin: '0 0 12px',
                }}>
                    Лицензия истекла
                </h1>

                <p style={{
                    color: '#94a3b8', fontSize: '16px', lineHeight: 1.6,
                    margin: '0 0 8px',
                }}>
                    Срок действия вашей лицензии SmartPOS Pro истёк
                    {formattedDate && <><br /><strong style={{ color: '#e2e8f0' }}>{formattedDate}</strong></>}
                </p>

                <p style={{
                    color: '#64748b', fontSize: '14px',
                    margin: '0 0 32px',
                }}>
                    Для продления лицензии свяжитесь с администратором
                </p>

                <button onClick={handleExit} style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    padding: '14px 40px', fontSize: '16px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                }}>
                    Закрыть приложение
                </button>
            </div>
        </div>
    );
}
