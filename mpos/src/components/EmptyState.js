/**
 * EmptyState - компонент пустого состояния
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

export function EmptyState({
    icon = '📦',
    title = 'Нет данных',
    description = 'Здесь пока ничего нет',
    actionLabel,
    onAction,
    style
}) {
    return (
        <View style={[styles.container, style]}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            {actionLabel && onAction && (
                <Button
                    mode="contained"
                    onPress={onAction}
                    style={styles.button}
                    labelStyle={styles.buttonLabel}
                >
                    {actionLabel}
                </Button>
            )}
        </View>
    );
}

// Пресеты для разных ситуаций
export const EmptyStates = {
    products: {
        icon: '🛍️',
        title: 'Товары не найдены',
        description: 'Попробуйте изменить параметры поиска'
    },
    cart: {
        icon: '🛒',
        title: 'Корзина пуста',
        description: 'Добавьте товары для оформления продажи'
    },
    sales: {
        icon: '📊',
        title: 'Нет продаж',
        description: 'История продаж появится здесь'
    },
    customers: {
        icon: '👥',
        title: 'Нет клиентов',
        description: 'Добавьте первого клиента'
    },
    offline: {
        icon: '📶',
        title: 'Нет подключения',
        description: 'Проверьте интернет-соединение'
    },
    error: {
        icon: '⚠️',
        title: 'Ошибка загрузки',
        description: 'Попробуйте обновить страницу'
    },
    search: {
        icon: '🔍',
        title: 'Ничего не найдено',
        description: 'Попробуйте другой запрос'
    },
    returns: {
        icon: '↩️',
        title: 'Нет возвратов',
        description: 'История возвратов пуста'
    }
};

// Быстрый компонент с пресетом
export function EmptyStatePreset({ preset, ...props }) {
    const config = EmptyStates[preset] || EmptyStates.products;
    return <EmptyState {...config} {...props} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32
    },
    icon: {
        fontSize: 64,
        marginBottom: 16
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center'
    },
    description: {
        fontSize: 14,
        color: '#a0aec0',
        textAlign: 'center',
        lineHeight: 20
    },
    button: {
        marginTop: 24,
        borderRadius: 12,
        backgroundColor: '#6366f1'
    },
    buttonLabel: {
        fontWeight: '600'
    }
});

export default EmptyState;
