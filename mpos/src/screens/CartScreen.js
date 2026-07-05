import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, TouchableOpacity, Modal } from 'react-native';
import { Card, Title, Paragraph, Button, IconButton, TextInput, Divider, SegmentedButtons, Avatar, Chip, Dialog, Portal, ActivityIndicator } from 'react-native-paper';
import { salesAPI, shiftsAPI, loyaltyAPI } from '../services/api';
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

    // Loyalty state
    const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
    const [showLoyaltySearch, setShowLoyaltySearch] = useState(false);
    const [loyaltyPhone, setLoyaltyPhone] = useState('');
    const [loyaltySearching, setLoyaltySearching] = useState(false);
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToUse, setPointsToUse] = useState('');
    // Loyalty — баланс
    const [showBalanceDialog, setShowBalanceDialog] = useState(false);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [loyaltyTransactions, setLoyaltyTransactions] = useState([]);
    // Loyalty — списание
    const [showDeductDialog, setShowDeductDialog] = useState(false);
    const [deductAmount, setDeductAmount] = useState('');
    const [deductLoading, setDeductLoading] = useState(false);
    // Loyalty — кешбек
    const [cashbackEnabled, setCashbackEnabled] = useState(false);
    const [cashbackPercent, setCashbackPercent] = useState(0);
    const [cashbackAmount, setCashbackAmount] = useState(0);

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

    const getLoyaltyDiscount = () => {
        if (!usePoints || !loyaltyCustomer) return 0;
        const pts = parseInt(pointsToUse) || 0;
        const available = loyaltyCustomer.points || loyaltyCustomer.loyalty_points || 0;
        return Math.min(pts, available);
    };

    const getTotal = () => Math.max(0, getSubtotal() - getDiscountAmount() - getLoyaltyDiscount());

    const formatPrice = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    // --- Loyalty search ---
    const searchLoyaltyCustomer = async () => {
        if (!loyaltyPhone.trim()) {
            Alert.alert('Ошибка', 'Введите номер телефона или имя');
            return;
        }
        try {
            setLoyaltySearching(true);
            const res = await loyaltyAPI.checkBalance(loyaltyPhone.trim());
            if (res.data?.customer) {
                setLoyaltyCustomer(res.data.customer);
                setCustomerName(res.data.customer.name || res.data.customer.full_name || '');
                setShowLoyaltySearch(false);
                SoundManager.playSuccess();
            } else {
                Alert.alert('Не найден', 'Клиент не найден');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                Alert.alert('Не найден', 'Клиент с таким номером не найден');
            } else {
                Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка поиска');
            }
        } finally {
            setLoyaltySearching(false);
        }
    };

    // --- Поиск по штрихкоду карты лояльности ---
    const searchByBarcode = async (cardNumber) => {
        if (!cardNumber?.trim()) return;
        try {
            setLoyaltySearching(true);
            setShowLoyaltySearch(false);
            const res = await loyaltyAPI.scanCard(cardNumber.trim(), null);
            if (res.data?.customer) {
                const c = res.data.customer;
                // Нормализуем структуру — /scan возвращает balance вместо points
                setLoyaltyCustomer({
                    ...c,
                    points: c.balance ?? c.points ?? 0,
                    loyalty_points: c.balance ?? c.points ?? 0,
                });
                setCustomerName(c.name || c.full_name || '');
                SoundManager.playSuccess();
            } else {
                Alert.alert('Не найдено', 'Карта лояльности не найдена');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                Alert.alert('Не найдено', 'Карта с таким штрихкодом не найдена');
            } else {
                Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка сканирования');
            }
        } finally {
            setLoyaltySearching(false);
        }
    };

    // Открыть сканер камеры для штрихкода карты лояльности
    const scanLoyaltyBarcode = () => {
        setShowLoyaltySearch(false);
        navigation.navigate('BarcodeScanner', {
            onScan: (data) => searchByBarcode(data),
        });
    };

    const removeLoyaltyCustomer = () => {
        setLoyaltyCustomer(null);
        setUsePoints(false);
        setPointsToUse('');
        setCustomerName('');
        setCashbackEnabled(false);
        setCashbackAmount(0);
    };

    // --- Просмотр баланса ---
    const openBalanceDialog = async () => {
        setShowBalanceDialog(true);
        setBalanceLoading(true);
        try {
            const res = await loyaltyAPI.getTransactions(loyaltyCustomer.id);
            setLoyaltyTransactions((res.data?.transactions || res.data || []).slice(0, 5));
        } catch {
            setLoyaltyTransactions([]);
        } finally {
            setBalanceLoading(false);
        }
    };

    // --- Ручное списание ---
    const confirmDeduct = async () => {
        const pts = parseInt(deductAmount);
        const available = loyaltyCustomer?.points || loyaltyCustomer?.loyalty_points || 0;
        if (!pts || pts <= 0) { Alert.alert('Ошибка', 'Введите сумму для списания'); return; }
        if (pts > available) { Alert.alert('Ошибка', `Недостаточно баллов. Доступно: ${available}`); return; }
        setDeductLoading(true);
        try {
            await loyaltyAPI.redeemPoints(loyaltyCustomer.id, pts, null);
            const newBalance = available - pts;
            setLoyaltyCustomer(prev => ({ ...prev, points: newBalance, loyalty_points: newBalance }));
            setDeductAmount('');
            setShowDeductDialog(false);
            SoundManager.playSuccess();
            Alert.alert('✅ Списано', `${pts} баллов успешно списано с карты`);
        } catch (error) {
            Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка списания');
        } finally {
            setDeductLoading(false);
        }
    };

    // --- Кешбек: загрузить % при включении ---
    const toggleCashback = async () => {
        if (cashbackEnabled) {
            setCashbackEnabled(false);
            setCashbackAmount(0);
            return;
        }
        try {
            const res = await loyaltyAPI.getSettings();
            const pct = parseFloat(res.data?.cashback_percent || res.data?.pointsPercent || res.data?.settings?.cashback_percent || 1);
            setCashbackPercent(pct);
            const total = getTotal();
            const earned = Math.floor(total * pct / 100);
            setCashbackAmount(earned);
            setCashbackEnabled(true);
        } catch {
            const earned = Math.floor(getTotal() * 1 / 100);
            setCashbackPercent(1);
            setCashbackAmount(earned);
            setCashbackEnabled(true);
        }
    };

    // Начислить кешбек после продажи
    const accrueAfterSale = async (saleId) => {
        if (!cashbackEnabled || !loyaltyCustomer?.id || cashbackAmount <= 0) return;
        try {
            await loyaltyAPI.addPoints(
                loyaltyCustomer.id,
                cashbackAmount,
                `Кешбек ${cashbackPercent}% за продажу ${saleId || ''}`
            );
        } catch (e) {
            console.warn('[Loyalty] Cashback accrue failed:', e.message);
        }
    };

    // --- Sale logic ---
    const buildSaleData = (paymentResult) => {
        const subtotal = getSubtotal();
        let discountPercent = discountType === 'percent'
            ? parseFloat(discountValue) || 0
            : subtotal > 0 ? ((parseFloat(discountValue) || 0) / subtotal) * 100 : 0;

        const loyaltyDiscount = getLoyaltyDiscount();

        return {
            documentNumber: `MOB-${Date.now()}`,
            documentDate: new Date().toISOString().split('T')[0],
            counterpartyId: loyaltyCustomer?.id || null,
            warehouseId: warehouseId || null,
            items: cartItems.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                price: item.price || item.price_sale,
                vatRate: 12,
                discountPercent: 0
            })),
            discountPercent: Math.min(100, Math.max(0, discountPercent)),
            loyaltyPointsUsed: loyaltyDiscount,
            notes: paymentResult
                ? `${customerName || 'Мобильная продажа'} | Оплата: ${paymentResult.type}`
                : customerName || 'Мобильная продажа',
            paymentType: paymentResult?.type,
            autoConfirm: true
        };
    };

    const completeSale = async () => {
        let shift = currentShift;
        if (!shift) shift = await checkShift();
        if (!shift) { Alert.alert('Ошибка', 'Сначала откройте смену.'); return; }
        if (cartItems.length === 0) { Alert.alert('Ошибка', 'Корзина пуста'); return; }

        setLoading(true);
        try {
            await salesAPI.create(buildSaleData(null));
            SoundManager.playSuccess();
            Alert.alert('Успех!', `Продажа на ${formatPrice(getTotal())} оформлена`, [{
                text: 'OK', onPress: () => {
                    setCartItems([]); if (parentSetCart) parentSetCart([]); navigation.goBack();
                }
            }]);
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || error.response?.data?.details || error.message || 'Ошибка сервера');
        } finally { setLoading(false); }
    };

    const goToPayment = () => {
        if (!currentShift) { Alert.alert('Ошибка', 'Сначала откройте смену'); return; }
        if (cartItems.length === 0) { Alert.alert('Ошибка', 'Корзина пуста'); return; }
        navigation.navigate('PaymentMethods', {
            total: getTotal(),
            onPaymentComplete: (paymentResult) => completeSaleWithPayment(paymentResult)
        });
    };

    const completeSaleWithPayment = async (paymentResult) => {
        setLoading(true);
        try {
            const saleRes = await salesAPI.create(buildSaleData(paymentResult));
            const saleId = saleRes.data?.id || saleRes.data?.documentNumber;
            // Начисляем кешбек если включён
            await accrueAfterSale(saleId);
            SoundManager.playSuccess();
            const cashbackNote = cashbackEnabled && cashbackAmount > 0
                ? `\n⭐ Кешбек ${cashbackAmount} баллов начислен` : '';
            Alert.alert('✅ Продажа оформлена!', `Сумма: ${formatPrice(getTotal())}\nОплата: ${paymentResult.type}${cashbackNote}`, [{
                text: 'OK', onPress: () => {
                    setCartItems([]); if (parentSetCart) parentSetCart([]); navigation.navigate('Home');
                }
            }]);
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || error.response?.data?.details || error.message || 'Ошибка сервера');
        } finally { setLoading(false); }
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

    const customerPoints = loyaltyCustomer?.points || loyaltyCustomer?.loyalty_points || 0;

    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    {/* Loyalty Customer Section */}
                    {loyaltyCustomer ? (
                        <Card style={[styles.loyaltyCard, { backgroundColor: '#1e3a5f' }]}>
                            <Card.Content>
                                <View style={styles.loyaltyRow}>
                                    <Avatar.Text
                                        size={40}
                                        label={(loyaltyCustomer.name || 'К')[0].toUpperCase()}
                                        style={{ backgroundColor: '#ffd700' }}
                                        color="#1e3a5f"
                                    />
                                    <View style={styles.loyaltyInfo}>
                                        <Paragraph style={styles.loyaltyName}>
                                            {loyaltyCustomer.name || loyaltyCustomer.full_name}
                                        </Paragraph>
                                        <Paragraph style={styles.loyaltyPhone}>
                                            {loyaltyCustomer.phone}
                                        </Paragraph>
                                    </View>
                                    <View style={styles.loyaltyPointsBox}>
                                        <Paragraph style={styles.loyaltyPointsValue}>{customerPoints}</Paragraph>
                                        <Paragraph style={styles.loyaltyPointsLabel}>баллов</Paragraph>
                                    </View>
                                    <IconButton icon="close" iconColor="#fff" size={20} onPress={removeLoyaltyCustomer} />
                                </View>
                                {/* Три кнопки действий */}
                                <View style={styles.loyaltyActionsRow}>
                                    <Button
                                        mode="outlined"
                                        icon="eye"
                                        compact
                                        onPress={openBalanceDialog}
                                        style={styles.loyaltyActionBtn}
                                        labelStyle={styles.loyaltyActionLabel}
                                    >Баланс</Button>
                                    <Button
                                        mode="outlined"
                                        icon="minus-circle"
                                        compact
                                        onPress={() => { setDeductAmount(''); setShowDeductDialog(true); }}
                                        style={[styles.loyaltyActionBtn, { borderColor: '#f87171' }]}
                                        labelStyle={[styles.loyaltyActionLabel, { color: '#f87171' }]}
                                    >Списать</Button>
                                    <Button
                                        mode={cashbackEnabled ? 'contained' : 'outlined'}
                                        icon={cashbackEnabled ? 'check-circle' : 'cash-plus'}
                                        compact
                                        onPress={toggleCashback}
                                        style={[styles.loyaltyActionBtn, cashbackEnabled && { backgroundColor: '#10b981' }]}
                                        labelStyle={[styles.loyaltyActionLabel, { color: cashbackEnabled ? '#fff' : '#10b981' }]}
                                        buttonColor={cashbackEnabled ? '#10b981' : undefined}
                                    >{cashbackEnabled ? `+${cashbackAmount}б` : 'Кешбек'}</Button>
                                </View>
                                {customerPoints > 0 && (
                                    <View style={styles.usePointsRow}>
                                        <Button
                                            mode={usePoints ? 'contained' : 'outlined'}
                                            onPress={() => { setUsePoints(!usePoints); if (usePoints) setPointsToUse(''); }}
                                            style={styles.usePointsBtn}
                                            labelStyle={{ fontSize: 12, color: usePoints ? '#1e3a5f' : '#ffd700' }}
                                            buttonColor={usePoints ? '#ffd700' : undefined}
                                            icon={usePoints ? 'check' : 'star'}
                                            compact
                                        >
                                            {usePoints ? 'Баллы применены' : 'Использовать баллы'}
                                        </Button>
                                        {usePoints && (
                                            <TextInput
                                                value={pointsToUse}
                                                onChangeText={(t) => {
                                                    const v = parseInt(t) || 0;
                                                    setPointsToUse(v > customerPoints ? String(customerPoints) : t);
                                                }}
                                                keyboardType="numeric"
                                                placeholder={`макс ${customerPoints}`}
                                                placeholderTextColor="#90a4ae"
                                                style={styles.pointsInput}
                                                mode="outlined"
                                                dense
                                                outlineColor="#ffd700"
                                                activeOutlineColor="#ffd700"
                                                textColor="#fff"
                                            />
                                        )}
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    ) : (
                        <Button
                            mode="outlined"
                            onPress={() => setShowLoyaltySearch(true)}
                            style={styles.loyaltyButton}
                            icon="card-account-details-star"
                            textColor={colors.primary}
                        >
                            Карта лояльности клиента
                        </Button>
                    )}

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
                                {getLoyaltyDiscount() > 0 && (
                                    <View style={styles.totalRow}>
                                        <Paragraph style={{ color: '#ffd700' }}>⭐ Баллы:</Paragraph>
                                        <Paragraph style={{ color: '#ffd700' }}>−{formatPrice(getLoyaltyDiscount())}</Paragraph>
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

            {/* Loyalty Balance Dialog */}
            <Portal>
                <Dialog visible={showBalanceDialog} onDismiss={() => setShowBalanceDialog(false)}>
                    <Dialog.Title>⭐ Баланс карты лояльности</Dialog.Title>
                    <Dialog.Content>
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <Paragraph style={{ color: '#4ade80', fontSize: 36, fontWeight: 'bold' }}>
                                {loyaltyCustomer?.points || loyaltyCustomer?.loyalty_points || 0}
                            </Paragraph>
                            <Paragraph style={{ color: '#90a4ae' }}>баллов</Paragraph>
                            <Paragraph style={{ color: '#ffd700', marginTop: 4 }}>
                                {loyaltyCustomer?.level || ''}
                            </Paragraph>
                        </View>
                        <Divider style={{ marginBottom: 12 }} />
                        <Paragraph style={{ color: '#90a4ae', marginBottom: 8, fontWeight: 'bold' }}>Последние операции:</Paragraph>
                        {balanceLoading
                            ? <ActivityIndicator size="small" />
                            : loyaltyTransactions.length === 0
                                ? <Paragraph style={{ color: '#90a4ae' }}>Операций нет</Paragraph>
                                : loyaltyTransactions.map((t, i) => (
                                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Paragraph style={{ color: '#ccc', flex: 1, fontSize: 12 }} numberOfLines={1}>
                                            {t.description || t.reason || t.type || 'Операция'}
                                        </Paragraph>
                                        <Paragraph style={{ color: t.points > 0 ? '#4ade80' : '#f87171', fontWeight: 'bold', fontSize: 12 }}>
                                            {t.points > 0 ? '+' : ''}{t.points}
                                        </Paragraph>
                                    </View>
                                ))
                        }
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowBalanceDialog(false)}>Закрыть</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Loyalty Deduct Dialog */}
            <Portal>
                <Dialog visible={showDeductDialog} onDismiss={() => setShowDeductDialog(false)}>
                    <Dialog.Title>➖ Списание баллов</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ color: '#90a4ae', marginBottom: 12 }}>
                            Доступно: {loyaltyCustomer?.points || loyaltyCustomer?.loyalty_points || 0} баллов
                        </Paragraph>
                        <TextInput
                            label="Сумма для списания"
                            value={deductAmount}
                            onChangeText={setDeductAmount}
                            keyboardType="numeric"
                            mode="outlined"
                            left={<TextInput.Icon icon="minus-circle" />}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowDeductDialog(false)}>Отмена</Button>
                        <Button
                            onPress={confirmDeduct}
                            loading={deductLoading}
                            disabled={deductLoading}
                            textColor="#f87171"
                        >Списать</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Loyalty Search Dialog */}
            <Portal>
                <Dialog visible={showLoyaltySearch} onDismiss={() => setShowLoyaltySearch(false)}>
                    <Dialog.Title>🔍 Карта лояльности</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Телефон или имя"
                            value={loyaltyPhone}
                            onChangeText={setLoyaltyPhone}
                            keyboardType="phone-pad"
                            mode="outlined"
                            left={<TextInput.Icon icon="phone" />}
                            onSubmitEditing={searchLoyaltyCustomer}
                            style={{ marginBottom: 12 }}
                        />
                        <Button
                            mode="outlined"
                            icon="barcode-scan"
                            onPress={scanLoyaltyBarcode}
                            style={styles.barcodeBtn}
                            contentStyle={{ flexDirection: 'row-reverse' }}
                        >
                            Сканировать штрихкод карты
                        </Button>
                        {loyaltySearching && <ActivityIndicator size="small" style={{ marginTop: 12 }} />}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowLoyaltySearch(false)}>Отмена</Button>
                        <Button onPress={searchLoyaltyCustomer} loading={loyaltySearching}>Найти</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
    // Loyalty
    loyaltyButton: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderStyle: 'dashed' },
    loyaltyCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 14 },
    loyaltyRow: { flexDirection: 'row', alignItems: 'center' },
    loyaltyInfo: { flex: 1, marginLeft: 12 },
    loyaltyName: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    loyaltyPhone: { color: '#90a4ae', fontSize: 12 },
    loyaltyPointsBox: { alignItems: 'center', marginRight: 4 },
    loyaltyPointsValue: { color: '#4ade80', fontSize: 20, fontWeight: 'bold' },
    loyaltyPointsLabel: { color: '#90a4ae', fontSize: 10 },
    usePointsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    usePointsBtn: { borderColor: '#ffd700' },
    pointsInput: { width: 100, backgroundColor: 'rgba(255,255,255,0.1)', fontSize: 14 },
    barcodeBtn: { borderStyle: 'dashed', borderColor: '#10b981', marginTop: 4 },
    loyaltyActionsRow: { flexDirection: 'row', gap: 6, marginTop: 10, justifyContent: 'space-between' },
    loyaltyActionBtn: { flex: 1, borderColor: '#4ade80' },
    loyaltyActionLabel: { fontSize: 11, color: '#4ade80' },
});
