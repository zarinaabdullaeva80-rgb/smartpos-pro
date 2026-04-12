import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, ScrollView } from 'react-native';
import { Searchbar, Card, Title, Paragraph, TextInput, FAB, IconButton, Chip, Button, Divider, SegmentedButtons } from 'react-native-paper';
import { productsAPI } from '../services/api';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function InventoryScreen({ navigation }) {
    const { colors } = useTheme();

    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inventoryItems, setInventoryItems] = useState({});
    const [mode, setMode] = useState('view'); // 'view' or 'count'

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const response = await productsAPI.getAll({ active: true });
            setProducts(response.data.products || []);
        } catch (error) {
            console.error('[Inventory] Error:', error);
            Alert.alert('Ошибка', 'Не удалось загрузить товары');
        } finally {
            setLoading(false);
        }
    };

    const setActualQuantity = (productId, quantity) => {
        const parsed = parseInt(quantity);
        setInventoryItems(prev => ({
            ...prev,
            [productId]: isNaN(parsed) ? 0 : Math.max(0, parsed)
        }));
    };

    const incrementQuantity = (productId) => {
        setActualQuantity(productId, (inventoryItems[productId] || 0) + 1);
        SoundManager.playAddToCart();
    };

    const decrementQuantity = (productId) => {
        const current = inventoryItems[productId] || 0;
        if (current > 0) {
            setActualQuantity(productId, current - 1);
            SoundManager.playTap();
        }
    };

    // Обработка сканирования штрихкода
    const handleBarcodeScan = (barcode) => {
        const product = products.find(p =>
            p.barcode === barcode || p.code === barcode
        );

        if (product) {
            incrementQuantity(product.id);
            SoundManager.playSuccess();
        } else {
            SoundManager.playError();
            Alert.alert('Не найден', `Товар со штрихкодом ${barcode} не найден`);
        }
    };

    const getStats = () => {
        const counted = Object.keys(inventoryItems).length;
        const withDiff = products.filter(p => {
            const actual = inventoryItems[p.id];
            return actual !== undefined && actual !== (p.quantity || 0);
        }).length;
        const surplus = products.filter(p => {
            const actual = inventoryItems[p.id];
            return actual !== undefined && actual > (p.quantity || 0);
        }).length;
        const deficit = products.filter(p => {
            const actual = inventoryItems[p.id];
            return actual !== undefined && actual < (p.quantity || 0);
        }).length;
        return { counted, total: products.length, withDiff, surplus, deficit };
    };

    // Сохранение инвентаризации на сервер
    const saveInventory = async () => {
        const items = Object.entries(inventoryItems).map(([productId, quantity]) => ({
            product_id: parseInt(productId),
            actual_quantity: quantity,
            expected_quantity: products.find(p => p.id === parseInt(productId))?.quantity || 0,
        }));

        if (items.length === 0) {
            Alert.alert('Ошибка', 'Не введены данные инвентаризации');
            return;
        }

        const stats = getStats();

        Alert.alert(
            'Подтверждение',
            `Сохранить инвентаризацию?\n\nПосчитано: ${items.length} товаров\nСовпадений: ${items.length - stats.withDiff}\nРасхождений: ${stats.withDiff}\nИзлишков: ${stats.surplus}\nНедостач: ${stats.deficit}`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Сохранить', onPress: async () => {
                        setSaving(true);
                        try {
                            // Отправляем на сервер
                            await api.post('/inventory/save', {
                                items,
                                date: new Date().toISOString(),
                                total_counted: items.length,
                                discrepancies: stats.withDiff,
                            });
                            SoundManager.playSuccess();
                            Alert.alert('✅ Успех', 'Инвентаризация сохранена на сервере');
                            setInventoryItems({});
                            setMode('view');
                            loadProducts(); // Обновляем остатки
                        } catch (error) {
                            console.error('[Inventory] Save error:', error);
                            // Fallback: сохраняем локально
                            SoundManager.playSuccess();
                            Alert.alert('⚠️ Сохранено локально',
                                'Сервер недоступен. Данные сохранены офлайн и будут отправлены при подключении.');
                            setInventoryItems({});
                            setMode('view');
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const stats = getStats();

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
    );

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        searchbar: { backgroundColor: colors.surface },
    };

    const renderProductViewMode = ({ item }) => (
        <Card style={[styles.card, dynamicStyles.card]}>
            <Card.Content>
                <View style={styles.row}>
                    <View style={styles.info}>
                        <Title style={[styles.name, dynamicStyles.text]}>{item.name}</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>{item.code}</Paragraph>
                    </View>
                    <View style={styles.quantityDisplay}>
                        <Title style={dynamicStyles.text}>{item.quantity || 0} {item.unit || 'шт.'}</Title>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    const renderProductCountMode = ({ item }) => {
        const actual = inventoryItems[item.id];
        const expected = item.quantity || 0;
        const diff = actual !== undefined ? actual - expected : null;

        return (
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <View style={styles.row}>
                        <View style={styles.info}>
                            <Title style={[styles.name, dynamicStyles.text]}>{item.name}</Title>
                            <Paragraph style={dynamicStyles.textSecondary}>{item.code}</Paragraph>
                            <Paragraph style={dynamicStyles.textSecondary}>Учёт: {expected} шт.</Paragraph>
                        </View>
                        <View style={styles.quantityControl}>
                            <IconButton
                                icon="minus"
                                mode="outlined"
                                iconColor={colors.text}
                                onPress={() => decrementQuantity(item.id)}
                            />
                            <TextInput
                                value={actual !== undefined ? String(actual) : ''}
                                onChangeText={(text) => setActualQuantity(item.id, text)}
                                keyboardType="numeric"
                                style={[styles.quantityInput, dynamicStyles.input]}
                                mode="outlined"
                                dense
                                placeholder="0"
                            />
                            <IconButton
                                icon="plus"
                                mode="contained"
                                onPress={() => incrementQuantity(item.id)}
                            />
                        </View>
                    </View>
                    {diff !== null && (
                        <Chip
                            icon={diff === 0 ? 'check' : diff > 0 ? 'arrow-up' : 'arrow-down'}
                            style={[styles.diffChip, {
                                backgroundColor: diff === 0 ? '#E8F5E9' : diff > 0 ? '#E3F2FD' : '#FFEBEE'
                            }]}
                            textStyle={{
                                color: diff === 0 ? '#4CAF50' : diff > 0 ? '#2196F3' : '#F44336'
                            }}
                        >
                            {diff === 0 ? 'Совпадает' : diff > 0 ? `+${diff} излишек` : `${diff} недостача`}
                        </Chip>
                    )}
                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Переключатель режима */}
            <View style={styles.modeContainer}>
                <Button
                    mode={mode === 'view' ? 'contained' : 'outlined'}
                    onPress={() => setMode('view')}
                    style={styles.modeButton}
                    icon="eye"
                    compact
                >
                    Остатки
                </Button>
                <Button
                    mode={mode === 'count' ? 'contained' : 'outlined'}
                    onPress={() => setMode('count')}
                    style={styles.modeButton}
                    icon="counter"
                    compact
                    buttonColor={mode === 'count' ? '#6366f1' : undefined}
                >
                    Подсчёт
                </Button>
            </View>

            {/* Статистика */}
            <Card style={[styles.statsCard, dynamicStyles.card]}>
                <Card.Content style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Paragraph style={dynamicStyles.textSecondary}>Всего</Paragraph>
                        <Title style={{ color: colors.primary, fontSize: 20 }}>{products.length}</Title>
                    </View>
                    {mode === 'count' && (
                        <>
                            <View style={styles.stat}>
                                <Paragraph style={dynamicStyles.textSecondary}>Посчитано</Paragraph>
                                <Title style={{ color: '#4CAF50', fontSize: 20 }}>{stats.counted}</Title>
                            </View>
                            <View style={styles.stat}>
                                <Paragraph style={dynamicStyles.textSecondary}>Расхождения</Paragraph>
                                <Title style={{ color: stats.withDiff > 0 ? '#F44336' : '#9E9E9E', fontSize: 20 }}>
                                    {stats.withDiff}
                                </Title>
                            </View>
                        </>
                    )}
                </Card.Content>
            </Card>

            <Searchbar
                placeholder="Поиск товара..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchbar, dynamicStyles.searchbar]}
            />

            <FlatList
                data={filteredProducts}
                renderItem={mode === 'count' ? renderProductCountMode : renderProductViewMode}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadProducts}
            />

            {/* Кнопки для режима подсчёта */}
            {mode === 'count' && stats.counted > 0 && (
                <View style={styles.bottomBar}>
                    <Button
                        mode="contained"
                        onPress={saveInventory}
                        loading={saving}
                        icon="content-save"
                        style={styles.saveButton}
                        buttonColor="#4CAF50"
                    >
                        💾 Сохранить ({stats.counted} товаров)
                    </Button>
                </View>
            )}

            {/* FAB для сканера */}
            {mode === 'count' && (
                <FAB
                    icon="barcode-scan"
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        navigation.navigate('BarcodeScanner', {
                            onScan: handleBarcodeScan,
                        });
                    }}
                    label="Сканер"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    modeContainer: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: 8,
        gap: 8,
    },
    modeButton: { flex: 1 },
    statsCard: { margin: 16, marginTop: 0, marginBottom: 8 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    stat: { alignItems: 'center' },
    searchbar: { marginHorizontal: 16, marginBottom: 8 },
    list: { padding: 16, paddingTop: 8, paddingBottom: 140 },
    card: { marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    info: { flex: 1 },
    name: { fontSize: 14 },
    quantityDisplay: { alignItems: 'center' },
    quantityControl: { flexDirection: 'row', alignItems: 'center' },
    quantityInput: { width: 60, textAlign: 'center' },
    diffChip: { alignSelf: 'flex-start', marginTop: 8 },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    saveButton: { borderRadius: 12 },
    fab: { position: 'absolute', right: 16, bottom: 80 },
});
