import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Divider, Chip, DataTable } from 'react-native-paper';
import { shiftsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function ShiftManagementScreen({ navigation }) {
    const { colors } = useTheme();

    const [currentShift, setCurrentShift] = useState(null);
    const [shiftStats, setShiftStats] = useState(null);
    const [shiftsHistory, setShiftsHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openingCash, setOpeningCash] = useState('');
    const [elapsedTime, setElapsedTime] = useState('');

    useEffect(() => {
        loadData();
        const interval = setInterval(updateElapsedTime, 1000);
        return () => clearInterval(interval);
    }, [currentShift]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [shiftRes, historyRes] = await Promise.all([
                shiftsAPI.getCurrent().catch(() => ({ data: { shift: null } })),
                shiftsAPI.getAll().catch(() => ({ data: { shifts: [] } })),
            ]);
            setCurrentShift(shiftRes.data.shift);
            setShiftsHistory(historyRes.data.shifts || []);
            if (shiftRes.data.shift?.id) {
                const statsRes = await shiftsAPI.getStats(shiftRes.data.shift.id).catch(() => ({ data: {} }));
                setShiftStats(statsRes.data);
            }
        } catch (error) {
            console.error('[Shift] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateElapsedTime = () => {
        if (!currentShift?.opened_at && !currentShift?.started_at) return;
        const start = new Date(currentShift.opened_at || currentShift.started_at);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        setElapsedTime(`${hours}ч ${minutes}м ${seconds}с`);
    };

    const handleOpenShift = async () => {
        try {
            await shiftsAPI.open(parseFloat(openingCash) || 0);
            SoundManager.playSuccess();
            setOpeningCash('');
            loadData();
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', 'Не удалось открыть смену');
        }
    };

    const handleCloseShift = async () => {
        Alert.alert('Закрыть смену?', 'Все данные будут сохранены', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Закрыть', style: 'destructive', onPress: async () => {
                    try {
                        await shiftsAPI.close(currentShift.id, { closing_cash: 0, notes: '' });
                        SoundManager.playSuccess();
                        Alert.alert('Смена закрыта', `Продаж: ${shiftStats?.sales_count || 0}\nСумма: ${formatCurrency(shiftStats?.total_sales || 0)}`);
                        loadData();
                    } catch (error) {
                        SoundManager.playError();
                        Alert.alert('Ошибка', 'Не удалось закрыть смену');
                    }
                }
            }
        ]);
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            {/* Текущая смена */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <View style={styles.header}>
                        <Title style={dynamicStyles.text}>Текущая смена</Title>
                        {currentShift && <Chip style={{ backgroundColor: colors.success }} textStyle={{ color: '#fff' }}>Открыта</Chip>}
                    </View>

                    {currentShift ? (
                        <>
                            <Paragraph style={dynamicStyles.textSecondary}>
                                Открыта: {formatDate(currentShift.opened_at || currentShift.started_at)}
                            </Paragraph>
                            <Title style={{ color: colors.primary, fontSize: 24, marginVertical: 12 }}>⏱ {elapsedTime}</Title>

                            <Divider style={styles.divider} />

                            <View style={styles.statsRow}>
                                <View style={styles.stat}>
                                    <Paragraph style={dynamicStyles.textSecondary}>Продаж</Paragraph>
                                    <Title style={{ color: colors.success }}>{shiftStats?.sales_count || 0}</Title>
                                </View>
                                <View style={styles.stat}>
                                    <Paragraph style={dynamicStyles.textSecondary}>Выручка</Paragraph>
                                    <Title style={{ color: colors.success }}>{formatCurrency(shiftStats?.total_sales || 0)}</Title>
                                </View>
                            </View>

                            <Button mode="contained" buttonColor={colors.error} icon="close-circle" onPress={handleCloseShift} style={styles.button}>
                                Закрыть смену
                            </Button>
                        </>
                    ) : (
                        <>
                            <TextInput
                                label="Наличные в кассе (необязательно)"
                                value={openingCash}
                                onChangeText={setOpeningCash}
                                keyboardType="numeric"
                                style={[styles.input, dynamicStyles.input]}
                                mode="outlined"
                            />
                            <Button mode="contained" icon="check-circle" onPress={handleOpenShift} style={styles.button}>
                                Открыть смену
                            </Button>
                        </>
                    )}
                </Card.Content>
            </Card>

            {/* История смен */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>История смен</Title>
                    <Divider style={styles.divider} />
                    {shiftsHistory.slice(0, 5).map((shift, index) => (
                        <View key={index} style={styles.historyRow}>
                            <View>
                                <Paragraph style={dynamicStyles.text}>{formatDate(shift.opened_at || shift.started_at)}</Paragraph>
                                <Paragraph style={dynamicStyles.textSecondary}>{shift.sales_count || 0} продаж</Paragraph>
                            </View>
                            <Paragraph style={{ color: colors.success, fontWeight: 'bold' }}>{formatCurrency(shift.total_sales || 0)}</Paragraph>
                        </View>
                    ))}
                    {shiftsHistory.length === 0 && <Paragraph style={dynamicStyles.textSecondary}>Нет истории</Paragraph>}
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { margin: 16, marginBottom: 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    divider: { marginVertical: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    stat: { alignItems: 'center' },
    input: { marginBottom: 16 },
    button: { marginTop: 8 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
});
