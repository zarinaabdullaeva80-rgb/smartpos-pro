import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Title, Paragraph, Chip, Searchbar } from 'react-native-paper';
import { salesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function SalesHistoryScreen({ navigation }) {
    const { colors } = useTheme();

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { loadSales(); }, []);

    const loadSales = async () => {
        setLoading(true);
        try {
            const response = await salesAPI.getAll({ limit: 50 });
            setSales(response.data.sales || []);
        } catch (error) {
            console.error('[SalesHistory] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Сокращаем номер документа
    const formatDocNumber = (num) => {
        if (!num) return '#---';
        if (num.length > 12) {
            return '#...' + num.slice(-8);
        }
        return '#' + num;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return colors.success;
            case 'pending': return colors.warning;
            case 'cancelled': return colors.error;
            default: return colors.textSecondary;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'confirmed': return '✓';
            case 'pending': return '⏳';
            case 'cancelled': return '✗';
            default: return status;
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        searchbar: { backgroundColor: colors.surface },
    };

    const filteredSales = sales.filter(s =>
        s.document_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderSale = ({ item }) => (
        <Card style={[styles.card, dynamicStyles.card]} onPress={() => navigation.navigate('SaleDetails', { saleId: item.id })}>
            <Card.Content>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Chip
                            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
                            textStyle={{ color: '#fff', fontSize: 12 }}
                            compact
                        >
                            {getStatusLabel(item.status)}
                        </Chip>
                        <Title style={[dynamicStyles.text, styles.docNumber]} numberOfLines={1}>
                            {formatDocNumber(item.document_number)}
                        </Title>
                    </View>
                    <Title style={[styles.price, { color: colors.success }]}>
                        {formatCurrency(item.final_amount)}
                    </Title>
                </View>
                <Paragraph style={dynamicStyles.textSecondary}>{formatDate(item.created_at)}</Paragraph>
                {item.notes && <Paragraph style={[dynamicStyles.textSecondary, styles.notes]} numberOfLines={1}>{item.notes}</Paragraph>}
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Searchbar
                placeholder="Поиск по номеру..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchbar, dynamicStyles.searchbar]}
            />
            <FlatList
                data={filteredSales}
                renderItem={renderSale}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadSales}
                ListEmptyComponent={<Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>Нет продаж</Paragraph>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchbar: { margin: 16 },
    list: { padding: 16, paddingTop: 0 },
    card: { marginBottom: 12 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    statusChip: {
        marginRight: 8,
        height: 24,
    },
    docNumber: {
        fontSize: 14,
        flex: 1,
    },
    price: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    notes: {
        marginTop: 4,
        fontSize: 12,
    },
    empty: { textAlign: 'center', padding: 40 },
});
