/**
 * Toast - уведомления для React Native
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';

const ToastContext = createContext(null);

// Конфигурация типов
const toastConfig = {
    success: { bg: '#10b981', icon: '✓' },
    error: { bg: '#ef4444', icon: '✕' },
    warning: { bg: '#f59e0b', icon: '⚠' },
    info: { bg: '#6366f1', icon: 'ℹ' }
};

// Один Toast
function ToastItem({ toast, onHide }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;
    const config = toastConfig[toast.type] || toastConfig.info;

    useEffect(() => {
        // Show animation
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();

        // Auto hide
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true })
            ]).start(() => onHide(toast.id));
        }, toast.duration);

        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View style={[
            styles.toast,
            { backgroundColor: config.bg, opacity, transform: [{ translateY }] }
        ]}>
            <Text style={styles.icon}>{config.icon}</Text>
            <View style={styles.content}>
                {toast.title && <Text style={styles.title}>{toast.title}</Text>}
                <Text style={styles.message}>{toast.message}</Text>
            </View>
            <TouchableOpacity onPress={() => onHide(toast.id)} style={styles.close}>
                <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// Provider
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const show = useCallback(({ type = 'info', title, message, duration = 3000 }) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
        return id;
    }, []);

    const hide = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const success = useCallback((message, title) => show({ type: 'success', message, title }), [show]);
    const error = useCallback((message, title) => show({ type: 'error', message, title }), [show]);
    const warning = useCallback((message, title) => show({ type: 'warning', message, title }), [show]);
    const info = useCallback((message, title) => show({ type: 'info', message, title }), [show]);

    return (
        <ToastContext.Provider value={{ show, hide, success, error, warning, info }}>
            {children}
            <View style={styles.container} pointerEvents="box-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onHide={hide} />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

// Hook
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        zIndex: 9999
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
    },
    icon: {
        fontSize: 18,
        color: '#fff',
        marginRight: 12
    },
    content: {
        flex: 1
    },
    title: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
        marginBottom: 2
    },
    message: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14
    },
    close: {
        padding: 4
    },
    closeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16
    }
});

export default ToastProvider;
