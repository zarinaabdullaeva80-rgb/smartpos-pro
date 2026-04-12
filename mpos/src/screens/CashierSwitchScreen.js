import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Avatar, IconButton, Portal, Dialog, FAB, Chip } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import CashierService from '../services/cashier';
import BiometricService from '../services/biometric';
import SoundManager from '../services/sounds';

export default function CashierSwitchScreen({ navigation, onCashierChange }) {
    const { colors } = useTheme();

    const [cashiers, setCashiers] = useState([]);
    const [currentCashier, setCurrentCashier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [pin, setPin] = useState('');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newCashierName, setNewCashierName] = useState('');
    const [newCashierPin, setNewCashierPin] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        await CashierService.init();
        const list = await CashierService.getCashiers();
        const current = await CashierService.getCurrentCashier();
        setCashiers(list);
        setCurrentCashier(current);
        setLoading(false);
    };

    const handleSelectCashier = async (cashier) => {
        if (currentCashier?.id === cashier.id) {
            Alert.alert('ℹ️', 'Это текущий кассир');
            return;
        }

        // Проверить биометрию если доступна
        const bioSettings = await BiometricService.getSettings();
        if (bioSettings.available && bioSettings.enabled) {
            const bioResult = await BiometricService.authenticate({
                promptMessage: `Переключиться на ${cashier.name}`
            });
            if (bioResult.success) {
                await switchToCashier(cashier);
                return;
            }
        }

        // Показать диалог PIN
        setSelectedCashier(cashier);
        setPin('');
        setShowPinDialog(true);
    };

    const switchToCashier = async (cashier) => {
        try {
            await CashierService.quickSwitch(cashier.id);
            setCurrentCashier(cashier);
            SoundManager.playSuccess();
            if (onCashierChange) onCashierChange(cashier);
            Alert.alert('✅ Готово', `Кассир: ${cashier.name}`);
        } catch (error) {
            Alert.alert('Ошибка', error.message);
        }
    };

    const handlePinSubmit = async () => {
        try {
            const cashier = await CashierService.switchCashier(selectedCashier.id, pin);
            setShowPinDialog(false);
            setCurrentCashier(cashier);
            SoundManager.playSuccess();
            if (onCashierChange) onCashierChange(cashier);
            Alert.alert('✅ Готово', `Кассир: ${cashier.name}`);
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.message);
        }
    };

    const handleAddCashier = async () => {
        if (!newCashierName.trim()) {
            Alert.alert('Ошибка', 'Введите имя кассира');
            return;
        }
        if (newCashierPin.length < 4) {
            Alert.alert('Ошибка', 'PIN должен быть минимум 4 цифры');
            return;
        }

        try {
            const cashier = await CashierService.addCashier(
                { name: newCashierName.trim(), username: newCashierName.toLowerCase().replace(/\s/g, '_') },
                newCashierPin
            );
            setCashiers([...cashiers, cashier]);
            setShowAddDialog(false);
            setNewCashierName('');
            setNewCashierPin('');
            SoundManager.playSuccess();
            Alert.alert('✅', `Кассир ${cashier.name} добавлен`);
        } catch (error) {
            Alert.alert('Ошибка', error.message);
        }
    };

    const handleRemoveCashier = async (cashier) => {
        Alert.alert(
            'Удалить кассира?',
            `${cashier.name} будет удалён из списка`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        await CashierService.removeCashier(cashier.id);
                        setCashiers(cashiers.filter(c => c.id !== cashier.id));
                        if (currentCashier?.id === cashier.id) {
                            setCurrentCashier(null);
                        }
                        SoundManager.playTap();
                    }
                }
            ]
        );
    };

    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    const renderCashier = ({ item }) => {
        const isCurrent = currentCashier?.id === item.id;
        return (
            <Card
                style={[
                    styles.cashierCard,
                    dynamicStyles.card,
                    isCurrent && { borderColor: colors.success, borderWidth: 2 }
                ]}
                onPress={() => handleSelectCashier(item)}
            >
                <Card.Content style={styles.cashierContent}>
                    <Avatar.Text
                        size={50}
                        label={getInitials(item.name)}
                        style={{ backgroundColor: isCurrent ? colors.success : colors.primary }}
                    />
                    <View style={styles.cashierInfo}>
                        <Title style={dynamicStyles.text}>{item.name}</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>
                            {item.role === 'admin' ? 'Администратор' : item.role === 'manager' ? 'Менеджер' : 'Кассир'}
                        </Paragraph>
                        {isCurrent && (
                            <Chip mode="outlined" style={{ marginTop: 4 }} textStyle={{ color: colors.success }}>
                                ✓ Текущий
                            </Chip>
                        )}
                    </View>
                    <IconButton
                        icon="delete"
                        iconColor={colors.error}
                        onPress={() => handleRemoveCashier(item)}
                    />
                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Текущий кассир */}
            {currentCashier && (
                <Card style={[styles.currentCard, dynamicStyles.card, { borderColor: colors.success }]}>
                    <Card.Content style={styles.currentContent}>
                        <Avatar.Text
                            size={60}
                            label={getInitials(currentCashier.name)}
                            style={{ backgroundColor: colors.success }}
                        />
                        <View style={styles.currentInfo}>
                            <Paragraph style={dynamicStyles.textSecondary}>Текущий кассир:</Paragraph>
                            <Title style={[dynamicStyles.text, { fontSize: 24 }]}>{currentCashier.name}</Title>
                        </View>
                    </Card.Content>
                </Card>
            )}

            {/* Список кассиров */}
            <FlatList
                data={cashiers}
                renderItem={renderCashier}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Card style={[styles.emptyCard, dynamicStyles.card]}>
                        <Card.Content>
                            <Paragraph style={[dynamicStyles.textSecondary, { textAlign: 'center' }]}>
                                👥 Нет добавленных кассиров
                            </Paragraph>
                            <Button mode="contained" onPress={() => setShowAddDialog(true)} style={{ marginTop: 16 }}>
                                Добавить кассира
                            </Button>
                        </Card.Content>
                    </Card>
                }
            />

            {/* FAB для добавления */}
            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddDialog(true)}
            />

            {/* Диалог PIN */}
            <Portal>
                <Dialog visible={showPinDialog} onDismiss={() => setShowPinDialog(false)}>
                    <Dialog.Title>🔐 Введите PIN</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph>Для переключения на {selectedCashier?.name}</Paragraph>
                        <TextInput
                            value={pin}
                            onChangeText={setPin}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={6}
                            mode="outlined"
                            style={{ marginTop: 16 }}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowPinDialog(false)}>Отмена</Button>
                        <Button mode="contained" onPress={handlePinSubmit}>Войти</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Диалог добавления */}
                <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)}>
                    <Dialog.Title>👤 Новый кассир</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Имя кассира"
                            value={newCashierName}
                            onChangeText={setNewCashierName}
                            mode="outlined"
                            style={{ marginBottom: 12 }}
                        />
                        <TextInput
                            label="PIN-код (4-6 цифр)"
                            value={newCashierPin}
                            onChangeText={setNewCashierPin}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={6}
                            mode="outlined"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowAddDialog(false)}>Отмена</Button>
                        <Button mode="contained" onPress={handleAddCashier}>Добавить</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    currentCard: { margin: 16, borderWidth: 2, borderRadius: 12 },
    currentContent: { flexDirection: 'row', alignItems: 'center' },
    currentInfo: { marginLeft: 16, flex: 1 },
    list: { padding: 16, paddingTop: 0, paddingBottom: 80 },
    cashierCard: { marginBottom: 12, borderRadius: 12 },
    cashierContent: { flexDirection: 'row', alignItems: 'center' },
    cashierInfo: { marginLeft: 16, flex: 1 },
    emptyCard: { margin: 16, padding: 16 },
    fab: { position: 'absolute', right: 16, bottom: 16 },
});
