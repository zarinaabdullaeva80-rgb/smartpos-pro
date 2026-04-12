/**
 * Loader - компонент индикатора загрузки
 * Варианты: spinner, skeleton, button
 */

import React from 'react';

// Spinner загрузки
export function Spinner({ size = 'md', color = '#6366f1' }) {
    const sizes = {
        sm: 20,
        md: 32,
        lg: 48,
        xl: 64
    };

    const pixelSize = sizes[size] || size;

    return (
        <div style={{
            width: pixelSize,
            height: pixelSize,
            border: `3px solid ${color}20`,
            borderTop: `3px solid ${color}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
        }}>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

// Полноэкранный loader
export function FullPageLoader({ message = 'Загрузка...' }) {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(26, 26, 46, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            gap: '20px'
        }}>
            <Spinner size="xl" />
            <div style={{ color: 'white', fontSize: '18px' }}>
                {message}
            </div>
        </div>
    );
}

// Skeleton loader
export function Skeleton({ width = '100%', height = 20, borderRadius = 8 }) {
    return (
        <div style={{
            width,
            height,
            borderRadius,
            background: 'linear-gradient(90deg, #2a2a4a 25%, #3a3a5a 50%, #2a2a4a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite'
        }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
}

// Skeleton для таблицы
export function TableSkeleton({ rows = 5, columns = 4 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: '16px', padding: '12px 0' }}>
                {Array(columns).fill(0).map((_, i) => (
                    <Skeleton key={i} height={16} width={`${100 / columns}%`} />
                ))}
            </div>
            {/* Rows */}
            {Array(rows).fill(0).map((_, rowIndex) => (
                <div key={rowIndex} style={{ display: 'flex', gap: '16px', padding: '16px 0' }}>
                    {Array(columns).fill(0).map((_, colIndex) => (
                        <Skeleton
                            key={colIndex}
                            height={20}
                            width={`${100 / columns}%`}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Skeleton для карточек
export function CardSkeleton({ count = 3 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {Array(count).fill(0).map((_, i) => (
                <div key={i} style={{
                    background: '#1e1e3f',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <Skeleton height={24} width="60%" />
                    <Skeleton height={40} width="100%" />
                    <Skeleton height={16} width="80%" />
                    <Skeleton height={16} width="40%" />
                </div>
            ))}
        </div>
    );
}

// Button с loading состоянием
export function LoadingButton({
    children,
    loading = false,
    disabled = false,
    onClick,
    variant = 'primary',
    ...props
}) {
    const variants = {
        primary: {
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white'
        },
        secondary: {
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#6366f1',
            border: '1px solid #6366f1'
        },
        danger: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white'
        }
    };

    const style = variants[variant] || variants.primary;

    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            style={{
                ...style,
                padding: '12px 24px',
                borderRadius: '10px',
                border: style.border || 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || disabled ? 'not-allowed' : 'pointer',
                opacity: loading || disabled ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                minWidth: '120px'
            }}
            {...props}
        >
            {loading && <Spinner size="sm" color="white" />}
            {children}
        </button>
    );
}

// Overlay loader для контейнеров
export function OverlayLoader({ loading, children }) {
    return (
        <div style={{ position: 'relative' }}>
            {children}
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(26, 26, 46, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'inherit',
                    zIndex: 10
                }}>
                    <Spinner size="lg" />
                </div>
            )}
        </div>
    );
}

export default Spinner;
