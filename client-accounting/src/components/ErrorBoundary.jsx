import React, { Component } from 'react';
import { errorsAPI } from '../services/api';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });

        // Отправляем ошибку на сервер
        errorsAPI.report({
            type: 'frontend_runtime',
            severity: 'critical',
            message: error.toString(),
            stack_trace: errorInfo.componentStack,
            component: 'ErrorBoundary',
            url: window.location.href,
            metadata: {
                errorName: error.name,
                errorMessage: error.message
            }
        }).catch(err => console.error('Failed to report runtime error:', err));
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-primary, #0f0d1a)',
                    padding: '20px'
                }}>
                    <div style={{
                        maxWidth: '480px',
                        width: '100%',
                        background: 'var(--bg-secondary, #1a1625)',
                        borderRadius: '16px',
                        padding: '40px 32px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border-color, #2a2438)',
                        textAlign: 'center'
                    }}>
                        {/* Иконка */}
                        <div style={{
                            width: '72px', height: '72px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <svg width="36" height="36" fill="none" stroke="#ef4444" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>

                        <h2 style={{
                            fontSize: '22px', fontWeight: 700,
                            color: 'var(--text-primary, #e8e2f4)',
                            marginBottom: '10px'
                        }}>
                            Что-то пошло не так
                        </h2>

                        <p style={{
                            color: 'var(--text-muted, #8b7faa)',
                            fontSize: '14px',
                            marginBottom: '24px',
                            lineHeight: 1.5
                        }}>
                            Произошла ошибка при загрузке страницы.
                            Попробуйте обновить или вернуться на главную.
                        </p>

                        {/* Детали ошибки (dev mode) */}
                        {this.state.error && (
                            <details style={{
                                marginBottom: '24px',
                                textAlign: 'left',
                                background: 'rgba(239, 68, 68, 0.08)',
                                borderRadius: '10px',
                                padding: '14px',
                                border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                                <summary style={{
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    fontSize: '13px',
                                    fontWeight: 600
                                }}>
                                    🔍 Подробности ошибки
                                </summary>
                                <pre style={{
                                    marginTop: '10px',
                                    fontSize: '12px',
                                    color: '#f87171',
                                    overflow: 'auto',
                                    maxHeight: '200px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontFamily: '"Fira Code", "Consolas", monospace'
                                }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                🔄 Попробовать снова
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                style={{
                                    flex: 1,
                                    padding: '12px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color, #2a2438)',
                                    background: 'var(--bg-primary, #0f0d1a)',
                                    color: 'var(--text-primary, #e8e2f4)',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                🏠 На главную
                            </button>
                        </div>

                        <p style={{
                            color: 'var(--text-muted, #6b6085)',
                            fontSize: '12px',
                            marginTop: '20px'
                        }}>
                            Если проблема повторяется, обратитесь в поддержку
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
