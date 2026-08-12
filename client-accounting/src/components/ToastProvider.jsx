import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

// Premium styles for different notification types
const toastStyles = {
    success: {
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        icon: CheckCircle
    },
    error: {
        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        icon: AlertCircle
    },
    warning: {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        icon: AlertTriangle
    },
    info: {
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        icon: Info
    }
};

// Notification container positioned at the top-right
function ToastContainer({ toasts, removeToast }) {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '400px'
        }}>
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

// Single Toast component
function Toast({ toast, onClose }) {
    const style = toastStyles[toast.type] || toastStyles.info;
    const Icon = style.icon;

    return (
        <div style={{
            background: style.background,
            color: 'white',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            animation: 'slideIn 0.3s ease',
            minWidth: '320px',
            position: 'relative'
        }}>
            <Icon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, paddingRight: '12px' }}>
                {toast.title && (
                    <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>
                        {toast.title}
                    </div>
                )}
                <div style={{ fontSize: '13px', opacity: 0.95, lineHeight: '1.4' }}>
                    {toast.message}
                </div>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    flexShrink: 0
                }}
            >
                <X size={14} color="white" />
            </button>
        </div>
    );
}

// Provider
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((optionsOrMsg, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        
        let toastOptions = {};
        if (typeof optionsOrMsg === 'string') {
            toastOptions = {
                message: optionsOrMsg,
                type: type,
                duration: duration
            };
        } else {
            toastOptions = {
                ...optionsOrMsg,
                type: optionsOrMsg.type || 'info',
                duration: optionsOrMsg.duration !== undefined ? optionsOrMsg.duration : 4000
            };
        }

        const toast = {
            id,
            type: toastOptions.type,
            title: toastOptions.title,
            message: toastOptions.message,
            duration: toastOptions.duration
        };

        setToasts(prev => [...prev, toast]);

        if (toast.duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, toast.duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const success = useCallback((message, duration) =>
        addToast(message, 'success', duration), [addToast]);

    const error = useCallback((message, duration) =>
        addToast(message, 'error', duration), [addToast]);

    const warning = useCallback((message, duration) =>
        addToast(message, 'warning', duration), [addToast]);

    const info = useCallback((message, duration) =>
        addToast(message, 'info', duration), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(120%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
};

// Hook
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

export default ToastProvider;
