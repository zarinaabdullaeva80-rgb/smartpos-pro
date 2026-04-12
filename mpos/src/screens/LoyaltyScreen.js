import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Platform, Image, Modal, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider, TextInput, List, ActivityIndicator, Avatar, Dialog, Portal, Text } from 'react-native-paper';
import { loyaltyAPI, customersAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function LoyaltyScreen({ navigation }) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [program, setProgram] = useState(null);
    const [searchPhone, setSearchPhone] = useState('');
    const [customer, setCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showPointsDialog, setShowPointsDialog] = useState(false);
    const [pointsInput, setPointsInput] = useState('');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [showSpendDialog, setShowSpendDialog] = useState(false);
    const [spendPointsInput, setSpendPointsInput] = useState('');

    // Карта лояльности (barcode)
    const [cardData, setCardData] = useState(null);
    const [barcodeImage, setBarcodeImage] = useState(null);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [loadingCard, setLoadingCard] = useState(false);

    useEffect(() => {
        loadProgram();
    }, []);

    const loadProgram = async () => {
        try {
            setLoading(true);
            const res = await loyaltyAPI.getProgram();
            setProgram(res.data);
        } catch (error) {
            console.error('Error loading loyalty program:', error);
            setProgram({ name: 'Программа лояльности', description: 'Накапливайте баллы', pointsRate: 2, pointValue: 1 });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Загрузить данные карты и barcode
    const loadCard = async (custId) => {
        try {
            setLoadingCard(true);
            const [cardRes, barcodeRes] = await Promise.all([
                loyaltyAPI.getCard(custId),
                loyaltyAPI.getBarcode ? loyaltyAPI.getBarcode(custId) : null
            ].filter(Boolean));

            if (cardRes.data?.card) {
                setCardData(cardRes.data.card);
            }
            if (barcodeRes?.data?.barcode) {
                setBarcodeImage(barcodeRes.data.barcode);
            }
        } catch (error) {
            console.error('Error loading card:', error);
            // Попробовать загрузить barcode через прямой endpoint
            try {
                const res = await loyaltyAPI.getCard(custId);
                if (res.data?.card) setCardData(res.data.card);
            } catch (e) { /* ignore */ }
        } finally {
            setLoadingCard(false);
        }
    };

    const searchCustomer = async () => {
        if (!searchPhone.trim()) {
            Alert.alert('Ошибка', 'Введите номер телефона или имя');
            return;
        }

        try {
            setSearching(true);
            const res = await loyaltyAPI.checkBalance(searchPhone.trim());
            if (res.data) {
                const cust = res.data.customer || res.data;
                setCustomer(cust);
                // Загрузить карту и barcode
                const custId = cust.id;
                if (custId) {
                    loadCard(custId);
                    try {
                        const txRes = await loyaltyAPI.getTransactions(custId);
                        setTransactions(txRes.data?.transactions || []);
                    } catch (txErr) {
                        setTransactions([]);
                    }
                }
                SoundManager.playSuccess();
            } else {
                setCustomer(null);
                setCardData(null);
                setBarcodeImage(null);
                setTransactions([]);
                Alert.alert(
                    'Не найден',
                    'Клиент не найден. Создать нового?',
                    [
                        { text: 'Отмена', style: 'cancel' },
                        { text: 'Создать', onPress: () => { setNewCustomerName(''); setShowCreateDialog(true); } }
                    ]
                );
            }
        } catch (error) {
            if (error.response?.status === 404) {
                Alert.alert(
                    'Клиент не найден',
                    'Хотите создать нового клиента?',
                    [
                        { text: 'Отмена', style: 'cancel' },
                        { text: 'Создать', onPress: () => { setNewCustomerName(''); setShowCreateDialog(true); } }
                    ]
                );
            } else {
                SoundManager.playError();
                Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка поиска');
            }
            setCustomer(null);
            setCardData(null);
            setBarcodeImage(null);
            setTransactions([]);
        } finally {
            setSearching(false);
        }
    };

    const createCustomer = async () => {
        if (!newCustomerName.trim()) {
            Alert.alert('Ошибка', 'Введите имя клиента');
            return;
        }
        try {
            const res = await customersAPI.create({
                name: newCustomerName.trim(),
                phone: searchPhone.trim(),
                loyalty_points: 0
            });
            setShowCreateDialog(false);
            SoundManager.playSuccess();
            Alert.alert('Успех', 'Клиент создан с картой лояльности');
            searchCustomer();
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось создать клиента');
        }
    };

    const addPoints = () => {
        if (!customer) return;
        setPointsInput('');
        setShowPointsDialog(true);
    };

    const confirmAddPoints = async () => {
        const points = parseInt(pointsInput);
        if (!points || isNaN(points) || points <= 0) {
            Alert.alert('Ошибка', 'Введите корректное количество баллов');
            return;
        }
        try {
            setShowPointsDialog(false);
            await loyaltyAPI.addPoints(customer.id, points, 'Ручное начисление');
            SoundManager.playSuccess();
            Alert.alert('Успех', `Начислено ${points} баллов`);
            searchCustomer();
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось начислить баллы');
        }
    };

    const spendPoints = () => {
        if (!customer) return;
        setSpendPointsInput('');
        setShowSpendDialog(true);
    };

    const confirmSpendPoints = async () => {
        const points = parseInt(spendPointsInput);
        if (!points || isNaN(points) || points <= 0) {
            Alert.alert('Ошибка', 'Введите корректное количество баллов');
            return;
        }
        const balance = customer.points || customer.loyalty_points || 0;
        if (points > balance) {
            Alert.alert('Ошибка', `Недостаточно баллов. Баланс: ${balance}`);
            return;
        }
        try {
            setShowSpendDialog(false);
            await loyaltyAPI.redeemPoints(customer.id, points, null);
            SoundManager.playSuccess();
            Alert.alert('Успех', `Списано ${points} баллов`);
            searchCustomer();
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось списать баллы');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Н/Д';
        return new Date(dateStr).toLocaleString('ru-RU');
    };

    const formatCurrency = (value) => {
        return Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    };

    const formatCardNumber = (number) => {
        if (!number) return '';
        return String(number).replace(/(.{4})/g, '$1 ').trim();
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Paragraph style={[styles.loadingText, dynamicStyles.textSecondary]}>Загрузка...</Paragraph>
            </View>
        );
    }

    return (
        <>
            <ScrollView
                style={[styles.container, dynamicStyles.container]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProgram(); }} />
                }
            >
                {/* Программа лояльности */}
                {program && (
                    <Card style={[styles.card, dynamicStyles.card]}>
                        <Card.Content>
                            <Title style={dynamicStyles.text}>🎁 {program.name || 'Программа лояльности'}</Title>
                            <Paragraph style={dynamicStyles.textSecondary}>{program.description}</Paragraph>
                            <Divider style={styles.divider} />
                            <View style={styles.statsRow}>
                                <View style={styles.stat}>
                                    <Paragraph style={[styles.statValue, { color: colors.primary }]}>
                                        {program.pointsRate || 1}%
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Начисление</Paragraph>
                                </View>
                                <View style={styles.stat}>
                                    <Paragraph style={[styles.statValue, { color: colors.success }]}>
                                        1 = {program.pointValue || 1} so'm
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Курс балла</Paragraph>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* Поиск клиента */}
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>🔍 Поиск клиента</Title>
                        <TextInput
                            label="Номер телефона"
                            value={searchPhone}
                            onChangeText={setSearchPhone}
                            keyboardType="phone-pad"
                            style={[styles.input, dynamicStyles.input]}
                            mode="outlined"
                            left={<TextInput.Icon icon="phone" />}
                            right={<TextInput.Icon icon="magnify" onPress={searchCustomer} />}
                            onSubmitEditing={searchCustomer}
                        />
                        <Button
                            mode="contained"
                            onPress={searchCustomer}
                            loading={searching}
                            disabled={searching}
                            style={styles.button}
                            icon="account-search"
                        >
                            Найти клиента
                        </Button>
                    </Card.Content>
                </Card>

                {/* Данные клиента + Карта лояльности */}
                {customer && (
                    <Card style={[styles.card, dynamicStyles.card]}>
                        <Card.Content>
                            <View style={styles.customerHeader}>
                                <Avatar.Text
                                    size={48}
                                    label={(customer.name || customer.full_name || 'К')[0].toUpperCase()}
                                    style={{ backgroundColor: colors.primary }}
                                />
                                <View style={styles.customerInfo}>
                                    <Title style={dynamicStyles.text}>{customer.name || customer.full_name || 'Клиент'}</Title>
                                    <Paragraph style={dynamicStyles.textSecondary}>{customer.phone}</Paragraph>
                                </View>
                            </View>

                            <Divider style={styles.divider} />

                            <View style={styles.statsRow}>
                                <View style={styles.stat}>
                                    <Paragraph style={[styles.statValue, { color: colors.primary }]}>
                                        {customer.points || customer.loyalty_points || 0}
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Баллов</Paragraph>
                                </View>
                                <View style={styles.stat}>
                                    <Paragraph style={[styles.statValue, { color: colors.success }]}>
                                        {customer.level || customer.loyalty_level || 'Стандарт'}
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Уровень</Paragraph>
                                </View>
                                <View style={styles.stat}>
                                    <Paragraph style={[styles.statValue, dynamicStyles.text]}>
                                        {customer.purchases || customer.total_purchases || 0}
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Покупок</Paragraph>
                                </View>
                            </View>

                            {/* Карта лояльности с barcode */}
                            {(cardData || customer) && (
                                <TouchableOpacity
                                    onPress={() => setShowBarcodeModal(true)}
                                    activeOpacity={0.85}
                                    style={styles.loyaltyCardContainer}
                                >
                                    <View style={styles.loyaltyCard}>
                                        <View style={styles.cardHeader}>
                                            <View>
                                                <Paragraph style={styles.cardBrand}>SmartPOS</Paragraph>
                                                <Paragraph style={styles.cardBrandAccent}>Бонус</Paragraph>
                                            </View>
                                            <Chip
                                                style={styles.levelChip}
                                                textStyle={styles.levelChipText}
                                            >
                                                {cardData?.level || customer.level || '⭐ Standard'}
                                            </Chip>
                                        </View>

                                        <Paragraph style={styles.cardNumber}>
                                            {formatCardNumber(cardData?.number || customer.card_number || '')}
                                        </Paragraph>

                                        <Paragraph style={styles.cardName}>
                                            {customer.name || customer.full_name}
                                        </Paragraph>

                                        {/* Barcode */}
                                        {barcodeImage ? (
                                            <View style={styles.barcodeContainer}>
                                                <Image
                                                    source={{ uri: barcodeImage }}
                                                    style={styles.barcodeImage}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        ) : loadingCard ? (
                                            <View style={styles.barcodeContainer}>
                                                <ActivityIndicator size="small" color="#fff" />
                                            </View>
                                        ) : (
                                            <View style={styles.barcodeContainer}>
                                                <Paragraph style={styles.barcodePlaceholder}>
                                                    Нажмите для загрузки barcode
                                                </Paragraph>
                                            </View>
                                        )}

                                        <View style={styles.cardFooter}>
                                            <View>
                                                <Paragraph style={styles.cardBalanceLabel}>Баланс</Paragraph>
                                                <Paragraph style={styles.cardBalance}>
                                                    {(cardData?.balance || customer.points || customer.loyalty_points || 0).toLocaleString('ru-RU')} б.
                                                </Paragraph>
                                            </View>
                                            <View style={styles.cashbackBadge}>
                                                <Paragraph style={styles.cashbackText}>
                                                    Кэшбек {program?.pointsRate || 2}%
                                                </Paragraph>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}

                            <View style={styles.buttonRow}>
                                <Button
                                    mode="contained"
                                    onPress={addPoints}
                                    style={styles.actionButton}
                                    icon="plus"
                                >
                                    Начислить
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={spendPoints}
                                    style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                                    icon="minus"
                                >
                                    Списать
                                </Button>
                                <Button
                                    mode="outlined"
                                    onPress={() => setShowBarcodeModal(true)}
                                    style={styles.actionButton}
                                    icon="barcode"
                                >
                                    Barcode
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* История транзакций */}
                {customer && transactions.length > 0 && (
                    <Card style={[styles.card, dynamicStyles.card]}>
                        <Card.Content>
                            <Title style={dynamicStyles.text}>📋 История начислений</Title>
                            {transactions.slice(0, 10).map((tx, index) => (
                                <List.Item
                                    key={index}
                                    title={tx.reason || tx.description || 'Операция'}
                                    description={formatDate(tx.created_at || tx.date)}
                                    left={() => (
                                        <Avatar.Icon
                                            size={36}
                                            icon={tx.points > 0 || tx.amount > 0 ? 'plus' : 'minus'}
                                            style={{ backgroundColor: tx.points > 0 || tx.amount > 0 ? '#4CAF50' : '#F44336' }}
                                        />
                                    )}
                                    right={() => (
                                        <Chip
                                            style={{ backgroundColor: tx.points > 0 || tx.amount > 0 ? '#E8F5E9' : '#FFEBEE' }}
                                            textStyle={{ color: tx.points > 0 || tx.amount > 0 ? '#4CAF50' : '#F44336' }}
                                        >
                                            {tx.points > 0 || tx.amount > 0 ? '+' : ''}{tx.points || tx.amount}
                                        </Chip>
                                    )}
                                />
                            ))}
                        </Card.Content>
                    </Card>
                )}

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Модал barcode на полный экран */}
            <Modal
                visible={showBarcodeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowBarcodeModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowBarcodeModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalCard}>
                            <Paragraph style={styles.modalBrand}>SmartPOS <Paragraph style={styles.modalBrandAccent}>Бонус</Paragraph></Paragraph>
                            <Paragraph style={styles.modalCardNumber}>
                                {formatCardNumber(cardData?.number || customer?.card_number || '')}
                            </Paragraph>
                            <Paragraph style={styles.modalName}>
                                {customer?.name || customer?.full_name || ''}
                            </Paragraph>
                            {barcodeImage ? (
                                <Image
                                    source={{ uri: barcodeImage }}
                                    style={styles.modalBarcode}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.modalBarcodePlaceholder}>
                                    <ActivityIndicator size="small" color="#1e3a5f" />
                                    <Paragraph style={{ color: '#666', marginTop: 8 }}>Загрузка barcode...</Paragraph>
                                </View>
                            )}
                            <Paragraph style={styles.modalBalance}>
                                Баланс: {(cardData?.balance || customer?.points || customer?.loyalty_points || 0).toLocaleString('ru-RU')} баллов
                            </Paragraph>
                            <Button
                                mode="text"
                                onPress={() => setShowBarcodeModal(false)}
                                style={{ marginTop: 8 }}
                            >
                                Закрыть
                            </Button>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Диалог начисления баллов */}
            <Portal>
                <Dialog visible={showPointsDialog} onDismiss={() => setShowPointsDialog(false)}>
                    <Dialog.Title>Начислить баллы</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Количество баллов"
                            value={pointsInput}
                            onChangeText={setPointsInput}
                            keyboardType="numeric"
                            mode="outlined"

                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowPointsDialog(false)}>Отмена</Button>
                        <Button onPress={confirmAddPoints}>Начислить</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Диалог создания клиента */}
            <Portal>
                <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
                    <Dialog.Title>Новый клиент</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Имя клиента"
                            value={newCustomerName}
                            onChangeText={setNewCustomerName}
                            mode="outlined"

                            style={{ marginBottom: 8 }}
                        />
                        <TextInput
                            label="Телефон"
                            value={searchPhone}
                            disabled={true}
                            mode="outlined"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowCreateDialog(false)}>Отмена</Button>
                        <Button onPress={createCustomer}>Создать</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Диалог списания баллов */}
            <Portal>
                <Dialog visible={showSpendDialog} onDismiss={() => setShowSpendDialog(false)}>
                    <Dialog.Title>Списать баллы</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ marginBottom: 8, color: '#666' }}>
                            Баланс: {customer?.points || customer?.loyalty_points || 0} баллов
                        </Paragraph>
                        <TextInput
                            label="Количество баллов"
                            value={spendPointsInput}
                            onChangeText={setSpendPointsInput}
                            keyboardType="numeric"
                            mode="outlined"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowSpendDialog(false)}>Отмена</Button>
                        <Button onPress={confirmSpendPoints}>Списать</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    card: { margin: 16, marginBottom: 8 },
    loadingText: { marginTop: 16 },
    input: { marginBottom: 12 },
    button: { marginTop: 8 },
    divider: { marginVertical: 16 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    stat: { alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: 'bold' },
    customerHeader: { flexDirection: 'row', alignItems: 'center' },
    customerInfo: { marginLeft: 16, flex: 1 },
    buttonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    actionButton: { flex: 1 },
    bottomPadding: { height: 32 },

    // Карта лояльности
    loyaltyCardContainer: { marginTop: 16 },
    loyaltyCard: {
        backgroundColor: '#1e3a5f',
        borderRadius: 16,
        padding: 20,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    cardBrand: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 24,
    },
    cardBrandAccent: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffd700',
    },
    levelChip: {
        backgroundColor: 'rgba(255,215,0,0.2)',
    },
    levelChipText: {
        color: '#ffd700',
        fontSize: 11,
    },
    cardNumber: {
        fontSize: 18,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        letterSpacing: 3,
        color: '#e0e0e0',
        marginBottom: 4,
    },
    cardName: {
        fontSize: 13,
        color: '#b0bec5',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    barcodeContainer: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        minHeight: 60,
    },
    barcodeImage: {
        width: '100%',
        height: 50,
    },
    barcodePlaceholder: {
        color: '#999',
        fontSize: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardBalanceLabel: {
        fontSize: 10,
        color: '#90a4ae',
    },
    cardBalance: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4ade80',
    },
    cashbackBadge: {
        backgroundColor: 'rgba(255,215,0,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    cashbackText: {
        color: '#ffd700',
        fontSize: 12,
        fontWeight: 'bold',
    },

    // Модал barcode
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    modalBrand: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e3a5f',
        marginBottom: 12,
    },
    modalBrandAccent: {
        color: '#d4a017',
        fontWeight: 'bold',
    },
    modalCardNumber: {
        fontSize: 20,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        letterSpacing: 3,
        color: '#333',
        marginBottom: 4,
    },
    modalName: {
        fontSize: 14,
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: 16,
    },
    modalBarcode: {
        width: 260,
        height: 70,
        marginBottom: 12,
    },
    modalBarcodePlaceholder: {
        alignItems: 'center',
        padding: 20,
    },
    modalBalance: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e3a5f',
    },
});
