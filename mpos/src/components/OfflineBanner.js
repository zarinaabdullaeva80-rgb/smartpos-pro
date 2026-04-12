import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useConnection } from '../context/ConnectionContext';

/**
 * Глобальный баннер статуса подключения
 * Показывается вверху экрана когда сервер недоступен или идёт синхронизация
 */
export default function OfflineBanner() {
    const { isOnline, isServerReachable, isSyncing, pendingSalesCount, triggerSync } = useConnection();
    const [visible, setVisible] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const slideAnim = useState(new Animated.Value(-60))[0];

    const shouldShow = !isServerReachable || isSyncing || syncSuccess;

    useEffect(() => {
        if (shouldShow && !visible) {
            setVisible(true);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        } else if (!shouldShow && visible) {
            Animated.timing(slideAnim, {
                toValue: -60,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setVisible(false));
        }
    }, [shouldShow]);

    // Кратковременный "Синхронизировано ✓" после синхронизации
    useEffect(() => {
        if (isServerReachable && !isSyncing && pendingSalesCount === 0) {
            // Показать "Синхронизировано" на 3 секунды
            // Но только если были ожидающие продажи
        }
    }, [isServerReachable, isSyncing, pendingSalesCount]);

    if (!visible && !shouldShow) return null;

    // Определяем стиль и текст
    let backgroundColor, icon, text;
    if (isSyncing) {
        backgroundColor = '#F59E0B'; // жёлтый
        icon = 'cloud-sync';
        text = `Синхронизация... ${pendingSalesCount > 0 ? `(${pendingSalesCount} продаж)` : ''}`;
    } else if (!isOnline) {
        backgroundColor = '#EF4444'; // красный
        icon = 'wifi-off';
        text = `Нет сети${pendingSalesCount > 0 ? ` • ${pendingSalesCount} продаж в очереди` : ''}`;
    } else if (!isServerReachable) {
        backgroundColor = '#F97316'; // оранжевый
        icon = 'cloud-off-outline';
        text = `Сервер недоступен${pendingSalesCount > 0 ? ` • ${pendingSalesCount} в очереди` : ''}`;
    } else {
        backgroundColor = '#10B981'; // зелёный
        icon = 'cloud-check';
        text = 'Синхронизировано ✓';
    }

    return (
        <Animated.View style={[styles.container, { backgroundColor, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.content}>
                <MaterialCommunityIcons name={icon} size={18} color="#FFF" />
                <Text style={styles.text}>{text}</Text>
                {!isSyncing && isOnline && !isServerReachable && (
                    <TouchableOpacity onPress={triggerSync} style={styles.retryButton}>
                        <MaterialCommunityIcons name="refresh" size={16} color="#FFF" />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: 4,
        paddingBottom: 6,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 8,
    },
    retryButton: {
        marginLeft: 12,
        padding: 4,
    },
});
