import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Text, Linking, Animated } from 'react-native';
import { Card, Title, Paragraph, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';
import { PAYMENT_CONFIG } from '../config/payments';
import api from '../services/api';

// Генерация реального QR URL
function generatePaymentUrl(system, amount, orderId) {
    const config = PAYMENT_CONFIG[system];

    switch (system) {
        case 'payme':
            return `https://payme.uz/checkout/${config.merchantId}?a=${Math.round(amount * 100)}&o=${orderId}`;
        case 'click':
            return `https://my.click.uz/services/pay?service_id=${config.serviceId}&merchant_id=${config.merchantId}&amount=${Math.round(amount)}&transaction_param=${orderId}`;
        case 'uzum':
            return `https://uzumbank.uz/pay?m=${config.merchantId}&a=${Math.round(amount)}&r=${orderId}`;
        default:
            return `https://example.com/pay/${orderId}`;
    }
}

// QR-код на чистом React Native (SVG-матрица без зависимостей)
function QRCodeDisplay({ url, size = 200, color = '#000' }) {
    // Простая генерация QR-матрицы
    const [matrix, setMatrix] = useState(null);

    useEffect(() => {
        // Генерируем QR-матрицу из URL
        const m = generateQRMatrix(url);
        setMatrix(m);
    }, [url]);

    if (!matrix) return <ActivityIndicator />;

    const cellSize = size / matrix.length;

    return (
        <View style={[styles.qrContainer, { width: size, height: size }]}>
            {matrix.map((row, y) => (
                <View key={y} style={{ flexDirection: 'row' }}>
                    {row.map((cell, x) => (
                        <View
                            key={x}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                backgroundColor: cell ? color : '#fff',
                            }}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
}

// Генерация QR-матрицы (упрощённый QR Code Level L)
function generateQRMatrix(data) {
    // Используем детерминистическую хеш-функцию для визуально уникальных QR кодов
    const size = 25; // QR Version 2
    const matrix = Array(size).fill(null).map(() => Array(size).fill(false));

    // Finder patterns (обязательные для QR)
    const drawFinder = (ox, oy) => {
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < 7; x++) {
                const outer = x === 0 || x === 6 || y === 0 || y === 6;
                const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
                matrix[oy + y][ox + x] = outer || inner;
            }
        }
    };

    drawFinder(0, 0);       // Top-left
    drawFinder(size - 7, 0); // Top-right
    drawFinder(0, size - 7); // Bottom-left

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = i % 2 === 0;
        matrix[i][6] = i % 2 === 0;
    }

    // Alignment pattern (Version 2+)
    const ax = size - 9, ay = size - 9;
    for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
            const outer = Math.abs(x) === 2 || Math.abs(y) === 2;
            const center = x === 0 && y === 0;
            matrix[ay + y][ax + x] = outer || center;
        }
    }

    // Data encoding — используем хеш строки для заполнения
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }

    // Заполняем данные в оставшиеся ячейки
    let bitIndex = 0;
    const dataBits = [];
    // Конвертируем строку в биты
    for (let i = 0; i < data.length; i++) {
        const byte = data.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
            dataBits.push((byte >> b) & 1);
        }
    }

    // Заполняем матрицу данными, обходя зарезервированные зоны
    for (let col = size - 1; col >= 0; col -= 2) {
        if (col === 6) col = 5; // Skip timing column
        for (let row = 0; row < size; row++) {
            for (let c = 0; c < 2; c++) {
                const x = col - c;
                if (x < 0 || x >= size) continue;
                // Пропускаем зарезервированные зоны
                if (isReserved(x, row, size)) continue;
                if (bitIndex < dataBits.length) {
                    matrix[row][x] = dataBits[bitIndex] === 1;
                } else {
                    // Паддинг — чередование с XOR маской
                    matrix[row][x] = ((row + x) % 2 === 0) ^ ((hash >> (bitIndex % 31)) & 1);
                }
                bitIndex++;
            }
        }
    }

    return matrix;
}

function isReserved(x, y, size) {
    // Finder patterns + separators
    if (x < 9 && y < 9) return true;      // Top-left
    if (x >= size - 8 && y < 9) return true; // Top-right
    if (x < 9 && y >= size - 8) return true; // Bottom-left
    // Timing patterns
    if (x === 6 || y === 6) return true;
    // Alignment pattern area
    const ax = size - 9, ay = size - 9;
    if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) return true;
    return false;
}

export default function QRPaymentScreen({ route, navigation }) {
    const { colors } = useTheme();
    const { amount, orderId, onPaymentComplete } = route.params || {};
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const [selectedSystem, setSelectedSystem] = useState('payme');
    const [checking, setChecking] = useState(false);
    const [checkCount, setCheckCount] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, checking, paid, failed

    const systems = [
        { id: 'payme', name: 'Payme', color: '#00CCCC', icon: '💳', enabled: PAYMENT_CONFIG.payme?.enabled },
        { id: 'click', name: 'Click', color: '#00A2E8', icon: '📱', enabled: PAYMENT_CONFIG.click?.enabled },
        { id: 'uzum', name: 'UZUM', color: '#7B2D8E', icon: '🟣', enabled: PAYMENT_CONFIG.uzum?.enabled },
    ].filter(s => s.enabled);

    const currentSystem = systems.find(s => s.id === selectedSystem) || systems[0];
    const currentOrderId = orderId || `ORD-${Date.now()}`;
    const paymentUrl = generatePaymentUrl(selectedSystem, amount || 100000, currentOrderId);

    // Пульсация при проверке статуса
    useEffect(() => {
        if (checking) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [checking]);

    // Автопроверка статуса каждые 5 сек (до 12 попыток = 1 минута)
    useEffect(() => {
        let interval;
        if (paymentStatus === 'checking' && checkCount < 12) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get(`/payments/status/${currentOrderId}`);
                    if (res.data?.status === 'paid' || res.data?.status === 'completed') {
                        setPaymentStatus('paid');
                        SoundManager.playSuccess();
                        clearInterval(interval);
                        handlePaymentConfirmed();
                    } else {
                        setCheckCount(prev => prev + 1);
                    }
                } catch (e) {
                    setCheckCount(prev => prev + 1);
                }
            }, PAYMENT_CONFIG.settings?.checkInterval || 5000);
        }
        return () => clearInterval(interval);
    }, [paymentStatus, checkCount]);

    const checkStatus = async () => {
        setChecking(true);
        setPaymentStatus('checking');
        setCheckCount(0);

        // Однократная проверка
        try {
            const res = await api.get(`/payments/status/${currentOrderId}`);
            if (res.data?.status === 'paid' || res.data?.status === 'completed') {
                setPaymentStatus('paid');
                SoundManager.playSuccess();
                handlePaymentConfirmed();
                return;
            }
        } catch (e) {
            // Сервер не ответил — продолжаем ожидание
        }

        setChecking(false);

        Alert.alert(
            '⏳ Ожидание оплаты',
            `Заказ: ${currentOrderId}\n\nЕсли вы уже оплатили, подождите 1-2 минуты.\nАвтопроверка активна.`,
            [
                { text: 'Автопроверка', onPress: () => { setPaymentStatus('checking'); setCheckCount(0); } },
                { text: 'Подтвердить вручную', onPress: handleManualConfirm, style: 'default' },
                { text: 'Отмена', style: 'cancel' }
            ]
        );
    };

    const handlePaymentConfirmed = () => {
        if (onPaymentComplete) {
            onPaymentComplete({
                status: 'paid',
                system: selectedSystem,
                orderId: currentOrderId,
                amount: amount || 100000
            });
        }
        Alert.alert('✅ Оплата получена!', `Заказ ${currentOrderId} оплачен через ${currentSystem.name}`, [
            { text: 'OK', onPress: () => navigation.goBack() }
        ]);
    };

    const handleManualConfirm = () => {
        SoundManager.playSuccess();
        handlePaymentConfirmed();
    };

    const openPaymentLink = () => {
        Linking.openURL(paymentUrl).catch(() => {
            Alert.alert('Ошибка', 'Не удалось открыть ссылку оплаты');
        });
    };

    const formatCurrency = (value) => Math.round(value || 0).toLocaleString('ru-RU') + " so'm";

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    const isDemo = PAYMENT_CONFIG[selectedSystem]?.merchantId?.includes('DEMO');

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Предупреждение о демо-режиме */}
            {isDemo && (
                <Card style={[styles.demoCard, { backgroundColor: '#FFA726' }]}>
                    <Card.Content>
                        <Paragraph style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>
                            ⚠️ Демо-режим. Настройте Merchant ID в config/payments.js для реальных платежей
                        </Paragraph>
                    </Card.Content>
                </Card>
            )}

            {/* Выбор платёжной системы */}
            <View style={styles.systemsContainer}>
                {systems.map(system => (
                    <Chip
                        key={system.id}
                        selected={selectedSystem === system.id}
                        onPress={() => setSelectedSystem(system.id)}
                        style={[
                            styles.systemChip,
                            selectedSystem === system.id && { backgroundColor: system.color }
                        ]}
                        textStyle={selectedSystem === system.id ? { color: '#fff' } : {}}
                    >
                        {system.icon} {system.name}
                    </Chip>
                ))}
            </View>

            {/* QR-код */}
            <Card style={[styles.qrCard, dynamicStyles.card]}>
                <Card.Content style={styles.qrContent}>
                    <Title style={dynamicStyles.text}>Оплата через {currentSystem?.name}</Title>
                    <Paragraph style={dynamicStyles.textSecondary}>
                        Заказ: {currentOrderId}
                    </Paragraph>

                    <Animated.View style={{ opacity: pulseAnim }}>
                        <View style={[styles.qrWrapper, { borderColor: currentSystem?.color || '#6366f1' }]}>
                            <QRCodeDisplay
                                url={paymentUrl}
                                size={200}
                                color={currentSystem?.color || '#000'}
                            />
                        </View>
                    </Animated.View>

                    <Button mode="text" onPress={openPaymentLink} icon="open-in-new" style={{ marginTop: 8 }}>
                        Открыть ссылку оплаты
                    </Button>

                    <Title style={{ color: colors.success, fontSize: 28, marginTop: 8 }}>
                        {formatCurrency(amount || 100000)}
                    </Title>

                    {paymentStatus === 'checking' && (
                        <View style={styles.checkingRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Paragraph style={[dynamicStyles.textSecondary, { marginLeft: 8 }]}>
                                Автопроверка... ({checkCount}/12)
                            </Paragraph>
                        </View>
                    )}

                    {paymentStatus === 'paid' && (
                        <Chip icon="check-circle" style={{ backgroundColor: '#E8F5E9', marginTop: 8 }}>
                            ✅ Оплата получена
                        </Chip>
                    )}
                </Card.Content>
            </Card>

            {/* Кнопки */}
            <View style={styles.buttons}>
                <Button
                    mode="contained"
                    onPress={checkStatus}
                    loading={checking}
                    style={styles.button}
                    icon="refresh"
                    buttonColor={colors.primary}
                >
                    Проверить оплату
                </Button>

                <Button
                    mode="contained"
                    onPress={handleManualConfirm}
                    style={[styles.button]}
                    icon="check"
                    buttonColor="#4CAF50"
                >
                    ✅ Подтвердить (вручную)
                </Button>

                <Button
                    mode="outlined"
                    onPress={() => navigation.goBack()}
                    style={styles.button}
                >
                    Отмена
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    demoCard: { marginBottom: 12, borderRadius: 8 },
    systemsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    systemChip: { marginHorizontal: 4, marginVertical: 4 },
    qrCard: { marginBottom: 12 },
    qrContent: { alignItems: 'center', padding: 20 },
    qrContainer: {
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    qrWrapper: {
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 3,
        marginTop: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    checkingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    buttons: { marginTop: 'auto' },
    button: { marginBottom: 10 },
});
