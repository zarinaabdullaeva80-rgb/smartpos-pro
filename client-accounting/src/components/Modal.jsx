/**
 * Modal - универсальный компонент модального окна
 * С анимациями, overlay, и различными размерами
 */

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

// Размеры окна
const sizes = {
    sm: '400px',
    md: '560px',
    lg: '720px',
    xl: '900px',
    full: '95vw'
};

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
    closeOnOverlay = true,
    closeOnEsc = true,
    footer = null
}) {
    // Закрытие по Escape
    useEffect(() => {
        if (!closeOnEsc || !isOpen) return;

        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, closeOnEsc]);

    // Блокировка скролла при открытии
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9998,
                padding: '20px',
                animation: 'fadeIn 0.2s ease'
            }}
            onClick={closeOnOverlay ? onClose : undefined}
        >
            <div
                style={{
                    background: 'linear-gradient(145deg, #1e1e3f 0%, #16162a 100%)',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: sizes[size] || sizes.md,
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    animation: 'slideUp 0.3s ease'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {title && (
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'white'
                        }}>
                            {title}
                        </h2>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            >
                                <X size={20} color="#a0aec0" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    color: '#e2e8f0'
                }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px'
                    }}>
                        {footer}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}

// Confirm модалка
export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Подтверждение',
    message,
    confirmText = 'Подтвердить',
    cancelText = 'Отмена',
    variant = 'danger'
}) {
    const variants = {
        danger: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        },
        primary: {
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
        },
        warning: {
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: '#a0aec0',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            ...variants[variant],
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {confirmText}
                    </button>
                </>
            }
        >
            <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
        </Modal>
    );
}

export default Modal;
