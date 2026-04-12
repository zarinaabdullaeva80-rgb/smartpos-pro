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
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
                        <div className="text-center mb-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                Что-то пошло не так
                            </h2>
                            <p className="text-gray-600 mb-4">
                                Произошла ошибка при загрузке приложения
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-300">
                                <p className="font-mono text-sm text-red-600 mb-2">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="cursor-pointer text-sm text-gray-700 font-medium">
                                            Stack trace
                                        </summary>
                                        <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-48">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                            >
                                Попробовать снова
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors"
                            >
                                На главную
                            </button>
                        </div>

                        <p className="text-center text-sm text-gray-500 mt-4">
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
