import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, RadioButton, Divider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';

export default function PaymentMethodsScreen({ route, navigation }) {
    const { colors } = useTheme();
    const { total, onPaymentComplete } = route.params || {};

    const [paymentType, setPaymentType] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [cardNumber, setCardNumber] = useState('');

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    const calculateChange = () => {
        const received = parseFloat(cashReceived) || 0;
        return Math.max(0, received - (total || 0));
    };

    const handleConfirm = () => {
        if (paymentType === 'cash') {
            const received = parseFloat(cashReceived) || 0;
            if (received < total) {
                SoundManager.playError();
                Alert.alert('Ошибка', 'Недостаточно наличных');
                return;
            }
        }

        // QR-оплата - переход на экран QR
        if (paymentType === 'qr') {
            navigation.navigate('QRPayment', {
                amount: total,
                orderId: `ORDER-${Date.now()}`,
                onPaymentComplete: (result) => {
                    if (onPaymentComplete) {
                        onPaymentComplete({ type: 'qr', amount: total, qrResult: result });
                    }
                }
            });
            return;
        }

        SoundManager.playSuccess();
        const payment = { type: paymentType, amount: total, change: calculateChange() };

        if (onPaymentComplete) {
            onPaymentComplete(payment);
        }
        navigation.goBack();
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            {/* Сумма к оплате */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Paragraph style={dynamicStyles.textSecondary}>К оплате:</Paragraph>
                    <Title style={{ fontSize: 32, color: colors.success }}>{formatCurrency(total)}</Title>
                </Card.Content>
            </Card>

            {/* Способ оплаты */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>Способ оплаты</Title>
                    <Divider style={styles.divider} />

                    <RadioButton.Group onValueChange={setPaymentType} value={paymentType}>
                        <View style={styles.radioRow}>
                            <RadioButton value="cash" />
                            <Paragraph style={dynamicStyles.text} onPress={() => setPaymentType('cash')}>💵 Наличные</Paragraph>
                        </View>
                        <View style={styles.radioRow}>
                            <RadioButton value="card" />
                            <Paragraph style={dynamicStyles.text} onPress={() => setPaymentType('card')}>💳 Банковская карта</Paragraph>
                        </View>
                        <View style={styles.radioRow}>
                            <RadioButton value="qr" />
                            <Paragraph style={dynamicStyles.text} onPress={() => setPaymentType('qr')}>📱 QR-оплата (Payme/Click)</Paragraph>
                        </View>
                        <View style={styles.radioRow}>
                            <RadioButton value="transfer" />
                            <Paragraph style={dynamicStyles.text} onPress={() => setPaymentType('transfer')}>🏦 Перевод</Paragraph>
                        </View>
                    </RadioButton.Group>
                </Card.Content>
            </Card>

            {/* Детали оплаты */}
            {paymentType === 'cash' && (
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>Наличные</Title>
                        <TextInput
                            label="Получено от клиента"
                            value={cashReceived}
                            onChangeText={setCashReceived}
                            keyboardType="numeric"
                            style={[styles.input, dynamicStyles.input]}
                            mode="outlined"
                        />
                        {parseFloat(cashReceived) > 0 && (
                            <View style={styles.changeRow}>
                                <Paragraph style={dynamicStyles.textSecondary}>Сдача:</Paragraph>
                                <Title style={{ color: colors.warning }}>{formatCurrency(calculateChange())}</Title>
                            </View>
                        )}
                    </Card.Content>
                </Card>
            )}

            {paymentType === 'card' && (
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>Оплата картой</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>Приложите карту к терминалу</Paragraph>
                    </Card.Content>
                </Card>
            )}

            {paymentType === 'transfer' && (
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>Перевод</Title>
                        <Paragraph style={dynamicStyles.textSecondary}>Ожидание подтверждения перевода</Paragraph>
                    </Card.Content>
                </Card>
            )}

            {/* Кнопка подтверждения */}
            <View style={styles.buttonContainer}>
                <Button mode="contained" onPress={handleConfirm} style={styles.button} icon="check">
                    Подтвердить оплату
                </Button>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { margin: 16, marginBottom: 0 },
    divider: { marginVertical: 12 },
    radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    input: { marginTop: 12 },
    changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    buttonContainer: { padding: 16 },
    button: { paddingVertical: 8 },
});
