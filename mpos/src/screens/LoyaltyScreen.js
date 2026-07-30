import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Platform, Image, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, Divider, TextInput, List, ActivityIndicator, Avatar, Dialog, Portal, Text, SegmentedButtons, IconButton } from 'react-native-paper';
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

    // Модалы баллов
    const [showPointsDialog, setShowPointsDialog] = useState(false);
    const [pointsInput, setPointsInput] = useState('');
    const [showSpendDialog, setShowSpendDialog] = useState(false);
    const [spendPointsInput, setSpendPointsInput] = useState('');

    // Модал создания клиента
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');

    // Карта лояльности (barcode)
    const [cardData, setCardData] = useState(null);
    const [barcodeImage, setBarcodeImage] = useState(null);
    const [showBarcodeModal, setShowBarcodeModal] = useState(false);
    const [loadingCard, setLoadingCard] = useState(false);

    // --- 3. Прикрепление карты к клиенту ---
    const [showAttachDialog, setShowAttachDialog] = useState(false);
    const [attachCardNumber, setAttachCardNumber] = useState('');
    const [attachSearchQuery, setAttachSearchQuery] = useState('');
    const [attachCustomers, setAttachCustomers] = useState([]);
    const [selectedAttachCustomer, setSelectedAttachCustomer] = useState(null);
    const [attachLoading, setAttachLoading] = useState(false);

    // --- 1. Общая история vs История карты ---
    const [historyTab, setHistoryTab] = useState('customer'); // 'customer' | 'all'
    const [allTransactions, setAllTransactions] = useState([]);
    const [loadingAllTx, setLoadingAllTx] = useState(false);

    useEffect(() => {
        loadProgram();
        loadAllTransactions();
        autoLoadCustomer();
    }, []);

    const autoLoadCustomer = async () => {
        try {
            const res = await customersAPI.getAll({ limit: 500 });
            const list = res.data?.customers || res.data || [];
            setAttachCustomers(list);
            if (list.length > 0) {
                const first = list.find(c => c.card_number || c.loyalty_points > 0) || list[0];
                setCustomer(first);
                loadCard(first.id);
                try {
                    const txRes = await loyaltyAPI.getTransactions(first.id);
                    setTransactions(txRes.data?.transactions || []);
                } catch { setTransactions([]); }
            }
        } catch (e) {
            console.log('[Loyalty] autoLoadCustomer error:', e.message);
        }
    };

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

    const loadAllTransactions = async () => {
        try {
            setLoadingAllTx(true);
            const res = await loyaltyAPI.getAllTransactions({ limit: 50 });
            setAllTransactions(res.data?.transactions || []);
        } catch (error) {
            console.error('Error loading all transactions:', error);
            setAllTransactions([]);
        } finally {
            setLoadingAllTx(false);
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
            try {
                const res = await loyaltyAPI.getCard(custId);
                if (res.data?.card) setCardData(res.data.card);
            } catch (e) { /* ignore */ }
        } finally {
            setLoadingCard(false);
        }
    };

    // Поиск клиента по цифрам карты / телефону / имени
    const searchCustomer = async () => {
        const query = searchPhone.trim();
        if (!query) {
            Alert.alert('Ошибка', 'Введите цифры карты лояльности, телефон или имя');
            return;
        }

        try {
            setSearching(true);
            // Пробуем сначала сканировать / искать по карте
            let res;
            try {
                res = await loyaltyAPI.scanCard(query, null);
            } catch {
                res = await loyaltyAPI.checkBalance(query);
            }

            if (res.data?.customer) {
                const cust = res.data.customer;
                setCustomer(cust);
                const custId = cust.id;
                if (custId) {
                    loadCard(custId);
                    try {
                        const txRes = await loyaltyAPI.getTransactions(custId);
                        setTransactions(txRes.data?.transactions || []);
                    } catch {
                        setTransactions([]);
                    }
                }
                SoundManager.playSuccess();
            } else {
                handleUnattachedCard(query);
            }
        } catch (error) {
            if (error.response?.status === 404) {
                handleUnattachedCard(query);
            } else {
                SoundManager.playError();
                Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка поиска');
            }
        } finally {
            setSearching(false);
        }
    };

    // --- 2. Сканирование карты камерой ---
    const scanCardWithCamera = () => {
        navigation.navigate('BarcodeScanner', {
            onScan: (scannedCode) => handleScanCard(scannedCode),
        });
    };

    const handleScanCard = async (scannedCode) => {
        if (!scannedCode || !scannedCode.trim()) return;
        const cleanCode = scannedCode.trim();
        setSearchPhone(cleanCode);

        try {
            setSearching(true);
            const res = await loyaltyAPI.scanCard(cleanCode, null);
            if (res.data?.customer) {
                const cust = res.data.customer;
                setCustomer(cust);
                loadCard(cust.id);
                try {
                    const txRes = await loyaltyAPI.getTransactions(cust.id);
                    setTransactions(txRes.data?.transactions || []);
                } catch { setTransactions([]); }
                SoundManager.playSuccess();
            } else {
                // 4. Прикрепление карты после сканирования
                handleUnattachedCard(cleanCode);
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // 4. Прикрепление карты после сканирования
                handleUnattachedCard(cleanCode);
            } else {
                SoundManager.playError();
                Alert.alert('Ошибка', error.response?.data?.error || 'Ошибка сканирования');
            }
        } finally {
            setSearching(false);
        }
    };

    // --- 4. Прикрепление карты после сканирования / если карта не привязана ---
    const handleUnattachedCard = (cardNumber) => {
        setCustomer(null);
        setCardData(null);
        setBarcodeImage(null);
        setTransactions([]);
        SoundManager.playTap();

        Alert.alert(
            '💳 Карта не найдена',
            `Карта № ${cardNumber} не привязана к клиенту. Выберите действие:`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Привязать к клиенту',
                    onPress: () => openAttachModal(cardNumber)
                },
                {
                    text: 'Создать нового',
                    onPress: () => {
                        setNewCustomerName('');
                        setNewCustomerPhone(cardNumber.length < 12 ? cardNumber : '');
                        setAttachCardNumber(cardNumber);
                        setShowCreateDialog(true);
                    }
                }
            ]
        );
    };

    // --- 3. Модал прикрепления карты к существующему клиенту ---
    const openAttachModal = async (prefilledCardNumber = '') => {
        setAttachCardNumber(prefilledCardNumber || '');
        setAttachSearchQuery('');
        setSelectedAttachCustomer(null);
        setShowAttachDialog(true);
        loadAttachCustomers('');
    };

    const loadAttachCustomers = async (searchQuery = '') => {
        try {
            setAttachLoading(true);
            const res = await customersAPI.getAll({ search: searchQuery, limit: 500 });
            const list = res.data?.customers || res.data || [];
            setAttachCustomers(list);
        } catch (err) {
            console.error('Error loading customers for attach:', err);
            setAttachCustomers([]);
        } finally {
            setAttachLoading(false);
        }
    };

    const confirmDetachCard = async () => {
        if (!customer) return;
        Alert.alert(
            'Отвязать карту',
            `Вы действительно хотите отвязать карту лояльности у клиента "${customer.name || customer.full_name}"?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Отвязать',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await loyaltyAPI.detachCard(customer.id);
                            SoundManager.playSuccess();
                            Alert.alert('✅ Успех', 'Карта лояльности отвязана от клиента');
                            setCardData(null);
                            setBarcodeImage(null);
                            setCustomer(prev => ({ ...prev, card_number: null }));
                        } catch (e) {
                            SoundManager.playError();
                            Alert.alert('Ошибка', e.response?.data?.error || 'Не удалось отвязать карту');
                        }
                    }
                }
            ]
        );
    };

    const confirmAttachCard = async () => {
        if (!selectedAttachCustomer) {
            Alert.alert('Ошибка', 'Выберите клиента для привязки карты');
            return;
        }
        if (!attachCardNumber.trim()) {
            Alert.alert('Ошибка', 'Введите номер карты');
            return;
        }

        try {
            setAttachLoading(true);
            const res = await loyaltyAPI.attachCard(selectedAttachCustomer.id, attachCardNumber.trim());
            setShowAttachDialog(false);
            SoundManager.playSuccess();
            Alert.alert('✅ Успех', res.data?.message || 'Карта успешно привязана!');
            
            const cust = res.data?.customer || selectedAttachCustomer;
            setCustomer(cust);
            setSearchPhone(cust.phone || attachCardNumber.trim());
            loadCard(cust.id);
            try {
                const txRes = await loyaltyAPI.getTransactions(cust.id);
                setTransactions(txRes.data?.transactions || []);
            } catch { setTransactions([]); }
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось привязать карту');
        } finally {
            setAttachLoading(false);
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
                phone: newCustomerPhone.trim() || searchPhone.trim() || undefined,
                card_number: attachCardNumber.trim() || undefined,
                loyalty_points: 0
            });
            const created = res.data?.customer || res.data;
            setShowCreateDialog(false);
            setAttachCardNumber('');
            SoundManager.playSuccess();
            Alert.alert('✅ Успех', 'Клиент создан и карта привязана');
            if (created) {
                setCustomer(created);
                setSearchPhone(created.phone || created.card_number || '');
                loadCard(created.id);
                setTransactions([]);
            }
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
            loadAllTransactions();
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
            loadAllTransactions();
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.response?.data?.error || 'Не удалось списать баллы');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Н/Д';
        return new Date(dateStr).toLocaleString('ru-RU');
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
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProgram(); loadAllTransactions(); autoLoadCustomer(); }} />
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
                                        {program.pointsRate || 2}%
                                    </Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>Кэшбек</Paragraph>
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

                {/* Поиск и прикрепление карты лояльности */}
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>💳 Поиск и карты лояльности</Title>
                        <TextInput
                            label="Цифры карты, телефон или имя"
                            value={searchPhone}
                            onChangeText={setSearchPhone}
                            keyboardType="default"
                            style={[styles.input, dynamicStyles.input]}
                            mode="outlined"
                            left={<TextInput.Icon icon="card-account-details-star" />}
                            right={<TextInput.Icon icon="magnify" onPress={searchCustomer} />}
                            onSubmitEditing={searchCustomer}
                            placeholder="Напр. 77770001 или 901234567"
                        />
                        <View style={styles.searchButtonsRow}>
                            <Button
                                mode="contained"
                                onPress={searchCustomer}
                                loading={searching}
                                disabled={searching}
                                style={{ flex: 1 }}
                                icon="magnify"
                            >
                                Найти
                            </Button>
                            <Button
                                mode="contained-tonal"
                                onPress={scanCardWithCamera}
                                style={{ flex: 1 }}
                                icon="camera"
                            >
                                Сканер
                            </Button>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <Button
                                mode="outlined"
                                onPress={() => openAttachModal('')}
                                style={{ flex: 1, borderStyle: 'dashed' }}
                                icon="link-variant"
                            >
                                Привязать карту
                            </Button>
                            <Button
                                mode="contained-tonal"
                                onPress={() => {
                                    setNewCustomerName('');
                                    setNewCustomerPhone('');
                                    setAttachCardNumber('');
                                    setShowCreateDialog(true);
                                }}
                                style={{ flex: 1 }}
                                icon="account-plus"
                            >
                                + Новый клиент
                            </Button>
                        </View>
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
                                    <Paragraph style={dynamicStyles.textSecondary}>{customer.phone || 'Нет телефона'}</Paragraph>
                                    {customer.card_number && (
                                        <Chip compact style={{ marginTop: 4, backgroundColor: 'rgba(255,215,0,0.15)' }} textStyle={{ color: '#ffd700', fontSize: 11 }}>
                                            💳 № {customer.card_number}
                                        </Chip>
                                    )}
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
                                            <Chip style={styles.levelChip} textStyle={styles.levelChipText}>
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
                                                <Image source={{ uri: barcodeImage }} style={styles.barcodeImage} resizeMode="contain" />
                                            </View>
                                        ) : loadingCard ? (
                                            <View style={styles.barcodeContainer}>
                                                <ActivityIndicator size="small" color="#fff" />
                                            </View>
                                        ) : (
                                            <View style={styles.barcodeContainer}>
                                                <Paragraph style={styles.barcodePlaceholder}>Нажмите для просмотра barcode</Paragraph>
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
                                                <Paragraph style={styles.cashbackText}>Кэшбек {program?.pointsRate || 2}%</Paragraph>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}

                            <View style={styles.buttonRow}>
                                <Button mode="contained" onPress={addPoints} style={styles.actionButton} icon="plus">
                                    Начислить
                                </Button>
                                <Button mode="contained" onPress={spendPoints} style={[styles.actionButton, { backgroundColor: '#FF9800' }]} icon="minus">
                                    Списать
                                </Button>
                                <Button mode="outlined" onPress={() => openAttachModal(customer.card_number || '')} style={styles.actionButton} icon="link-variant">
                                    Перепривязать
                                </Button>
                                {customer.card_number ? (
                                    <Button mode="outlined" onPress={confirmDetachCard} style={[styles.actionButton, { borderColor: colors.error }]} textColor={colors.error} icon="link-off">
                                        Отвязать
                                    </Button>
                                ) : null}
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* --- 1. История транзакций (Вкладки: История карты / Общая история) --- */}
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <SegmentedButtons
                            value={historyTab}
                            onValueChange={setHistoryTab}
                            buttons={[
                                { value: 'customer', label: customer ? 'История карты' : 'История клиента' },
                                { value: 'all', label: 'Общая история' },
                            ]}
                            style={{ marginBottom: 12 }}
                        />

                        {historyTab === 'customer' ? (
                            !customer ? (
                                <Paragraph style={{ color: '#90a4ae', textAlign: 'center', marginVertical: 16 }}>
                                    Найдите или отсканируйте карту клиента для просмотра его истории
                                </Paragraph>
                            ) : transactions.length === 0 ? (
                                <Paragraph style={{ color: '#90a4ae', textAlign: 'center', marginVertical: 16 }}>
                                    История транзакций пуста
                                </Paragraph>
                            ) : (
                                transactions.slice(0, 15).map((tx, index) => (
                                    <List.Item
                                        key={index}
                                        title={tx.reason || tx.description || 'Операция с баллами'}
                                        description={`${formatDate(tx.created_at || tx.date)}${tx.created_by_name ? ` • ${tx.created_by_name}` : ''}`}
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
                                                textStyle={{ color: tx.points > 0 || tx.amount > 0 ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}
                                            >
                                                {tx.points > 0 || tx.amount > 0 ? '+' : ''}{tx.points || tx.amount} б.
                                            </Chip>
                                        )}
                                    />
                                ))
                            )
                        ) : (
                            /* Общая история всех карт */
                            loadingAllTx ? (
                                <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
                            ) : allTransactions.length === 0 ? (
                                <Paragraph style={{ color: '#90a4ae', textAlign: 'center', marginVertical: 16 }}>
                                    Операций по картам лояльности ещё не было
                                </Paragraph>
                            ) : (
                                allTransactions.map((tx, index) => (
                                    <List.Item
                                        key={index}
                                        title={`${tx.customer_name || 'Клиент'} (${tx.card_number || '№--'})`}
                                        description={`${tx.reason || tx.description || 'Операция'} • ${formatDate(tx.created_at)}`}
                                        left={() => (
                                            <Avatar.Icon
                                                size={36}
                                                icon={tx.points > 0 ? 'plus' : 'minus'}
                                                style={{ backgroundColor: tx.points > 0 ? '#4CAF50' : '#F44336' }}
                                            />
                                        )}
                                        right={() => (
                                            <Chip
                                                style={{ backgroundColor: tx.points > 0 ? '#E8F5E9' : '#FFEBEE' }}
                                                textStyle={{ color: tx.points > 0 ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}
                                            >
                                                {tx.points > 0 ? '+' : ''}{tx.points} б.
                                            </Chip>
                                        )}
                                    />
                                ))
                            )
                        )}
                    </Card.Content>
                </Card>

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
                                <Image source={{ uri: barcodeImage }} style={styles.modalBarcode} resizeMode="contain" />
                            ) : (
                                <View style={styles.modalBarcodePlaceholder}>
                                    <ActivityIndicator size="small" color="#1e3a5f" />
                                    <Paragraph style={{ color: '#666', marginTop: 8 }}>Загрузка barcode...</Paragraph>
                                </View>
                            )}
                            <Paragraph style={styles.modalBalance}>
                                Баланс: {(cardData?.balance || customer?.points || customer?.loyalty_points || 0).toLocaleString('ru-RU')} баллов
                            </Paragraph>
                            <Button mode="text" onPress={() => setShowBarcodeModal(false)} style={{ marginTop: 8 }}>
                                Закрыть
                            </Button>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

                        {/* --- 3 & 4. Диалог прикрепления карты к клиенту --- */}
            <Portal>
                <Dialog visible={showAttachDialog} onDismiss={() => setShowAttachDialog(false)} style={{ maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 16 }}>
                    <Dialog.Title style={{ color: colors.text }}>🔗 Привязать карту к клиенту</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Номер карты"
                            value={attachCardNumber}
                            onChangeText={setAttachCardNumber}
                            mode="outlined"
                            left={<TextInput.Icon icon="credit-card" />}
                            right={<TextInput.Icon icon="camera" onPress={() => { setShowAttachDialog(false); scanCardWithCamera(); }} />}
                            style={{ marginBottom: 12, backgroundColor: colors.input }}
                            textColor={colors.text}
                            placeholder="Введите или отсканируйте номер"
                        />

                        <Paragraph style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 12 }}>
                            Выберите клиента из списка:
                        </Paragraph>

                        <TextInput
                            label="Поиск клиента"
                            value={attachSearchQuery}
                            onChangeText={(t) => { setAttachSearchQuery(t); loadAttachCustomers(t); }}
                            mode="outlined"
                            dense
                            left={<TextInput.Icon icon="magnify" />}
                            style={{ marginBottom: 10, backgroundColor: colors.input }}
                            textColor={colors.text}
                        />

                        {attachLoading ? (
                            <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
                        ) : attachCustomers.length === 0 ? (
                            <Paragraph style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 12 }}>
                                Клиенты не найдены
                            </Paragraph>
                        ) : (
                            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                {attachCustomers.map((c) => {
                                    const isSelected = selectedAttachCustomer?.id === c.id;
                                    return (
                                        <TouchableOpacity
                                            key={c.id}
                                            onPress={() => setSelectedAttachCustomer(c)}
                                            style={{
                                                padding: 10,
                                                borderRadius: 8,
                                                backgroundColor: isSelected ? 'rgba(59,130,246,0.2)' : 'transparent',
                                                borderWidth: isSelected ? 1 : 0,
                                                borderColor: colors.primary,
                                                marginBottom: 4,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: isSelected ? 'bold' : 'normal', color: colors.text }}>{c.name}</Text>
                                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{c.phone || 'Без телефона'} {c.card_number ? '• Карта: ' + c.card_number : ''}</Text>
                                            </View>
                                            {isSelected && <Chip compact textStyle={{ fontSize: 10 }}>Выбран</Chip>}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions style={{ justifyContent: 'space-between' }}>
                        <Button
                            onPress={() => {
                                setShowAttachDialog(false);
                                setNewCustomerName('');
                                setNewCustomerPhone('');
                                setShowCreateDialog(true);
                            }}
                            icon="account-plus"
                            compact
                        >
                            + Новый
                        </Button>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <Button onPress={() => setShowAttachDialog(false)} textColor={colors.textSecondary}>Отмена</Button>
                            <Button onPress={confirmAttachCard} loading={attachLoading} disabled={!selectedAttachCustomer || !attachCardNumber.trim()} mode="contained">
                                Привязать
                            </Button>
                        </View>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Диалог начисления баллов */}
            <Portal>
                <Dialog visible={showPointsDialog} onDismiss={() => setShowPointsDialog(false)} style={{ backgroundColor: colors.surface, borderRadius: 16 }}>
                    <Dialog.Title style={{ color: colors.text }}>Начислить баллы</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Количество баллов"
                            value={pointsInput}
                            onChangeText={setPointsInput}
                            keyboardType="numeric"
                            mode="outlined"
                            style={{ backgroundColor: colors.input }}
                            textColor={colors.text}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowPointsDialog(false)} textColor={colors.textSecondary}>Отмена</Button>
                        <Button onPress={confirmAddPoints} mode="contained">Начислить</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Диалог создания клиента */}
            <Portal>
                <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)} style={{ backgroundColor: colors.surface, borderRadius: 16 }}>
                    <Dialog.Title style={{ color: colors.text }}>Новый клиент с картой</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Имя клиента"
                            value={newCustomerName}
                            onChangeText={setNewCustomerName}
                            mode="outlined"
                            style={{ marginBottom: 8, backgroundColor: colors.input }}
                            textColor={colors.text}
                            autoFocus
                        />
                        <TextInput
                            label="Телефон"
                            value={newCustomerPhone}
                            onChangeText={setNewCustomerPhone}
                            keyboardType="phone-pad"
                            mode="outlined"
                            style={{ marginBottom: 8, backgroundColor: colors.input }}
                            textColor={colors.text}
                        />
                        {attachCardNumber ? (
                            <Chip icon="credit-card" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
                                Привязываемая карта: {attachCardNumber}
                            </Chip>
                        ) : null}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowCreateDialog(false)} textColor={colors.textSecondary}>Отмена</Button>
                        <Button onPress={createCustomer} mode="contained">Создать и привязать</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Диалог списания баллов */}
            <Portal>
                <Dialog visible={showSpendDialog} onDismiss={() => setShowSpendDialog(false)} style={{ backgroundColor: colors.surface, borderRadius: 16 }}>
                    <Dialog.Title style={{ color: colors.text }}>Списать баллы</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ marginBottom: 8, color: colors.textSecondary }}>
                            Баланс: {customer?.points || customer?.loyalty_points || 0} баллов
                        </Paragraph>
                        <TextInput
                            label="Количество баллов"
                            value={spendPointsInput}
                            onChangeText={setSpendPointsInput}
                            keyboardType="numeric"
                            mode="outlined"
                            style={{ backgroundColor: colors.input }}
                            textColor={colors.text}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowSpendDialog(false)} textColor={colors.textSecondary}>Отмена</Button>
                        <Button onPress={confirmSpendPoints} textColor="#f87171">Списать</Button>
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
    input: { marginBottom: 8 },
    searchButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
