import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Card, Title, Paragraph, Button, IconButton, TextInput, Divider, SegmentedButtons } from 'react-native-paper';
import { salesAPI, shiftsAPI } from '../services/api';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function CartScreen({ route, navigation }) {
    const { colors } = useTheme();

    const initialCart = route.params?.cart || [];
    const parentSetCart = route.params?.setCart;

    const [cartItems, setCartItems] = useState(initialCart);
    const [customerName, setCustomerName] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentShift, setCurrentShift] = useState(null);
    const [discountType, setDiscountType] = useState('percent');
    const [discountValue, setDiscountValue] = useState('');
    const [warehouseId, setWarehouseId] = useState(null);

    useEffect(() => {
        checkShift();
        loadWarehouse();
    }, []);

    const loadWarehouse = async () => {
        try {
            const response = await api.get('/warehouses');
            const warehouses = response.data.warehouses || response.data || [];
            if (warehouses.length > 0) {
                setWarehouseId(warehouses[0].id);
                console.log('[Cart] Warehouse set:', warehouses[0].id, warehouses[0].name);
            }
        } catch (error) {
            console.log('[Cart] Warehouse load error:', error.message);
        }
    };

    useEffect(() => {
        if (parentSetCart) parentSetCart(cartItems);
    }, [cartItems]);

    const checkShift = async () => {
        try {
            console.log('[Cart] Checking current shift...');
            const response = await shiftsAPI.getCurrent();
            console.log('[Cart] Shift response:', JSON.stringify(response.data));
            if (response.data && response.data.shift) {
                setCurrentShift(response.data.shift);
                console.log('[Cart] Shift set:', response.data.shift.id);
                return response.data.shift;
            } else {
                console.log('[Cart] No shift in response');
                setCurrentShift(null);
                return null;
            }
        } catch (error) {
            console.log('[Cart] Error checking shift:', error.message);
            setCurrentShift(null);
            return null;
        }
    };

    const updateQuantity = (itemId, newQuantity) => {
        const qty = Math.max(1, parseInt(newQuantity) || 1);
        setCartItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, quantity: qty } : item
        ));
    };

    const deleteItem = (itemId) => {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
        SoundManager.playTap();
    };

    const getSubtotal = () => cartItems.reduce((sum, item) => sum + ((item.price || item.price_sale) * item.quantity), 0);

    const getDiscountAmount = () => {
        const subtotal = getSubtotal();
        const value = parseFloat(discountValue) || 0;
        return discountType === 'percent' ? subtotal * value / 100 : value;
    };

    const getTotal = () => Math.max(0, getSubtotal() - getDiscountAmount());

    const formatPrice = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    const completeSale = async () => {
        // Recheck shift before sale
        let shift = currentShift;
        if (!shift) {
            shift = await checkShift();
        }

        if (!shift) {
            Alert.alert('Ошибка', 'Сначала откройте смену. Если смена уже открыта, проверьте интернет-соединение.');
            return;
        }
        if (cartItems.length === 0) {
            Alert.alert('Ошибка', 'Корзина пуста');
            return;
        }

        setLoading(true);
        try {
            const subtotal = getSubtotal();
            let discountPercent = discountType === 'percent'
                ? parseFloat(discountValue) || 0
                : subtotal > 0 ? ((parseFloat(discountValue) || 0) / subtotal) * 100 : 0;

            const saleData = {
                documentNumber: `MOB-${Date.now()}`,
                documentDate: new Date().toISOString().split('T')[0],
                counterpartyId: null,
                warehouseId: warehouseId || null,
                items: cartItems.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price || item.price_sale,
                    vatRate: 12,
                    discountPercent: 0
                })),
                discountPercent: Math.min(100, Math.max(0, discountPercent)),
                notes: customerName || 'Мобильная продажа',
                autoConfirm: true
            };

            await salesAPI.create(saleData);
            SoundManager.playSuccess();

            Alert.alert('Успех!', `Продажа на ${formatPrice(getTotal())} оформлена`, [
                {
                    text: 'OK', onPress: () => {
                        setCartItems([]);
                        if (parentSetCart) parentSetCart([]);
                        navigation.goBack();
                    }
                }
            ]);
        } catch (error) {
            SoundManager.playError();
            const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || 'Ошибка сервера';
            Alert.alert('Ошибка', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Переход к выбору способа оплаты
    const goToPayment = () => {
        if (!currentShift) {
            Alert.alert('Ошибка', 'Сначала откройте смену');
            return;
        }
        if (cartItems.length === 0) {
            Alert.alert('Ошибка', 'Корзина пуста');
            return;
        }

        // Переходим на экран выбора оплаты
        navigation.navigate('PaymentMethods', {
            total: getTotal(),
            onPaymentComplete: (paymentResult) => {
                // После подтверждения оплаты - завершаем продажу
                completeSaleWithPayment(paymentResult);
            }
        });
    };

    // Завершение продажи с указанием типа оплаты
    const completeSaleWithPayment = async (paymentResult) => {
        setLoading(true);
        try {
            const subtotal = getSubtotal();
            let discountPercent = discountType === 'percent'
                ? parseFloat(discountValue) || 0
                : subtotal > 0 ? ((parseFloat(discountValue) || 0) / subtotal) * 100 : 0;

            const saleData = {
                documentNumber: `MOB-${Date.now()}`,
                documentDate: new Date().toISOString().split('T')[0],
                counterpartyId: null,
                warehouseId: 1,
                items: cartItems.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price || item.price_sale,
                    vatRate: 12,
                    discountPercent: 0
                })),
                discountPercent: Math.min(100, Math.max(0, discountPercent)),
                notes: `${customerName || 'Мобильная продажа'} | Оплата: ${paymentResult.type}`,
                paymentType: paymentResult.type,
                autoConfirm: true
            };

            await salesAPI.create(saleData);
            SoundManager.playSuccess();

            Alert.alert('✅ Продажа оформлена!', `Сумма: ${formatPrice(getTotal())}\nОплата: ${paymentResult.type}`, [
                {
                    text: 'OK', onPress: () => {
                        setCartItems([]);
                        if (parentSetCart) parentSetCart([]);
                        navigation.navigate('Home');
                    }
                }
            ]);
        } catch (error) {
            SoundManager.playError();
            const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || 'Ошибка сервера';
            Alert.alert('Ошибка', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    const renderItem = ({ item }) => (
        <Card style={[styles.card, dynamicStyles.card]}>
            <Card.Content>
                <View style={styles.row}>
                    <View style={styles.info}>
                        <Title style={[styles.name, dynamicStyles.text]}>{item.name || 'Товар'}</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>{formatPrice(item.price || item.price_sale)}</Paragraph>
                    </View>
                    <IconButton icon="delete" iconColor={colors.error} onPress={() => deleteItem(item.id)} />
                </View>
                <View style={styles.quantityRow}>
                    <Paragraph style={dynamicStyles.text}>Кол-во:</Paragraph>
                    <IconButton icon="minus" mode="contained" size={20} onPress={() => updateQuantity(item.id, item.quantity - 1)} />
                    <TextInput
                        value={String(item.quantity)}
                        onChangeText={(text) => updateQuantity(item.id, text)}
                        keyboardType="numeric"
                        style={[styles.quantityInput, dynamicStyles.input]}
                        mode="outlined"
                        dense
                    />
                    <IconButton icon="plus" mode="contained" size={20} onPress={() => updateQuantity(item.id, item.quantity + 1)} />
                    <Paragraph style={[styles.itemTotal, { color: colors.success }]}>
                        = {formatPrice((item.price || item.price_sale) * item.quantity)}
                    </Paragraph>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <KeyboardAvoidingView 
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <TextInput
                        label="Имя клиента"
                        value={customerName}
                        onChangeText={setCustomerName}
                        style={[styles.input, dynamicStyles.input]}
                        mode="outlined"
                    />

                    <FlatList
                        data={cartItems}
                        renderItem={renderItem}
                        keyExtractor={item => String(item.id)}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        ListEmptyComponent={<Paragraph style={[styles.empty, dynamicStyles.textSecondary]}>Корзина пуста</Paragraph>}
                    />

                    {cartItems.length > 0 && (
                        <Card style={[styles.totalCard, dynamicStyles.card]}>
                            <Card.Content>
                                <SegmentedButtons
                                    value={discountType}
                                    onValueChange={setDiscountType}
                                    buttons={[
                                        { value: 'percent', label: '%' },
                                        { value: 'fixed', label: "So'm" },
                                    ]}
                                    style={styles.segmented}
                                />
                                <TextInput
                                    label={discountType === 'percent' ? 'Скидка %' : "Скидка (so'm)"}
                                    value={discountValue}
                                    onChangeText={setDiscountValue}
                                    keyboardType="numeric"
                                    style={[styles.discountInput, dynamicStyles.input]}
                                    mode="outlined"
                                    dense
                                />
                                <Divider style={styles.divider} />
                                <View style={styles.totalRow}>
                                    <Paragraph style={dynamicStyles.text}>Подытог:</Paragraph>
                                    <Paragraph style={dynamicStyles.text}>{formatPrice(getSubtotal())}</Paragraph>
                                </View>
                                {getDiscountAmount() > 0 && (
                                    <View style={styles.totalRow}>
                                        <Paragraph style={{ color: colors.warning }}>Скидка:</Paragraph>
                                        <Paragraph style={{ color: colors.warning }}>−{formatPrice(getDiscountAmount())}</Paragraph>
                                    </View>
                                )}
                                <View style={styles.totalRow}>
                                    <Title style={dynamicStyles.text}>ИТОГО:</Title>
                                    <Title style={{ color: colors.success, fontSize: 24 }}>{formatPrice(getTotal())}</Title>
                                </View>
                                <Button mode="contained" onPress={goToPayment} loading={loading} disabled={loading} style={styles.button} icon="cash">
                                    Выбрать способ оплаты
                                </Button>
                            </Card.Content>
                        </Card>
                    )}
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    input: { margin: 16, marginBottom: 8 },
    list: { padding: 16, paddingTop: 8 },
    card: { marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    info: { flex: 1 },
    name: { fontSize: 16 },
    quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
    quantityInput: { width: 80, textAlign: 'center' },
    itemTotal: { fontWeight: 'bold', flex: 1, textAlign: 'right' },
    empty: { textAlign: 'center', padding: 40 },
    totalCard: { margin: 16 },
    segmented: { marginBottom: 12 },
    discountInput: { marginBottom: 12 },
    divider: { marginVertical: 12 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    button: { marginTop: 12, paddingVertical: 8 },
});
