/**
 * LoadingOverlay - полноэкранный индикатор загрузки
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';

export function LoadingOverlay({
    visible = false,
    message = 'Загрузка...',
    transparent = true
}) {
    if (!visible) return null;

    return (
        <Modal
            transparent={transparent}
            animationType="fade"
            visible={visible}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={styles.message}>{message}</Text>
                </View>
            </View>
        </Modal>
    );
}

// Inline loader
export function InlineLoader({ message = 'Загрузка...', style }) {
    return (
        <View style={[styles.inline, style]}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.inlineMessage}>{message}</Text>
        </View>
    );
}

// Pull to refresh colors
export const refreshColors = ['#6366f1', '#8b5cf6', '#a78bfa'];

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    container: {
        backgroundColor: '#1e1e3f',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        minWidth: 150
    },
    message: {
        marginTop: 16,
        color: '#fff',
        fontSize: 16
    },
    inline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12
    },
    inlineMessage: {
        marginLeft: 12,
        color: '#a0aec0',
        fontSize: 14
    }
});

export default LoadingOverlay;
