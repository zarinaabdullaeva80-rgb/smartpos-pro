import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, Chip, IconButton, ActivityIndicator, Divider, Button } from 'react-native-paper';
import { notificationsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function NotificationsScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const res = await notificationsAPI.getAll();
            const data = res.data?.notifications || res.data || [];
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        } catch (error) {
            console.error('Error loading notifications:', error);
            setNotifications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await notificationsAPI.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationsAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            SoundManager.playSuccess();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'sale': return 'cart';
            case 'sync': return 'sync';
            case 'alert': return 'alert';
            case 'inventory': return 'package-variant';
            case 'loyalty': return 'gift';
            case 'system': return 'cog';
            default: return 'bell';
        }
    };

    const getColor = (type, priority) => {
        if (priority === 'high') return '#F44336';
        if (priority === 'medium') return '#FF9800';
        switch (type) {
            case 'sale': return '#4CAF50';
            case 'sync': return '#2196F3';
            case 'alert': return '#F44336';
            case 'inventory': return '#9C27B0';
            case 'loyalty': return '#E91E63';
            default: return '#9E9E9E';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        return date.toLocaleDateString('ru-RU');
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    const renderItem = useCallback(({ item }) => (
        <Card
            style={[
                styles.card,
                dynamicStyles.card,
                !item.read && styles.unreadCard
            ]}
            onPress={() => markAsRead(item.id)}
        >
            <Card.Content>
                <View style={styles.row}>
                    <View style={[styles.iconContainer, { backgroundColor: getColor(item.type, item.priority) }]}>
                        <IconButton icon={getIcon(item.type)} iconColor="white" size={20} />
                    </View>
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Title style={[styles.title, dynamicStyles.text]}>{item.title}</Title>
                            {!item.read && <View style={styles.unreadDot} />}
                        </View>
                        <Paragraph style={dynamicStyles.textSecondary}>{item.message || item.body}</Paragraph>
                        <Paragraph style={[styles.time, dynamicStyles.textSecondary]}>
                            {formatDate(item.created_at || item.date)}
                        </Paragraph>
                    </View>
                </View>
            </Card.Content>
        </Card>
    ), [colors]);

    if (loading) {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Paragraph style={dynamicStyles.textSecondary}>Загрузка...</Paragraph>
            </View>
        );
    }

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Заголовок */}
            <View style={styles.header}>
                <View>
                    <Title style={dynamicStyles.text}>🔔 Уведомления</Title>
                    {unreadCount > 0 && (
                        <Chip compact style={styles.badge}>
                            {unreadCount} непрочитанных
                        </Chip>
                    )}
                </View>
                {unreadCount > 0 && (
                    <Button mode="text" onPress={markAllAsRead} icon="check-all">
                        Прочитать все
                    </Button>
                )}
            </View>

            <Divider />

            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadNotifications(); }}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Paragraph style={dynamicStyles.textSecondary}>Уведомлений нет</Paragraph>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    badge: { marginTop: 4 },
    list: { padding: 16 },
    card: { marginBottom: 12 },
    unreadCard: { borderLeftWidth: 4, borderLeftColor: '#2196F3' },
    row: { flexDirection: 'row' },
    iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    content: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 14, fontWeight: 'bold', flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2196F3', marginLeft: 8 },
    time: { fontSize: 11, marginTop: 4 },
    empty: { alignItems: 'center', padding: 40 },
});
