import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Alert } from 'react-native';
import { Searchbar, Card, Title, Paragraph, Button, Chip, FAB, IconButton, SegmentedButtons } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { productsAPI, categoriesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function ProductsScreen({ navigation }) {
    const { colors } = useTheme();

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState([]);
    const [viewMode, setViewMode] = useState('all');

    useEffect(() => {
        loadProducts();
        loadCategories();
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        try {
            const saved = await AsyncStorage.getItem('favorites');
            if (saved) setFavorites(JSON.parse(saved));
        } catch (e) { }
    };

    const saveFavorites = async (newFavorites) => {
        await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
    };

    const toggleFavorite = (productId) => {
        let newFavorites = favorites.includes(productId)
            ? favorites.filter(id => id !== productId)
            : [...favorites, productId];
        setFavorites(newFavorites);
        saveFavorites(newFavorites);
        SoundManager.playTap();
    };

    const loadCategories = async () => {
        try {
            const response = await categoriesAPI.getAll();
            setCategories(response.data.categories || []);
        } catch (error) {
            console.log('[Products] Categories load error');
        }
    };

    const loadProducts = async () => {
        setLoading(true);
        try {
            const params = { active: true };
            if (searchQuery) params.search = searchQuery;
            const response = await productsAPI.getAll(params);
            setProducts(response.data.products || []);
        } catch (error) {
            console.error('[Products] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredProducts = () => {
        let filtered = products;
        if (selectedCategory) filtered = filtered.filter(p => p.category_id === selectedCategory);
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name?.toLowerCase().includes(query) ||
                p.code?.toLowerCase().includes(query) ||
                p.barcode?.includes(query)
            );
        }
        if (viewMode === 'favorites') filtered = filtered.filter(p => favorites.includes(p.id));
        return filtered;
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
        SoundManager.playAddToCart();
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
        searchbar: { backgroundColor: colors.surface },
    };

    const renderProduct = ({ item }) => (
        <Card style={[styles.productCard, dynamicStyles.card]}>
            <Card.Content style={styles.cardContent}>
                <View style={styles.productHeader}>
                    <View style={styles.productInfo}>
                        <Title style={[styles.productName, dynamicStyles.text]} numberOfLines={2}>{item.name}</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>{item.code}</Paragraph>
                        {item.quantity !== undefined && (
                            <Paragraph style={{ color: item.quantity > 0 ? colors.success : colors.error }}>
                                {item.quantity > 0 ? `В наличии: ${item.quantity}` : 'Нет в наличии'}
                            </Paragraph>
                        )}
                    </View>
                    <IconButton
                        icon={favorites.includes(item.id) ? "star" : "star-outline"}
                        iconColor={favorites.includes(item.id) ? colors.warning : colors.textSecondary}
                        onPress={() => toggleFavorite(item.id)}
                    />
                </View>
                <View style={styles.productFooter}>
                    <Title style={{ color: colors.success }}>{formatCurrency(item.price_sale)}</Title>
                    <Button mode="contained" onPress={() => addToCart(item)} icon="cart-plus" compact>
                        В корзину
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Searchbar
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={loadProducts}
                style={[styles.searchbar, dynamicStyles.searchbar]}
            />

            <SegmentedButtons
                value={viewMode}
                onValueChange={setViewMode}
                buttons={[
                    { value: 'all', label: 'Все товары', icon: 'view-grid' },
                    { value: 'favorites', label: `⭐ (${favorites.length})`, icon: 'star' },
                ]}
                style={styles.segmented}
            />

            {categories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    <Chip selected={!selectedCategory} onPress={() => setSelectedCategory(null)} style={styles.categoryChip}>Все</Chip>
                    {categories.map(cat => (
                        <Chip key={cat.id} selected={selectedCategory === cat.id} onPress={() => setSelectedCategory(cat.id)} style={styles.categoryChip}>{cat.name}</Chip>
                    ))}
                </ScrollView>
            )}

            <FlatList
                data={getFilteredProducts()}
                renderItem={renderProduct}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={loadProducts}
                ListEmptyComponent={
                    <Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>
                        {viewMode === 'favorites' ? 'Нет избранных товаров' : 'Товары не найдены'}
                    </Paragraph>
                }
            />

            {cart.length > 0 && (
                <FAB
                    icon="cart"
                    label={`Корзина (${cart.reduce((sum, item) => sum + item.quantity, 0)})`}
                    style={[styles.fab, { backgroundColor: colors.success }]}
                    onPress={() => navigation.navigate('Cart', { cart, setCart })}
                />
            )}

            <FAB
                icon="barcode-scan"
                style={[styles.fabScanner, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Scanner', {
                onScan: (barcode) => {
                        const product = products.find(p => p.barcode === barcode);
                        if (product) {
                            addToCart(product);
                            const stock = product.quantity !== undefined ? `\nВ наличии: ${product.quantity}` : '';
                            Alert.alert(
                                '✅ Товар найден',
                                `${product.name}\nЦена: ${formatCurrency(product.price_sale)}${stock}\n\nДобавлен в корзину`
                            );
                        } else {
                            SoundManager.playError();
                            Alert.alert('❌ Не найдено', `Штрихкод: ${barcode}\nТовар не найден в базе`);
                        }
                    }
                })}
                size="small"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchbar: { margin: 16, marginBottom: 8 },
    segmented: { marginHorizontal: 16, marginBottom: 8 },
    categoriesScroll: { paddingHorizontal: 16, marginBottom: 8, maxHeight: 50 },
    categoryChip: { marginRight: 8 },
    list: { padding: 16, paddingBottom: 100 },
    productCard: { marginBottom: 12 },
    cardContent: { padding: 12 },
    productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    productInfo: { flex: 1 },
    productName: { fontSize: 16 },
    productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    empty: { textAlign: 'center', padding: 40 },
    fab: { position: 'absolute', right: 16, bottom: 16 },
    fabScanner: { position: 'absolute', right: 16, bottom: 80 },
});
