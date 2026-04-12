import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [state, setState] = useState({
        isOpen: false,
        title: '',
        message: '',
        variant: 'default',
        confirmText: 'Подтвердить',
        cancelText: 'Отмена',
        resolve: null
    });

    const confirm = useCallback(({ title, message, variant = 'default', confirmText, cancelText }) => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                title: title || 'Подтверждение',
                message,
                variant,
                confirmText: confirmText || (variant === 'danger' ? 'Удалить' : 'Подтвердить'),
                cancelText: cancelText || 'Отмена',
                resolve
            });
        });
    }, []);

    const handleConfirm = () => {
        state.resolve?.(true);
        setState(s => ({ ...s, isOpen: false }));
    };

    const handleCancel = () => {
        state.resolve?.(false);
        setState(s => ({ ...s, isOpen: false }));
    };

    const getIcon = () => {
        switch (state.variant) {
            case 'danger':
                return <Trash2 size={24} color="#dc2626" />;
            case 'warning':
                return <AlertTriangle size={24} color="#d97706" />;
            default:
                return <Info size={24} color="#3b82f6" />;
        }
    };

    const getConfirmStyle = () => {
        switch (state.variant) {
            case 'danger':
                return { background: '#dc2626', color: 'white', border: 'none' };
            case 'warning':
                return { background: '#d97706', color: 'white', border: 'none' };
            default:
                return {};
        }
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }} onClick={handleCancel}>
                    <div style={{
                        background: 'var(--bg-primary, white)', borderRadius: '16px',
                        padding: '24px', maxWidth: '420px', width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: state.variant === 'danger' ? '#fee2e2' :
                                    state.variant === 'warning' ? '#fef3c7' : '#dbeafe',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {getIcon()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>{state.title}</h3>
                                <p style={{ margin: 0, color: '#666', fontSize: '14px', lineHeight: 1.5 }}>
                                    {state.message}
                                </p>
                            </div>
                            <button onClick={handleCancel} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '4px', color: '#888'
                            }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{
                            display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px'
                        }}>
                            <button className="btn btn-secondary" onClick={handleCancel}>
                                {state.cancelText}
                            </button>
                            <button className="btn btn-primary" onClick={handleConfirm}
                                style={getConfirmStyle()}>
                                {state.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const confirm = useContext(ConfirmContext);
    if (!confirm) {
        // Fallback to window.confirm if ConfirmProvider not mounted
        return ({ message }) => Promise.resolve(window.confirm(message));
    }
    return confirm;
}

export default ConfirmProvider;
