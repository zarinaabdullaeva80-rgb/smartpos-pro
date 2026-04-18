import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { TextInput, Button, Title, Card, Paragraph, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { autoDiscoverServer, setApiUrl, APP_VERSION, getCloudUrl } from '../config/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Камера для QR (только на нативных платформах)
let Camera = null;
let CameraView = null;
if (Platform.OS !== 'web') {
    try {
        const cameraModule = require('expo-camera');
        Camera = cameraModule.Camera;
        CameraView = cameraModule.CameraView;
    } catch (e) {
        console.log('[ServerSetup] expo-camera not available');
    }
}

/**
 * Экран настройки сервера — показывается при первом запуске.
 * 1) Автопоиск сервера в WiFi сети
 * 2) Если не найден — QR-сканер или ручной ввод
 */
export default function ServerSetupScreen({ onConnected }) {
    const { colors } = useTheme();

    // Состояние поиска
    const [phase, setPhase] = useState('scanning'); // 'scanning' | 'manual' | 'qr'
    const [statusText, setStatusText] = useState('Поиск сервера в WiFi сети...');
    const [foundUrl, setFoundUrl] = useState(null);

    // Ручной ввод
    const [manualUrl, setManualUrl] = useState('http://192.168.1.');
    const [manualName, setManualName] = useState('');
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState('');

    // QR-сканер
    const [cameraPermission, setCameraPermission] = useState(null);
    const [qrScanned, setQrScanned] = useState(false);

    // Анимация пульса
    const pulseAnim = useState(new Animated.Value(1))[0];

    useEffect(() => {
        if (phase === 'scanning') {
            startPulse();
            performAutoDiscovery();
        }
    }, [phase]);

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, easing: Easing.ease, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
            ])
        ).start();
    };

    const performAutoDiscovery = async () => {
        setStatusText('Поиск сервера в WiFi сети...');

        try {
            const url = await autoDiscoverServer();
            if (url) {
                setFoundUrl(url);
                setStatusText(`Найден сервер: ${url}`);
                setPhase('manual'); // Показываем экран с кнопками, но предзаполняем URL
                setManualUrl(url);
                setManualName('Авто-обнаружение');
                return;
            }
        } catch (e) {
            console.log('[ServerSetup] Auto-discovery error:', e.message);
        }

        // Не нашли — показываем варианты
        setPhase('manual');
    };

    // Проверка и сохранение сервера
    const saveAndConnect = async (url, name = '') => {
        setTesting(true);
        setError('');

        try {
            const cleanUrl = url.replace(/\/+$/, '');
            const apiUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${apiUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Сохраняем
                setApiUrl(apiUrl);
                await AsyncStorage.setItem('server_url', apiUrl);
                await AsyncStorage.setItem('server_name', name || cleanUrl);

                Alert.alert(
                    '✅ Подключено!',
                    `Сервер: ${name || cleanUrl}`,
                    [{ text: 'Продолжить', onPress: () => onConnected() }]
                );
                return true;
            } else {
                setError('Сервер ответил с ошибкой. Проверьте адрес.');
                return false;
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                setError('Время ожидания истекло. Сервер не отвечает.');
            } else {
                setError('Не удалось подключиться.\nПроверьте:\n• Адрес и порт\n• Сервер запущен\n• Устройство в той же WiFi сети');
            }
            return false;
        } finally {
            setTesting(false);
        }
    };

    // QR-сканер
    const openQRScanner = async () => {
        if (!Camera) {
            Alert.alert('Ошибка', 'Камера недоступна на этой платформе');
            return;
        }
        const { status } = await Camera.requestCameraPermissionsAsync();
        setCameraPermission(status === 'granted');
        if (status === 'granted') {
            setQrScanned(false);
            setPhase('qr');
        } else {
            Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках');
        }
    };

    const handleQRScanned = async ({ type, data }) => {
        if (qrScanned) return;
        setQrScanned(true);

        console.log('[ServerSetup] QR scanned:', data);

        // QR содержит JSON или просто URL
        let serverUrl = data;
        let serverName = '';
        try {
            const parsed = JSON.parse(data);
            serverUrl = parsed.url || parsed.server_url || data;
            serverName = parsed.name || parsed.company_name || '';
        } catch (e) {
            // Это просто URL, не JSON
        }

        // Убедимся что это URL
        if (!serverUrl.startsWith('http')) {
            serverUrl = `http://${serverUrl}`;
        }

        setPhase('manual');
        setManualUrl(serverUrl);
        setManualName(serverName);

        // Автоматически пробуем подключиться
        await saveAndConnect(serverUrl, serverName);
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    // =========== QR-СКАНЕР ===========
    if (phase === 'qr' && CameraView) {
        return (
            <View style={styles.qrContainer}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={qrScanned ? undefined : handleQRScanned}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <View style={styles.qrOverlay}>
                    <View style={styles.qrFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                    <Paragraph style={styles.qrHint}>
                        Наведите камеру на QR-код{'\n'}в веб-панели SmartPOS Pro
                    </Paragraph>
                </View>
                <View style={styles.qrControls}>
                    <Button
                        mode="contained"
                        onPress={() => setPhase('manual')}
                        icon="close"
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    >
                        Закрыть
                    </Button>
                </View>
            </View>
        );
    }

    // =========== ПОИСК ===========
    if (phase === 'scanning') {
        return (
            <View style={[styles.container, styles.center, dynamicStyles.container]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Title style={[styles.scanningIcon, dynamicStyles.text]}>📡</Title>
                </Animated.View>
                <Title style={[styles.scanningTitle, dynamicStyles.text]}>SmartPOS Pro</Title>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
                <Paragraph style={[styles.scanningText, dynamicStyles.textSecondary]}>
                    {statusText}
                </Paragraph>
            </View>
        );
    }

    // =========== РУЧНАЯ НАСТРОЙКА ===========
    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Title style={[styles.logo, dynamicStyles.text]}>📡</Title>
                <Title style={[styles.title, dynamicStyles.text]}>Подключение к серверу</Title>
                <Paragraph style={[styles.subtitle, dynamicStyles.textSecondary]}>
                    Сервер не найден автоматически.{'\n'}Выберите способ подключения:
                </Paragraph>

                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        {/* QR-код кнопка */}
                        <Button
                            mode="contained"
                            onPress={openQRScanner}
                            icon="qrcode-scan"
                            style={styles.qrButton}
                            contentStyle={{ paddingVertical: 8 }}
                        >
                            📱 Сканировать QR-код
                        </Button>

                        <Paragraph style={[styles.qrDescription, dynamicStyles.textSecondary]}>
                            Откройте веб-панель SmartPOS Pro → Настройки → QR-код для мобильного
                        </Paragraph>

                        <Divider style={styles.divider} />

                        <Paragraph style={[{ textAlign: 'center', marginBottom: 12, fontWeight: '600' }, dynamicStyles.text]}>
                            Или введите адрес вручную:
                        </Paragraph>

                        <TextInput
                            label="Название (необязательно)"
                            value={manualName}
                            onChangeText={setManualName}
                            placeholder="Мой магазин"
                            mode="outlined"
                            style={[styles.input, dynamicStyles.input]}
                            left={<TextInput.Icon icon="store" />}
                        />

                        <TextInput
                            label="Адрес сервера"
                            value={manualUrl}
                            onChangeText={(text) => { setManualUrl(text); setError(''); }}
                            placeholder="http://192.168.1.45:5000"
                            mode="outlined"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[styles.input, dynamicStyles.input]}
                            left={<TextInput.Icon icon="web" />}
                            error={!!error}
                        />

                        {error ? (
                            <Paragraph style={styles.error}>{error}</Paragraph>
                        ) : (
                            <Paragraph style={[styles.hint, dynamicStyles.textSecondary]}>
                                💡 IP адрес компьютера с SmartPOS Pro в вашей WiFi сети
                            </Paragraph>
                        )}

                        <Button
                            mode="contained"
                            onPress={() => saveAndConnect(manualUrl.trim(), manualName.trim())}
                            loading={testing}
                            disabled={testing || !manualUrl.trim()}
                            style={styles.connectButton}
                            icon="connection"
                        >
                            Подключиться
                        </Button>

                        <Button
                            mode="text"
                            onPress={() => {
                                setError('');
                                setPhase('scanning');
                            }}
                            icon="refresh"
                            style={{ marginTop: 8 }}
                            labelStyle={dynamicStyles.textSecondary}
                        >
                            Повторить автопоиск
                        </Button>
                    </Card.Content>
                </Card>

                <Paragraph style={[styles.version, dynamicStyles.textSecondary]}>
                    Версия {APP_VERSION}
                </Paragraph>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
    title: { fontSize: 24, textAlign: 'center', fontWeight: 'bold' },
    subtitle: { textAlign: 'center', marginBottom: 16, fontSize: 14, lineHeight: 20 },
    card: { marginBottom: 24, elevation: 4 },
    input: { marginBottom: 12 },
    qrButton: { marginBottom: 8, paddingVertical: 4 },
    qrDescription: { textAlign: 'center', fontSize: 11, marginBottom: 4, lineHeight: 16 },
    connectButton: { marginTop: 8, paddingVertical: 4 },
    divider: { marginVertical: 16 },
    error: { color: '#ef4444', fontSize: 13, marginBottom: 8, textAlign: 'center', lineHeight: 18 },
    hint: { fontSize: 11, marginBottom: 4 },
    version: { textAlign: 'center', fontSize: 12 },
    // Scanning phase
    scanningIcon: { fontSize: 72, textAlign: 'center' },
    scanningTitle: { fontSize: 28, textAlign: 'center', fontWeight: 'bold', marginTop: 16 },
    scanningText: { textAlign: 'center', fontSize: 16 },
    // QR Scanner
    qrContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    qrOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    qrFrame: { width: 250, height: 250, position: 'relative' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#10b981', borderWidth: 4 },
    topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    qrHint: { color: '#fff', marginTop: 24, textAlign: 'center', fontSize: 16, lineHeight: 22 },
    qrControls: { position: 'absolute', bottom: 50, left: 40, right: 40 },
});
