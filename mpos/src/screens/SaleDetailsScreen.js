import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, Divider, Chip, Portal, Dialog, TextInput, RadioButton } from 'react-native-paper';
import { salesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import PrinterService from '../services/printer';
import SoundManager from '../services/sounds';
import ElectronicReceiptService from '../services/electronicReceipt';

export default function SaleDetailsScreen({ route, navigation }) {
    const { colors } = useTheme();
    const { saleId } = route.params;

    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sendDialogVisible, setSendDialogVisible] = useState(false);
    const [sendMethod, setSendMethod] = useState('sms');
    const [sendAddress, setSendAddress] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => { loadSale(); }, []);

    const loadSale = async () => {
        setLoading(true);
        try {
            const response = await salesAPI.getById(saleId);
            setSale(response.data.sale || response.data);
        } catch (error) {
            console.error('[SaleDetails] Error:', error);
            Alert.alert('Ошибка', 'Не удалось загрузить данные');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";
    const formatDate = (date) => new Date(date).toLocaleString('ru-RU');

    const handlePrint = async () => {
        try {
            SoundManager.playTap();
            await PrinterService.printReceipt(sale, sale.items || [], { name: 'Магазин', address: '' });
            Alert.alert('Печать', 'Чек отправлен на принтер');
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось напечатать чек');
        }
    };

    const handleSendReceipt = async () => {
        if (!sendAddress.trim()) {
            Alert.alert('Ошибка', 'Введите адрес');
            return;
        }

        setSending(true);
        try {
            let result;
            switch (sendMethod) {
                case 'sms':
                    result = await ElectronicReceiptService.sendSMS(sendAddress, sale);
                    break;
                case 'email':
                    result = await ElectronicReceiptService.sendEmail(sendAddress, sale);
                    break;
                case 'whatsapp':
                    result = await ElectronicReceiptService.openWhatsApp(sendAddress, sale);
                    break;
                case 'telegram':
                    result = await ElectronicReceiptService.openTelegram(sendAddress, sale);
                    break;
            }

            SoundManager.playSuccess();
            setSendDialogVisible(false);
            Alert.alert('✅ Отправлено', `Чек отправлен через ${sendMethod.toUpperCase()}`);
        } catch (error) {
            SoundManager.playError();
            Alert.alert('Ошибка', error.message);
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return colors.success;
            case 'pending': return colors.warning;
            case 'cancelled': return colors.error;
            default: return colors.textSecondary;
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    if (loading || !sale) {
        return (
            <View style={[styles.container, dynamicStyles.container, styles.center]}>
                <Paragraph style={dynamicStyles.textSecondary}>Загрузка...</Paragraph>
            </View>
        );
    }

    return (
        <>
            <ScrollView style={[styles.container, dynamicStyles.container]}>
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <View style={styles.header}>
                            <Title style={dynamicStyles.text}>Чек #{sale.document_number}</Title>
                            <Chip style={{ backgroundColor: getStatusColor(sale.status) }} textStyle={{ color: '#fff' }}>
                                {sale.status === 'confirmed' ? 'Проведена' : sale.status}
                            </Chip>
                        </View>
                        <Paragraph style={dynamicStyles.textSecondary}>{formatDate(sale.created_at)}</Paragraph>
                    </Card.Content>
                </Card>

                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>Товары</Title>
                        <Divider style={styles.divider} />
                        {(sale.items || []).map((item, index) => (
                            <View key={index} style={styles.itemRow}>
                                <View style={styles.itemInfo}>
                                    <Paragraph style={dynamicStyles.text}>{item.product_name || `Товар #${item.product_id}`}</Paragraph>
                                    <Paragraph style={dynamicStyles.textSecondary}>
                                        {item.quantity} × {formatCurrency(item.price)}
                                    </Paragraph>
                                </View>
                                <Paragraph style={[dynamicStyles.text, { fontWeight: 'bold' }]}>
                                    {formatCurrency(item.total_price || item.quantity * item.price)}
                                </Paragraph>
                            </View>
                        ))}
                    </Card.Content>
                </Card>

                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <View style={styles.totalRow}>
                            <Paragraph style={dynamicStyles.textSecondary}>Подытог:</Paragraph>
                            <Paragraph style={dynamicStyles.text}>{formatCurrency(sale.total_amount)}</Paragraph>
                        </View>
                        {sale.discount_amount > 0 && (
                            <View style={styles.totalRow}>
                                <Paragraph style={{ color: colors.warning }}>Скидка:</Paragraph>
                                <Paragraph style={{ color: colors.warning }}>−{formatCurrency(sale.discount_amount)}</Paragraph>
                            </View>
                        )}
                        <Divider style={styles.divider} />
                        <View style={styles.totalRow}>
                            <Title style={dynamicStyles.text}>ИТОГО:</Title>
                            <Title style={{ color: colors.success, fontSize: 24 }}>{formatCurrency(sale.final_amount)}</Title>
                        </View>
                    </Card.Content>
                </Card>

                <View style={styles.buttonRow}>
                    <Button mode="outlined" icon="printer" style={styles.button} onPress={handlePrint}>
                        Печать
                    </Button>
                    <Button mode="contained" icon="share" style={styles.button} onPress={() => setSendDialogVisible(true)}>
                        Отправить
                    </Button>
                </View>

                {sale.notes && (
                    <Card style={[styles.card, dynamicStyles.card]}>
                        <Card.Content>
                            <Title style={dynamicStyles.text}>Заметки</Title>
                            <Paragraph style={dynamicStyles.textSecondary}>{sale.notes}</Paragraph>
                        </Card.Content>
                    </Card>
                )}
            </ScrollView>

            {/* Диалог отправки чека */}
            <Portal>
                <Dialog visible={sendDialogVisible} onDismiss={() => setSendDialogVisible(false)}>
                    <Dialog.Title>📧 Отправить чек</Dialog.Title>
                    <Dialog.Content>
                        <RadioButton.Group onValueChange={setSendMethod} value={sendMethod}>
                            <View style={styles.radioRow}>
                                <RadioButton value="sms" />
                                <Paragraph onPress={() => setSendMethod('sms')}>📱 SMS</Paragraph>
                            </View>
                            <View style={styles.radioRow}>
                                <RadioButton value="email" />
                                <Paragraph onPress={() => setSendMethod('email')}>📧 Email</Paragraph>
                            </View>
                            <View style={styles.radioRow}>
                                <RadioButton value="whatsapp" />
                                <Paragraph onPress={() => setSendMethod('whatsapp')}>💬 WhatsApp</Paragraph>
                            </View>
                            <View style={styles.radioRow}>
                                <RadioButton value="telegram" />
                                <Paragraph onPress={() => setSendMethod('telegram')}>✈️ Telegram</Paragraph>
                            </View>
                        </RadioButton.Group>

                        <TextInput
                            label={sendMethod === 'email' ? 'Email адрес' : 'Телефон или username'}
                            value={sendAddress}
                            onChangeText={setSendAddress}
                            placeholder={sendMethod === 'email' ? 'example@mail.com' : '+998901234567'}
                            mode="outlined"
                            style={{ marginTop: 16 }}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setSendDialogVisible(false)}>Отмена</Button>
                        <Button mode="contained" onPress={handleSendReceipt} loading={sending}>
                            Отправить
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    card: { margin: 16, marginBottom: 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    divider: { marginVertical: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    itemInfo: { flex: 1 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    buttonRow: { flexDirection: 'row', padding: 16, gap: 12 },
    button: { flex: 1 },
    radioRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
});
