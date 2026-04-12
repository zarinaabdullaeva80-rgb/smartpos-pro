import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, IconButton, Surface, Badge, Chip, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { reportsAPI, shiftsAPI } from '../services/api';
import { OfflineManager } from '../services/offline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function HomeScreen({ navigation, onLogout }) {
    const { colors, isDark } = useTheme();
    const [user, setUser] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [pendingSalesCount, setPendingSalesCount] = useState(0);
    const [isOnline, setIsOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftStats, setShiftStats] = useState(null);

    useEffect(() => {
        const initData = async () => {
            await loadData();
            const shift = await loadShift();
            if (shift) await loadShiftStats(shift.id);
            await loadOfflineStatus();
        };
        initData();

        // Обновлять статус каждые 5 секунд
        const interval = setInterval(loadOfflineStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    // Обновлять данные при возврате на экран
    useFocusEffect(
        React.useCallback(() => {
            const refreshData = async () => {
                await loadData();
                const shift = await loadShift();
                if (shift) await loadShiftStats(shift.id);
                await loadOfflineStatus();
            };
            refreshData();
        }, [])
    );

    const loadData = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            }

            const response = await reportsAPI.getDashboard();
            setDashboard(response.data.dashboard);
        } catch (error) {
            console.error('[Home] Error loading data:', error);
        }
    };

    const loadShift = async () => {
        try {
            const response = await shiftsAPI.getCurrent();
            const shift = response.data?.shift || null;
            setCurrentShift(shift);
            return shift;
        } catch (error) {
            console.error('[Home] Error loading shift:', error);
            setCurrentShift(null);
            return null;
        }
    };

    const loadShiftStats = async (shiftId) => {
        try {
            if (!shiftId) {
                setShiftStats(null);
                return;
            }

            const response = await shiftsAPI.getStats(shiftId);
            setShiftStats(response.data?.stats || null);
        } catch (error) {
            console.error('[Home] Error loading shift stats:', error);
            setShiftStats(null);
        }
    };

    const handleOpenShift = async () => {
        try {
            const response = await shiftsAPI.open(0);
            setCurrentShift(response.data.shift);
            // alert удалён - смена открывается молча
        } catch (error) {
            console.error('[Home] Error opening shift:', error);
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось открыть смену');
        }
    };

    const handleCloseShift = async () => {
        if (!currentShift) return;

        Alert.alert(
            'Закрыть смену?',
            'Вы уверены что хотите закрыть смену?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Закрыть',
                    onPress: async () => {
                        try {
                            const response = await shiftsAPI.close(currentShift.id, {
                                closing_cash: 0,
                                notes: ''
                            });

                            // Рассчитать длительность смены
                            const shift = response.data.shift;
                            const opened = new Date(shift.opened_at);
                            const closed = new Date(shift.closed_at);
                            const durationMs = closed - opened;
                            const hours = Math.floor(durationMs / (1000 * 60 * 60));
                            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                            setCurrentShift(null);
                            Alert.alert(
                                'Смена закрыта',
                                `Продаж: ${shift.sales_count}\nСумма: ${shift.total_sales} UZS\nВремя работы: ${hours}ч ${minutes}мин`
                            );
                        } catch (error) {
                            console.error('[Home] Error closing shift:', error);
                            Alert.alert('Ошибка', 'Не удалось закрыть смену');
                        }
                    }
                }
            ]
        );
    };

    const loadOfflineStatus = async () => {
        try {
            const stats = await OfflineManager.getCacheStats();
            setPendingSalesCount(stats.pendingSalesCount);
            setIsOnline(stats.isOnline);
        } catch (error) {
            console.error('[Home] Error loading offline status:', error);
        }
    };

    const handleManualSync = async () => {
        if (pendingSalesCount === 0) {
            Alert.alert('Информация', 'Нет продаж для синхронизации');
            return;
        }

        if (!isOnline) {
            Alert.alert('Нет подключения', 'Невозможно синхронизировать без интернета');
            return;
        }

        setSyncing(true);
        try {
            const result = await OfflineManager.syncSalesQueue();

            if (result.success > 0) {
                Alert.alert(
                    'Синхронизация завершена',
                    `Успешно отправлено: ${result.success}\nОшибок: ${result.failed}`
                );
                await loadOfflineStatus();
            } else {
                Alert.alert('Информация', 'Нет новых данных для синхронизации');
            }
        } catch (error) {
            console.error('[Home] Manual sync error:', error);
            Alert.alert('Ошибка', 'Не удалось синхронизировать данные');
        } finally {
            setSyncing(false);
        }
    };

    const formatCurrency = (value) => {
        return Math.round(value || 0).toLocaleString('ru-RU') + " UZS";
    };

    const isAdmin = user?.role === 'admin' || user?.role === 'Администратор';

    // Динамические стили на основе темы
    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Title style={[styles.greeting, dynamicStyles.text]} numberOfLines={1}>
                        Здравствуйте, {user?.fullName || user?.username || 'Гость'}!
                    </Title>
                    <Chip style={{ alignSelf: 'flex-start', backgroundColor: isAdmin ? colors.primary : colors.success }} textStyle={{ color: '#fff', fontSize: 10 }}>
                        {isAdmin ? 'Администратор' : 'Кассир'}
                    </Chip>
                </View>
                <IconButton
                    icon="logout"
                    iconColor="#fff"
                    mode="contained"
                    containerColor={colors.error}
                    size={24}
                    onPress={onLogout}
                />
            </View>

            {/* Статус сети и неотправленных продаж */}
            <View style={styles.statusContainer}>
                <Chip
                    icon={isOnline ? 'wifi' : 'wifi-off'}
                    style={[styles.statusChip, isOnline ? styles.onlineChip : styles.offlineChip]}
                    textStyle={styles.statusChipText}
                >
                    {isOnline ? 'Онлайн' : 'Оффлайн'}
                </Chip>

                {pendingSalesCount > 0 && (
                    <Chip
                        icon="sync"
                        style={styles.pendingChip}
                        textStyle={styles.pendingChipText}
                        onPress={handleManualSync}
                    >
                        {pendingSalesCount} {pendingSalesCount === 1 ? 'продажа' : pendingSalesCount < 5 ? 'продажи' : 'продаж'} ожидает
                    </Chip>
                )}
            </View>

            {/* Stats */}
            {dashboard && (
                <View style={styles.statsContainer}>
                    <Surface style={styles.statCard}>
                        <Paragraph style={styles.statLabel}>Продажи сегодня</Paragraph>
                        <Title style={styles.statValue}>{formatCurrency(dashboard?.todaySales?.amount)}</Title>
                        <Paragraph style={styles.statMeta}>{dashboard?.todaySales?.count || 0} транз.</Paragraph>
                    </Surface>

                    <Surface style={styles.statCard}>
                        <Paragraph style={styles.statLabel}>Всего за месяц</Paragraph>
                        <Title style={styles.statValue}>{formatCurrency(dashboard?.monthSales?.amount)}</Title>
                        <Paragraph style={styles.statMeta}>{dashboard?.monthSales?.count || 0} транз.</Paragraph>
                    </Surface>
                </View>
            )}

            {/* Смена кассира */}
            <Card style={styles.card}>
                <Card.Content>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Title>Смена кассира</Title>
                        {currentShift && (
                            <Chip mode="flat" style={{ backgroundColor: colors.success }}>
                                <Paragraph style={{ color: '#fff', fontSize: 12 }}>Открыта</Paragraph>
                            </Chip>
                        )}
                    </View>
                    {currentShift ? (
                        <View>
                            <Paragraph style={{ marginBottom: 12, color: colors.textSecondary }}>
                                Начало: {new Date(currentShift.opened_at).toLocaleString('ru-RU')}
                            </Paragraph>
                            <Button
                                mode="contained"
                                onPress={handleCloseShift}
                                buttonColor={colors.error}
                                icon="close-circle"
                            >
                                Закрыть смену
                            </Button>
                        </View>
                    ) : (
                        <Button
                            mode="contained"
                            onPress={handleOpenShift}
                            icon="check-circle"
                            buttonColor={colors.primary}
                        >
                            Открыть смену
                        </Button>
                    )}
                </Card.Content>
            </Card>

            {/* Actions */}
            <View style={styles.actions}>
                <Card style={styles.actionCard} onPress={() => navigation.navigate('Products')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="cart" iconColor="#10b981" />
                        <View>
                            <Title>Новая продажа</Title>
                            <Paragraph>Выбор товаров и оформление</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('SalesHistory')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="file-document" iconColor="#3b82f6" />
                        <View style={styles.actionTextContainer}>
                            <View style={styles.actionTitleRow}>
                                <Title>История продаж</Title>
                                {pendingSalesCount > 0 && (
                                    <Badge style={styles.badge}>{pendingSalesCount}</Badge>
                                )}
                            </View>
                            <Paragraph>Просмотр всех чеков</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Returns')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="keyboard-return" iconColor="#ef4444" />
                        <View style={styles.actionTextContainer}>
                            <Title>Возвраты</Title>
                            <Paragraph>Возврат товара по чеку</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Reports')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="chart-bar" iconColor="#8b5cf6" />
                        <View>
                            <Title>Отчёты и выручка</Title>
                            <Paragraph>Дневная и месячная статистика</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Customers')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="account-group" iconColor="#06b6d4" />
                        <View>
                            <Title>Клиенты</Title>
                            <Paragraph>База клиентов и скидки</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Inventory')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="clipboard-check" iconColor="#84cc16" />
                        <View>
                            <Title>Инвентаризация</Title>
                            <Paragraph>Просмотр остатков на складе</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Loyalty')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="gift" iconColor="#e91e63" />
                        <View>
                            <Title>Лояльность</Title>
                            <Paragraph>Баллы и программа лояльности</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Sync')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="sync" iconColor="#2196f3" />
                        <View>
                            <Title>Синхронизация</Title>
                            <Paragraph>Обмен данными с 1С</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={styles.actionCard} onPress={() => navigation.navigate('Notifications')}>
                    <Card.Content style={styles.actionContent}>
                        <IconButton icon="bell" iconColor="#ff9800" />
                        <View>
                            <Title>Уведомления</Title>
                            <Paragraph>Сообщения и оповещения</Paragraph>
                        </View>
                    </Card.Content>
                </Card>

                {isAdmin && (
                    <>
                        <Divider style={{ marginVertical: 10, opacity: 0.2 }} />
                        <Title style={{ marginLeft: 16, marginBottom: 8, fontSize: 16, color: colors.textSecondary }}>Администрирование</Title>

                        <Card style={styles.actionCard} onPress={() => navigation.navigate('CashierSwitch')}>
                            <Card.Content style={styles.actionContent}>
                                <IconButton icon="account-switch" iconColor="#ec4899" />
                                <View>
                                    <Title>Кассиры</Title>
                                    <Paragraph>Управление доступом</Paragraph>
                                </View>
                            </Card.Content>
                        </Card>

                        <Card style={styles.actionCard} onPress={() => navigation.navigate('Settings')}>
                            <Card.Content style={styles.actionContent}>
                                <IconButton icon="cog" iconColor="#94a3b8" />
                                <View>
                                    <Title>Настройки</Title>
                                    <Paragraph>Принтер, синхронизация и БД</Paragraph>
                                </View>
                            </Card.Content>
                        </Card>
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingRight: 12,
    },
    headerText: {
        flex: 1,
        marginRight: 12,
    },
    greeting: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#f1f5f9',
    },
    subtitle: {
        color: '#94a3b8',
    },
    statusContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 10,
        gap: 10,
    },
    statusChip: {
        borderWidth: 1,
    },
    onlineChip: {
        backgroundColor: '#10b98120',
        borderColor: '#10b981',
    },
    offlineChip: {
        backgroundColor: '#ef444420',
        borderColor: '#ef4444',
    },
    statusChipText: {
        fontSize: 12,
    },
    pendingChip: {
        backgroundColor: '#f59e0b20',
        borderColor: '#f59e0b',
        borderWidth: 1,
    },
    pendingChipText: {
        fontSize: 12,
        color: '#f59e0b',
    },
    warningCard: {
        marginHorizontal: 20,
        marginBottom: 10,
        backgroundColor: '#78350f20',
        borderColor: '#f59e0b',
        borderWidth: 1,
    },
    warningContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    warningText: {
        flex: 1,
    },
    warningTitle: {
        fontSize: 16,
        color: '#f59e0b',
        marginBottom: 4,
    },
    warningDescription: {
        fontSize: 13,
        color: '#cbd5e1',
    },
    syncButton: {
        borderColor: '#f59e0b',
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 10,
        gap: 10,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#1e293b',
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#10b981',
    },
    statMeta: {
        fontSize: 12,
        color: '#cbd5e1',
    },
    actions: {
        padding: 10,
    },
    actionCard: {
        marginBottom: 16,
        backgroundColor: '#1e293b',
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        backgroundColor: '#f59e0b',
    },
});
