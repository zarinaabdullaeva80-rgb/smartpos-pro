import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, Searchbar, TextInput, Chip, Divider, IconButton } from 'react-native-paper';
import { salesAPI, returnsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function ReturnsScreen({ navigation }) {
    const { colors } = useTheme();

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [reason, setReason] = useState('');
    const [items, setItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState({}); // { itemId: quantity }
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => { loadSales(); }, []);

    useEffect(() => {
        if (selectedSale) {
            loadSaleItems(selectedSale.id);
        } else {
            setItems([]);
            setSelectedItems({});
        }
    }, [selectedSale]);

    const loadSales = async () => {
        setLoading(true);
        try {
            // Загружаем все продажи (не фильтруем по статусу, чтобы можно было вернуть любую продажу)
            const response = await salesAPI.getAll({ limit: 50 });
            const allSales = response.data.sales || response.data || [];
            // Фильтруем: не показываем отмененные продажи
            const validSales = Array.isArray(allSales)
                ? allSales.filter(s => s.status !== 'cancelled' && s.status !== 'voided')
                : [];
            setSales(validSales);
        } catch (error) {
            console.error('[Returns] Error loading sales:', error);
            Alert.alert('Ошибка', 'Не удалось загрузить продажи');
        } finally {
            setLoading(false);
        }
    };

    const loadSaleItems = async (saleId) => {
        setLoading(true);
        setItems([]);
        setSelectedItems({});

        try {
            console.log('[Returns] Loading items for sale:', saleId);
            const response = await returnsAPI.checkSale(saleId);
            console.log('[Returns] Response received:', JSON.stringify(response.data));

            // Defensive parsing - check every level
            if (!response) {
                console.error('[Returns] No response from API');
                Alert.alert('Ошибка', 'Нет ответа от сервера');
                return;
            }

            if (!response.data) {
                console.error('[Returns] Response has no data');
                Alert.alert('Ошибка', 'Пустой ответ от сервера');
                return;
            }

            // Get available items with safe access
            const availableItems = Array.isArray(response.data.available_items)
                ? response.data.available_items
                : [];

            console.log('[Returns] Available items count:', availableItems.length);

            if (availableItems.length === 0) {
                Alert.alert('Информация', 'Нет доступных товаров для возврата по этому чеку');
                setItems([]);
                setSelectedItems({});
                return;
            }

            // Set items
            setItems(availableItems);

            // Build initial selection safely
            const initialSelection = {};
            for (let i = 0; i < availableItems.length; i++) {
                const item = availableItems[i];
                if (item && item.id != null && item.available_quantity != null) {
                    initialSelection[item.id] = parseFloat(item.available_quantity) || 0;
                }
            }
            setSelectedItems(initialSelection);
            console.log('[Returns] Items loaded successfully');

        } catch (error) {
            console.error('[Returns] Error loading items:', error);
            const errorMessage = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'Неизвестная ошибка';
            Alert.alert('Ошибка загрузки', errorMessage);
            setItems([]);
            setSelectedItems({});
        } finally {
            setLoading(false);
        }
    };


    const toggleItem = (itemId, availableQty) => {
        setSelectedItems(prev => {
            const next = { ...prev };
            if (next[itemId]) {
                delete next[itemId];
            } else {
                next[itemId] = availableQty;
            }
            return next;
        });
    };

    const updateItemQty = (itemId, qty, max) => {
        const val = parseFloat(qty) || 0;
        if (val > max) return;
        setSelectedItems(prev => ({ ...prev, [itemId]: val }));
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    // Сокращаем номер документа для отображения
    const formatDocNumber = (num) => {
        if (!num) return '#---';
        if (num.length > 15) {
            return '#' + num.slice(-10);
        }
        return '#' + num;
    };

    const handleReturn = async () => {
        if (!selectedSale) {
            Alert.alert('Ошибка', 'Выберите чек для возврата');
            return;
        }

        const returnItems = Object.entries(selectedItems)
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => ({
                sale_item_id: parseInt(itemId),
                quantity: qty
            }));

        if (returnItems.length === 0) {
            Alert.alert('Ошибка', 'Выберите хотя бы один товар для возврата');
            return;
        }

        if (!reason.trim()) {
            Alert.alert('Ошибка', 'Укажите причину возврата');
            return;
        }

        const totalToReturn = items
            .filter(item => selectedItems[item.id] > 0)
            .reduce((sum, item) => sum + (item.price * selectedItems[item.id]), 0);

        Alert.alert('Подтверждение', `Оформить возврат на сумму ${formatCurrency(totalToReturn)}?`, [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Вернуть', style: 'destructive', onPress: async () => {
                    try {
                        await returnsAPI.create({
                            sale_id: selectedSale.id,
                            reason,
                            items: returnItems
                        });
                        SoundManager.playSuccess();
                        Alert.alert('Успех', 'Возврат оформлен. Остатки на складе обновлены.');
                        setSelectedSale(null);
                        setReason('');
                        loadSales();
                    } catch (error) {
                        SoundManager.playError();
                        Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось оформить возврат');
                    }
                }
            }
        ]);
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        searchbar: { backgroundColor: colors.surface },
    };

    const filteredSales = sales.filter(s =>
        s.document_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderSale = ({ item }) => (
        <Card
            style={[styles.saleCard, dynamicStyles.card, selectedSale?.id === item.id && { borderColor: colors.primary, borderWidth: 2 }]}
            onPress={() => setSelectedSale(item)}
        >
            <Card.Content>
                <View style={styles.saleHeader}>
                    <Title style={[dynamicStyles.text, styles.docNumber]} numberOfLines={1}>
                        {formatDocNumber(item.document_number)}
                    </Title>
                    <Title style={[styles.price, { color: colors.success }]}>
                        {formatCurrency(item.final_amount)}
                    </Title>
                </View>
                <Paragraph style={dynamicStyles.textSecondary}>{formatDate(item.created_at)}</Paragraph>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <View style={styles.topBar}>
                <Button
                    icon="history"
                    mode="text"
                    onPress={() => navigation.navigate('ReturnsHistory')}
                    textColor={colors.primary}
                >
                    История возвратов
                </Button>
            </View>
            <Searchbar
                placeholder="Поиск по номеру чека..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchbar, dynamicStyles.searchbar]}
            />

            {selectedSale ? (
                <View style={{ flex: 1 }}>
                    <Card style={[styles.card, dynamicStyles.card, { marginBottom: 8 }]}>
                        <Card.Content>
                            <View style={styles.header}>
                                <View style={styles.headerTitle}>
                                    <Paragraph style={dynamicStyles.textSecondary}>Возврат по чеку</Paragraph>
                                    <Title style={[dynamicStyles.text, styles.selectedDocNum]} numberOfLines={1}>
                                        {formatDocNumber(selectedSale.document_number)}
                                    </Title>
                                </View>
                                <Button mode="outlined" onPress={() => setSelectedSale(null)} compact>
                                    Назад
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>

                    <FlatList
                        data={items}
                        keyExtractor={item => String(item.id)}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        renderItem={({ item }) => (
                            <Card
                                style={[
                                    styles.itemCard,
                                    dynamicStyles.card,
                                    !selectedItems[item.id] && { opacity: 0.6 }
                                ]}
                                onPress={() => toggleItem(item.id, item.available_quantity)}
                            >
                                <Card.Content style={styles.itemRow}>
                                    <IconButton
                                        icon={selectedItems[item.id] ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                        iconColor={selectedItems[item.id] ? colors.primary : colors.textSecondary}
                                        onPress={() => toggleItem(item.id, item.available_quantity)}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Title style={[styles.itemName, dynamicStyles.text]}>{item.name}</Title>
                                        <Paragraph style={dynamicStyles.textSecondary}>Куплено: {item.quantity} {item.unit || 'шт.'}</Paragraph>
                                    </View>
                                    {selectedItems[item.id] !== undefined && (
                                        <View style={styles.qtyContainer}>
                                            <IconButton icon="minus" size={20} onPress={() => updateItemQty(item.id, (selectedItems[item.id] || 0) - 1, item.available_quantity)} disabled={selectedItems[item.id] <= 0} />
                                            <TextInput
                                                value={String(selectedItems[item.id])}
                                                onChangeText={(val) => updateItemQty(item.id, val, item.available_quantity)}
                                                keyboardType="numeric"
                                                style={styles.qtyInput}
                                                dense
                                            />
                                            <IconButton icon="plus" size={20} onPress={() => updateItemQty(item.id, (selectedItems[item.id] || 0) + 1, item.available_quantity)} disabled={selectedItems[item.id] >= item.available_quantity} />
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        )}
                        ListFooterComponent={
                            <View style={{ paddingBottom: 100 }}>
                                <Card style={[styles.card, dynamicStyles.card, { marginHorizontal: 0 }]}>
                                    <Card.Content>
                                        <View style={styles.totalRow}>
                                            <Paragraph style={dynamicStyles.textSecondary}>Итого к возврату:</Paragraph>
                                            <Title style={{ color: colors.error, fontSize: 20 }}>
                                                {formatCurrency(items.reduce((sum, item) => sum + (item.price * (selectedItems[item.id] || 0)), 0))}
                                            </Title>
                                        </View>

                                        <TextInput
                                            label="Причина возврата *"
                                            value={reason}
                                            onChangeText={setReason}
                                            style={[styles.input, dynamicStyles.input]}
                                            mode="outlined"
                                            multiline
                                        />

                                        <Button
                                            mode="contained"
                                            buttonColor={colors.error}
                                            icon="keyboard-return"
                                            onPress={handleReturn}
                                            style={styles.button}
                                            disabled={!reason.trim() || Object.values(selectedItems).every(q => q === 0)}
                                        >
                                            Подтвердить возврат
                                        </Button>
                                    </Card.Content>
                                </Card>
                            </View>
                        }
                    />
                </View>
            ) : (
                <FlatList
                    data={filteredSales}
                    renderItem={renderSale}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={styles.list}
                    refreshing={loading}
                    onRefresh={loadSales}
                    ListEmptyComponent={<Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>Нет чеков для возврата</Paragraph>}
                    ListHeaderComponent={<Paragraph style={[styles.hint, dynamicStyles.textSecondary]}>Выберите чек из истории</Paragraph>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 8,
        paddingTop: 8,
    },
    searchbar: { margin: 16, marginTop: 8 },
    card: { margin: 16 },
    saleCard: { marginHorizontal: 16, marginBottom: 12 },
    list: { paddingBottom: 16 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        marginRight: 12,
    },
    saleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    docNumber: {
        flex: 1,
        fontSize: 16,
        marginRight: 8,
    },
    selectedDocNum: {
        fontSize: 18,
    },
    price: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    divider: { marginVertical: 16 },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    input: { marginBottom: 16 },
    button: { marginTop: 8 },
    empty: { textAlign: 'center', padding: 40 },
    hint: { textAlign: 'center', padding: 16 },
});
