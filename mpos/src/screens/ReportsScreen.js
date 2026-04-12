import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, SegmentedButtons, Divider, List, Chip } from 'react-native-paper';
import { salesAPI, shiftsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function ReportsScreen({ navigation }) {
    const { colors } = useTheme();

    const [period, setPeriod] = useState('today');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalAmount: 0,
        avgCheck: 0,
    });
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftStats, setShiftStats] = useState(null);

    useEffect(() => {
        loadReport();
        loadShiftData();
    }, [period]);

    const getDateRange = () => {
        const now = new Date();
        let from;
        switch (period) {
            case 'today': from = new Date(now.setHours(0, 0, 0, 0)); break;
            case 'week': from = new Date(now.setDate(now.getDate() - 7)); break;
            case 'month': from = new Date(now.setMonth(now.getMonth() - 1)); break;
            case 'year': from = new Date(now.setFullYear(now.getFullYear() - 1)); break;
            default: from = new Date();
        }
        return { from: from.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] };
    };

    const loadShiftData = async () => {
        try {
            const shiftRes = await shiftsAPI.getCurrent();
            setCurrentShift(shiftRes.data.shift);
            if (shiftRes.data.shift?.id) {
                const statsRes = await shiftsAPI.getStats(shiftRes.data.shift.id);
                setShiftStats(statsRes.data);
            }
        } catch (error) {
            console.log('[Reports] No active shift');
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            const range = getDateRange();
            const response = await salesAPI.getAll({ dateFrom: range.from, dateTo: range.to, status: 'confirmed' });
            const sales = response.data.sales || [];
            const totalAmount = sales.reduce((sum, s) => sum + parseFloat(s.final_amount || 0), 0);

            setStats({
                totalSales: sales.length,
                totalAmount,
                avgCheck: sales.length > 0 ? totalAmount / sales.length : 0,
            });
        } catch (error) {
            console.error('[Reports] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const printZReport = async () => {
        if (!currentShift) {
            Alert.alert('Ошибка', 'Нет активной смены');
            return;
        }

        try {
            SoundManager.playSuccess();

            // Подготовить данные для Z-отчёта
            const zReportData = {
                id: currentShift.id,
                started_at: currentShift.opened_at || currentShift.started_at,
                sales_count: shiftStats?.sales_count || stats.totalSales || 0,
                sales_total: shiftStats?.total_sales || stats.totalAmount || 0,
                total_sales: shiftStats?.total_sales || stats.totalAmount || 0,
                returns_count: 0,
                returns_total: 0,
                cash_total: 0,
                card_total: 0,
                user_name: 'Администратор'
            };

            // Импортировать PrinterService
            const PrinterService = require('../services/printer').default;
            const result = await PrinterService.printZReport(zReportData);

            if (!result.success) {
                Alert.alert('Ошибка печати', result.message);
            }
        } catch (error) {
            console.error('[Reports] Print Z-report error:', error);
            Alert.alert('Ошибка', 'Не удалось напечатать Z-отчёт');
        }
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const getPeriodLabel = () => ({ today: 'Сегодня', week: 'За неделю', month: 'За месяц', year: 'За год' }[period] || '');

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            <SegmentedButtons
                value={period}
                onValueChange={setPeriod}
                buttons={[
                    { value: 'today', label: 'День' },
                    { value: 'week', label: 'Неделя' },
                    { value: 'month', label: 'Месяц' },
                    { value: 'year', label: 'Год' },
                ]}
                style={styles.segmented}
            />

            {/* Основные показатели */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>📊 Выручка {getPeriodLabel().toLowerCase()}</Title>
                    <Title style={{ fontSize: 32, color: colors.success, marginVertical: 8 }}>
                        {formatCurrency(stats.totalAmount)}
                    </Title>
                    <View style={styles.metricsRow}>
                        <Chip icon="cart" style={styles.metricChip}>{stats.totalSales} продаж</Chip>
                        <Chip icon="calculator" style={styles.metricChip}>Ср. чек: {formatCurrency(stats.avgCheck)}</Chip>
                    </View>
                </Card.Content>
            </Card>

            {/* Карточки статистики */}
            <View style={styles.row}>
                <Card style={[styles.card, styles.halfCard, dynamicStyles.card]}>
                    <Card.Content>
                        <Paragraph style={dynamicStyles.textSecondary}>📈 Продажи</Paragraph>
                        <Title style={{ color: colors.success, fontSize: 24 }}>{stats.totalSales}</Title>
                        <Paragraph style={{ color: colors.success }}>{formatCurrency(stats.totalAmount)}</Paragraph>
                    </Card.Content>
                </Card>
                <Card style={[styles.card, styles.halfCard, dynamicStyles.card]}>
                    <Card.Content>
                        <Paragraph style={dynamicStyles.textSecondary}>📉 Возвраты</Paragraph>
                        <Title style={{ color: colors.error, fontSize: 24 }}>0</Title>
                        <Paragraph style={{ color: colors.error }}>0 so'm</Paragraph>
                    </Card.Content>
                </Card>
            </View>

            {/* Z-отчёт */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>📋 Z-отчёт</Title>
                    <Divider style={styles.divider} />

                    {currentShift ? (
                        <>
                            <List.Item
                                title="Смена открыта"
                                description={new Date(currentShift.opened_at || currentShift.started_at).toLocaleString('ru-RU')}
                                titleStyle={dynamicStyles.text}
                                descriptionStyle={dynamicStyles.textSecondary}
                                left={() => <List.Icon icon="clock-outline" color={colors.success} />}
                            />
                            <List.Item
                                title="Продаж за смену"
                                description={`${shiftStats?.sales_count || 0} шт.`}
                                titleStyle={dynamicStyles.text}
                                descriptionStyle={dynamicStyles.textSecondary}
                                left={() => <List.Icon icon="cart" color={colors.primary} />}
                            />
                            <List.Item
                                title="Выручка за смену"
                                description={formatCurrency(shiftStats?.total_sales || 0)}
                                titleStyle={dynamicStyles.text}
                                descriptionStyle={{ color: colors.success, fontWeight: 'bold' }}
                                left={() => <List.Icon icon="cash" color={colors.success} />}
                            />
                            <Button mode="contained" icon="printer" onPress={printZReport} style={styles.zButton}>
                                Печать Z-отчёта
                            </Button>
                        </>
                    ) : (
                        <Paragraph style={dynamicStyles.textSecondary}>Нет активной смены</Paragraph>
                    )}
                </Card.Content>
            </Card>

            <View style={styles.spacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    segmented: { margin: 16 },
    card: { marginHorizontal: 16, marginBottom: 16 },
    row: { flexDirection: 'row', paddingHorizontal: 8 },
    halfCard: { flex: 1, marginHorizontal: 8 },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    metricChip: { marginRight: 8, marginBottom: 8 },
    divider: { marginVertical: 12 },
    zButton: { marginTop: 16 },
    spacer: { height: 32 },
});
