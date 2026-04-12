/**
 * ErrorBoundary - перехватчик ошибок для React Native
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ErrorReporter from '../services/errorReporter';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });

        // Report error
        ErrorReporter.report({
            severity: 'critical',
            message: error.message || String(error),
            stack_trace: error.stack,
            component: 'ErrorBoundary',
            metadata: { componentStack: errorInfo?.componentStack }
        });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.emoji}>💥</Text>
                    <Text style={styles.title}>Что-то пошло не так</Text>
                    <Text style={styles.subtitle}>
                        Произошла непредвиденная ошибка
                    </Text>

                    {__DEV__ && this.state.error && (
                        <ScrollView style={styles.errorContainer}>
                            <Text style={styles.errorText}>
                                {this.state.error.toString()}
                            </Text>
                            {this.state.errorInfo?.componentStack && (
                                <Text style={styles.stackText}>
                                    {this.state.errorInfo.componentStack}
                                </Text>
                            )}
                        </ScrollView>
                    )}

                    <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
                        <Text style={styles.buttonText}>Попробовать снова</Text>
                    </TouchableOpacity>

                    {this.props.onError && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => this.props.onError(this.state.error)}
                        >
                            <Text style={styles.secondaryButtonText}>
                                Сообщить об ошибке
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#0f172a'
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 16,
        color: '#a0aec0',
        textAlign: 'center',
        marginBottom: 24
    },
    errorContainer: {
        maxHeight: 200,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        width: '100%'
    },
    errorText: {
        color: '#ef4444',
        fontSize: 12,
        fontFamily: 'monospace'
    },
    stackText: {
        color: '#a0aec0',
        fontSize: 10,
        fontFamily: 'monospace',
        marginTop: 8
    },
    button: {
        backgroundColor: '#6366f1',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginBottom: 12
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24
    },
    secondaryButtonText: {
        color: '#6366f1',
        fontSize: 14
    }
});

export default ErrorBoundary;
