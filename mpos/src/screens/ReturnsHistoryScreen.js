import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider, TextInput } from 'react-native-paper';
import { returnsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function ReturnsHistoryScreen({ navigation }) {
    const { colors } = useTheme();

    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => { loadReturns(); }, []);

    const loadReturns = async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const response = await returnsAPI.getAll(params);
            setReturns(response.data.returns || []);
        } catch (error) {
            console.error('[ReturnsHistory] Error loading returns:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.surface },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    const renderReturn = ({ item }) => (
        <Card style={[styles.card, dynamicStyles.card]} onPress={() => navigation.navigate('ReturnDetails', { returnId: item.id })}>
            <Card.Content>
                <View style={styles.row}>
                    <Title style={[styles.docNumber, dynamicStyles.text]}>#{item.document_number?.slice(-8) || item.id}</Title>
                    <Chip mode="outlined" textStyle={{ color: colors.error }}>{formatCurrency(item.final_amount)}</Chip>
                </View>
                <Paragraph style={dynamicStyles.textSecondary}>
                    {formatDate(item.created_at)}
                </Paragraph>
                <Paragraph style={dynamicStyles.textSecondary} numberOfLines={1}>
                    Причина: {item.reason || '-'}
                </Paragraph>
                {item.sale_document_number && (
                    <Paragraph style={dynamicStyles.textSecondary}>
                        Чек: {item.sale_document_number.slice(-10)}
                    </Paragraph>
                )}
            </Card.Content>
        </Card>
    );

    const applyFilters = () => {
        loadReturns();
        setShowFilters(false);
    };

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setTimeout(loadReturns, 100);
        setShowFilters(false);
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <View style={styles.header}>
                <Title style={dynamicStyles.text}>История возвратов</Title>
                <Button
                    icon={showFilters ? "filter-off" : "filter"}
                    mode="text"
                    onPress={() => setShowFilters(!showFilters)}
                >
                    Фильтр
                </Button>
            </View>

            {showFilters && (
                <Card style={[styles.filterCard, dynamicStyles.card]}>
                    <Card.Content>
                        <TextInput
                            label="Дата от (ГГГГ-ММ-ДД)"
                            value={dateFrom}
                            onChangeText={setDateFrom}
                            style={styles.input}
                            mode="outlined"
                            placeholder="2026-01-01"
                        />
                        <TextInput
                            label="Дата до (ГГГГ-ММ-ДД)"
                            value={dateTo}
                            onChangeText={setDateTo}
                            style={styles.input}
                            mode="outlined"
                            placeholder="2026-12-31"
                        />
                        <View style={styles.filterButtons}>
                            <Button mode="outlined" onPress={clearFilters} style={styles.filterBtn}>Сбросить</Button>
                            <Button mode="contained" onPress={applyFilters} style={styles.filterBtn}>Применить</Button>
                        </View>
                    </Card.Content>
                </Card>
            )}

            <FlatList
                data={returns}
                renderItem={renderReturn}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadReturns}
                ListEmptyComponent={
                    <Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>
                        {loading ? 'Загрузка...' : 'Нет возвратов'}
                    </Paragraph>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 8,
    },
    filterCard: { margin: 16, marginTop: 0 },
    input: { marginBottom: 12 },
    filterButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    filterBtn: { flex: 1, marginHorizontal: 4 },
    list: { padding: 16, paddingTop: 0 },
    card: { marginBottom: 12 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    docNumber: { fontSize: 16 },
    empty: { textAlign: 'center', padding: 40 },
});
