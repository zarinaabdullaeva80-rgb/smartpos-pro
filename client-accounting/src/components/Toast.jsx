/**
 * Toast - компонент уведомлений
 * Типы: success, error, warning, info
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

// Стили для разных типов
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

// Контейнер уведомлений
function ToastContainer({ toasts, removeToast }) {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
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

// Одно уведомление
function Toast({ toast, onClose }) {
    const style = toastStyles[toast.type] || toastStyles.info;
    const Icon = style.icon;

    return (
        <div style={{
            background: style.background,
            color: 'white',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            animation: 'slideIn 0.3s ease',
            minWidth: '300px'
        }}>
            <Icon size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
                {toast.title && (
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        {toast.title}
                    </div>
                )}
                <div style={{ fontSize: '14px', opacity: 0.95 }}>
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
                    justifyContent: 'center'
                }}
            >
                <X size={16} color="white" />
            </button>
        </div>
    );
}

// Провайдер
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((options) => {
        const id = Date.now() + Math.random();
        const toast = {
            id,
            type: options.type || 'info',
            title: options.title,
            message: options.message,
            duration: options.duration || 4000
        };

        setToasts(prev => [...prev, toast]);

        // Автоматическое удаление
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

    // Хелперы
    const success = useCallback((message, title) =>
        addToast({ type: 'success', message, title }), [addToast]);

    const error = useCallback((message, title) =>
        addToast({ type: 'error', message, title }), [addToast]);

    const warning = useCallback((message, title) =>
        addToast({ type: 'warning', message, title }), [addToast]);

    const info = useCallback((message, title) =>
        addToast({ type: 'info', message, title }), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
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
}

// Хук для использования
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

export default ToastProvider;
