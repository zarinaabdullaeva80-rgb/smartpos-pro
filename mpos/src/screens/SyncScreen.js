import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, AppState } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider, List, ActivityIndicator, ProgressBar, Badge } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAPI, healthAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';
import Sync1CService from '../services/sync1c';
import SocketService from '../services/socketService';

export default function SyncScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [serverHealth, setServerHealth] = useState(null);
    const [syncHistory, setSyncHistory] = useState([]);
    const [socketStatus, setSocketStatus] = useState({ connected: false });
    const [lastProductSync, setLastProductSync] = useState(null);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        loadData();

        // Подписаться на события Socket.IO
        SocketService.subscribe('connect', 'SyncScreen', () => setSocketStatus({ connected: true }));
        SocketService.subscribe('disconnect', 'SyncScreen', () => setSocketStatus({ connected: false }));
        SocketService.subscribe('product:updated', 'SyncScreen', () => {
            // Обновить статус при изменении товара
            loadSyncStatus();
        });

        // Подписаться на изменения AppState (возврат из фона)
        const sub = AppState.addEventListener('change', nextState => {
            if (appState.current.match(/inactive|background/) && nextState === 'active') {
                loadData();
            }
            appState.current = nextState;
        });

        setSocketStatus(SocketService.getStatus());

        return () => {
            SocketService.unsubscribe('connect', 'SyncScreen');
            SocketService.unsubscribe('disconnect', 'SyncScreen');
            SocketService.unsubscribe('product:updated', 'SyncScreen');
            sub.remove();
        };
    }, []);

    const loadSyncStatus = async () => {
        try {
            const statusRes = await syncAPI.getStatus();
            setSyncStatus(statusRes.data);
        } catch (e) { setSyncStatus(null); }
    };

    const loadData = async () => {
        try {
            setLoading(true);

            const [healthRes, statusRes, historyRes] = await Promise.allSettled([
                healthAPI.check(),
                syncAPI.getStatus(),
                syncAPI.getHistory(),
            ]);

            setServerHealth(healthRes.status === 'fulfilled' ? healthRes.value.data : { status: 'offline' });
            setSyncStatus(statusRes.status === 'fulfilled' ? statusRes.value.data : null);
            setSyncHistory(historyRes.status === 'fulfilled' ? (historyRes.value.data?.history || []) : []);

            // Показать время последней дельта-синхронизации товаров
            try {
                const lastSync = await AsyncStorage.getItem('last_product_sync');
                setLastProductSync(lastSync);
            } catch (e) { /* ignore */ }

        } catch (error) {
            console.error('Error loading sync data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSync = async (type = 'all') => {
        try {
            setSyncing(true);
            if (type === 'products') {
                // Использовать умный дельта-импорт
                await Sync1CService.importProducts();
            } else if (type === 'inventory') {
                await Sync1CService.importInventory();
            } else {
                await Sync1CService.fullSync();
            }
            SoundManager.playSuccess?.();
            await loadData();
        } catch (error) {
            SoundManager.playError?.();
            console.error('Sync error:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleForceSync = async () => {
        try {
            setSyncing(true);
            // Сбросить временные метки → следующая синхронизация будет полной
            await Sync1CService.resetSyncTimestamps();
            await Sync1CService.fullSync();
            SoundManager.playSuccess?.();
            await loadData();
        } catch (error) {
            SoundManager.playError?.();
        } finally {
            setSyncing(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Н/Д';
        return new Date(dateStr).toLocaleString('ru-RU');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'success': case 'completed': return '#4CAF50';
            case 'running': case 'processing': return '#2196F3';
            case 'error': case 'failed': return '#F44336';
            case 'pending': return '#FF9800';
            case 'connected': return '#4CAF50';
            default: return '#9E9E9E';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'success': case 'completed': return 'Успешно';
            case 'running': case 'processing': return 'Выполняется';
            case 'error': case 'failed': return 'Ошибка';
            case 'pending': return 'Ожидание';
            case 'connected': return 'Подключен';
            default: return status || 'Неизвестно';
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Paragraph style={[styles.loadingText, dynamicStyles.textSecondary]}>Загрузка...</Paragraph>
            </View>
        );
    }

    const pendingChanges = syncStatus?.pendingChanges || 0;

    return (
        <ScrollView
            style={[styles.container, dynamicStyles.container]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
            }
        >
            {/* Статус сервера + Real-time */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🖥️ Статус сервера</Title>
                    <View style={styles.statusRow}>
                        <Chip
                            icon={serverHealth?.status === 'ok' || serverHealth?.status === 'online' ? 'check-circle' : 'alert-circle'}
                            style={{ backgroundColor: serverHealth?.status === 'ok' || serverHealth?.status === 'online' ? '#4CAF50' : '#F44336' }}
                            textStyle={{ color: 'white' }}
                        >
                            {serverHealth?.status === 'ok' || serverHealth?.status === 'online' ? 'Онлайн' : 'Офлайн'}
                        </Chip>
                        <Chip
                            icon={socketStatus.connected ? 'lightning-bolt' : 'lightning-bolt-off'}
                            style={{ backgroundColor: socketStatus.connected ? '#4CAF50' : '#9E9E9E' }}
                            textStyle={{ color: 'white' }}
                        >
                            Real-time {socketStatus.connected ? 'ON' : 'OFF'}
                        </Chip>
                    </View>
                    {serverHealth?.version && (
                        <Paragraph style={dynamicStyles.textSecondary}>Версия: {serverHealth.version}</Paragraph>
                    )}
                </Card.Content>
            </Card>

            {/* Ожидающие изменения */}
            {pendingChanges > 0 && (
                <Card style={[styles.card, { backgroundColor: '#FFF3E0' }]}>
                    <Card.Content>
                        <View style={styles.pendingRow}>
                            <Title style={{ color: '#E65100' }}>⏳ Ожидают синхронизации</Title>
                            <Badge style={{ backgroundColor: '#E65100' }} size={28}>{pendingChanges}</Badge>
                        </View>
                        <Paragraph style={{ color: '#E65100' }}>
                            {pendingChanges} продаж с мобильного ещё не синхронизированы с десктопом
                        </Paragraph>
                        <Button
                            mode="contained"
                            onPress={() => handleSync('sales')}
                            loading={syncing}
                            disabled={syncing}
                            style={{ marginTop: 8 }}
                            buttonColor="#E65100"
                            icon="upload"
                        >
                            Синхронизировать сейчас
                        </Button>
                    </Card.Content>
                </Card>
            )}

            {/* Синхронизация */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🔄 Синхронизация данных</Title>

                    {syncStatus && (
                        <>
                            <View style={styles.statusRow}>
                                <Chip
                                    icon={syncStatus.status === 'running' ? 'sync' : 'check'}
                                    style={{ backgroundColor: getStatusColor(syncStatus.status) }}
                                    textStyle={{ color: 'white' }}
                                >
                                    {getStatusLabel(syncStatus.status)}
                                </Chip>
                            </View>
                            {syncStatus.lastSync && (
                                <Paragraph style={dynamicStyles.textSecondary}>
                                    Последняя: {formatDate(syncStatus.lastSync)}
                                </Paragraph>
                            )}
                            {lastProductSync && (
                                <Paragraph style={dynamicStyles.textSecondary}>
                                    Товары (дельта): {formatDate(lastProductSync)}
                                </Paragraph>
                            )}
                        </>
                    )}

                    <Divider style={styles.divider} />

                    <View style={styles.buttonRow}>
                        <Button mode="contained" onPress={() => handleSync('products')}
                            loading={syncing} disabled={syncing} style={styles.syncButton} icon="package-variant">
                            Товары
                        </Button>
                        <Button mode="contained" onPress={() => handleSync('inventory')}
                            loading={syncing} disabled={syncing} style={styles.syncButton} icon="warehouse">
                            Остатки
                        </Button>
                    </View>

                    <Button mode="contained-tonal" onPress={() => handleSync('all')}
                        loading={syncing} disabled={syncing} style={styles.fullButton} icon="sync">
                        Синхронизировать всё
                    </Button>

                    <Button mode="outlined" onPress={handleForceSync}
                        loading={syncing} disabled={syncing} style={styles.fullButton} icon="refresh">
                        Полная синхронизация (сброс)
                    </Button>
                </Card.Content>
            </Card>

            {/* История */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>📋 История синхронизаций</Title>
                    {syncHistory.length === 0 ? (
                        <Paragraph style={dynamicStyles.textSecondary}>История пуста</Paragraph>
                    ) : (
                        syncHistory.slice(0, 15).map((item, index) => (
                            <List.Item
                                key={item.id || index}
                                title={item.sync_type || 'Синхронизация'}
                                description={`${formatDate(item.started_at)}${item.duration_ms ? ` (${Math.round(item.duration_ms / 1000)}с)` : ''}`}
                                left={() => <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />}
                                right={() => (
                                    <Chip compact style={{ backgroundColor: getStatusColor(item.status) }}>
                                        <Paragraph style={{ color: 'white', fontSize: 10 }}>
                                            {getStatusLabel(item.status)}
                                        </Paragraph>
                                    </Chip>
                                )}
                                style={{ paddingVertical: 4 }}
                            />
                        ))
                    )}
                </Card.Content>
            </Card>

            <View style={styles.bottomPadding} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    card: { margin: 16, marginBottom: 8 },
    loadingText: { marginTop: 16 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
    pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    divider: { marginVertical: 16 },
    buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    syncButton: { flex: 1 },
    fullButton: { marginTop: 8 },
    statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 14, marginLeft: 8 },
    bottomPadding: { height: 32 },
});
