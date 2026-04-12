import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Text, Animated, Dimensions } from 'react-native';
import { Card, Title, Paragraph, Button, TextInput, Chip, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { setApiUrl, autoDiscoverServer } from '../config/settings';

const DEFAULT_SERVER = 'http://192.168.1.45:5000';
// Единый ключ для AsyncStorage — используется в App.js, api.js и здесь
const STORAGE_KEY = 'server_url';

export default function ServerSettingsScreen({ navigation, onServerChange }) {
    const { colors } = useTheme();

    const [serverUrl, setServerUrl] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [testing, setTesting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [licenseInfo, setLicenseInfo] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadSettings();
    }, []);

    // Пульсирующий индикатор при подключении
    useEffect(() => {
        if (connected) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [connected]);

    const loadSettings = async () => {
        try {
            // Читаем из единого ключа server_url
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            const savedLicense = await AsyncStorage.getItem('licenseKey');
            if (saved) {
                setServerUrl(saved);
                // Автоматически проверяем подключение при загрузке
                testConnectionSilent(saved);
            } else {
                setServerUrl(DEFAULT_SERVER);
            }
            if (savedLicense) setLicenseKey(savedLicense);
        } catch (error) {
            console.error('Error loading settings:', error);
            setServerUrl(DEFAULT_SERVER);
        }
    };

    // Тихая проверка подключения (без алертов)
    const testConnectionSilent = async (url) => {
        try {
            const cleanUrl = url.replace(/\/+$/, '').replace(/\/api$/, '');
            const response = await fetch(`${cleanUrl}/api/health`, {
                method: 'GET',
                headers: { 'ngrok-skip-browser-warning': 'true' },
            });
            if (response.ok) {
                setConnected(true);
            }
        } catch (e) {
            // тихо — не показываем ошибку
        }
    };

    const testConnection = async () => {
        if (!serverUrl) {
            Alert.alert('Ошибка', 'Введите URL сервера');
            return;
        }

        setTesting(true);
        setConnected(false);

        try {
            const url = serverUrl.replace(/\/+$/, '').replace(/\/api$/, '');
            const response = await fetch(`${url}/api/health`, {
                method: 'GET',
                headers: { 'ngrok-skip-browser-warning': 'true' },
            });

            if (response.ok) {
                setConnected(true);
                Alert.alert('✅ Успех', 'Соединение с сервером установлено!');
            } else {
                Alert.alert('Ошибка', `Сервер ответил: ${response.status}`);
            }
        } catch (error) {
            Alert.alert('❌ Ошибка', 'Не удалось подключиться к серверу.\n\nПроверьте:\n• Телефон и ПК в одной WiFi сети?\n• SmartPOS Pro запущена на ПК?\n• Правильный IP-адрес?');
        } finally {
            setTesting(false);
        }
    };

    // Автопоиск сервера в локальной сети
    const handleAutoDiscover = async () => {
        setDiscovering(true);
        try {
            const foundUrl = await autoDiscoverServer();
            if (foundUrl) {
                // autoDiscoverServer returns URL with /api, strip it for display
                const cleanUrl = foundUrl.replace(/\/api$/, '');
                setServerUrl(cleanUrl);
                setConnected(true);
                Alert.alert('✅ Найден!', `Сервер найден: ${cleanUrl}\n\nНажмите "Сохранить" чтобы запомнить.`);
            } else {
                Alert.alert('❌ Не найден', 'Сервер не обнаружен в WiFi сети.\n\nПроверьте:\n• SmartPOS Pro запущена на ПК?\n• Оба устройства в одной WiFi сети?');
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Ошибка поиска: ' + error.message);
        } finally {
            setDiscovering(false);
        }
    };

    // Обработка QR-кода (будет вызвана из BarcodeScannerScreen)
    const handleQRScanned = async (scannedUrl) => {
        setScanning(false);
        if (scannedUrl) {
            // Очищаем URL — убираем /api если есть
            let cleanUrl = scannedUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
            // Если URL не начинается с http — добавляем
            if (!cleanUrl.startsWith('http')) {
                cleanUrl = `http://${cleanUrl}`;
            }
            setServerUrl(cleanUrl);

            // Автотест подключения
            setTesting(true);
            try {
                const response = await fetch(`${cleanUrl}/api/health`, {
                    method: 'GET',
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                });
                if (response.ok) {
                    setConnected(true);
                    // Автосохранение при успешном сканировании QR
                    await AsyncStorage.setItem(STORAGE_KEY, cleanUrl);
                    setApiUrl(`${cleanUrl}/api`);
                    if (onServerChange) onServerChange(cleanUrl);
                    Alert.alert('✅ Подключено!', `Сервер: ${cleanUrl}\n\nАдрес сохранён — при следующем запуске подключится автоматически.`);
                } else {
                    Alert.alert('⚠️ Ответ сервера', `Код: ${response.status}. Проверьте URL.`);
                }
            } catch (error) {
                setServerUrl(cleanUrl);
                Alert.alert('⚠️ QR отсканирован', `URL: ${cleanUrl}\n\nНе удалось подключиться. Проверьте WiFi.`);
            } finally {
                setTesting(false);
            }
        }
    };

    const activateLicense = async () => {
        if (!licenseKey) {
            Alert.alert('Ошибка', 'Введите ключ лицензии');
            return;
        }

        setTesting(true);

        try {
            const url = serverUrl.replace(/\/+$/, '').replace(/\/api$/, '');
            const response = await fetch(`${url}/api/organizations/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ license_key: licenseKey })
            });

            const data = await response.json();

            if (response.ok && data.activated) {
                setLicenseInfo(data);
                await AsyncStorage.setItem('licenseKey', licenseKey);
                await AsyncStorage.setItem('organizationId', String(data.organization.id));
                Alert.alert('Успех', `Лицензия активирована для: ${data.organization.name}`);
            } else {
                Alert.alert('Ошибка', data.error || 'Не удалось активировать лицензию');
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Ошибка активации: ' + error.message);
        } finally {
            setTesting(false);
        }
    };

    const saveAndClose = async () => {
        try {
            const url = serverUrl.replace(/\/+$/, '').replace(/\/api$/, '');
            // Сохраняем под единым ключом server_url
            await AsyncStorage.setItem(STORAGE_KEY, url);
            // Обновляем API URL немедленно
            setApiUrl(`${url}/api`);

            if (onServerChange) {
                onServerChange(url);
            }

            Alert.alert('💾 Сохранено', 'Адрес сервера сохранён.\nПриложение будет подключаться автоматически при следующем запуске.');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить настройки');
        }
    };

    const resetToDefault = async () => {
        setServerUrl(DEFAULT_SERVER);
        await AsyncStorage.setItem(STORAGE_KEY, DEFAULT_SERVER);
        setApiUrl(`${DEFAULT_SERVER}/api`);
        setConnected(false);
        Alert.alert('Сброшено', 'URL сервера сброшен на значение по умолчанию');
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.surface },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Статус подключения */}
            {connected && (
                <View style={styles.statusBar}>
                    <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
                    <Text style={styles.statusText}>Подключено к серверу</Text>
                </View>
            )}

            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🌐 Настройки сервера</Title>
                    <Paragraph style={dynamicStyles.textSecondary}>
                        Подключитесь к серверу SmartPOS Pro один раз — приложение запомнит адрес навсегда
                    </Paragraph>

                    <TextInput
                        label="URL сервера"
                        value={serverUrl}
                        onChangeText={setServerUrl}
                        style={styles.input}
                        mode="outlined"
                        placeholder="http://192.168.1.45:5000"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <View style={styles.buttonRow}>
                        <Button
                            mode="outlined"
                            onPress={testConnection}
                            loading={testing}
                            style={styles.button}
                            icon="lan-check"
                        >
                            Проверить
                        </Button>
                        <Button
                            mode="outlined"
                            onPress={handleAutoDiscover}
                            loading={discovering}
                            style={styles.button}
                            icon="radar"
                        >
                            Найти
                        </Button>
                    </View>

                    {/* QR-сканер */}
                    <Button
                        mode="contained"
                        onPress={() => {
                            navigation.navigate('BarcodeScanner', {
                                onScan: (data) => {
                                    handleQRScanned(data);
                                },
                            });
                        }}
                        style={[styles.qrButton]}
                        icon="qrcode-scan"
                        buttonColor="#6366f1"
                    >
                        📱 Сканировать QR-код с компьютера
                    </Button>

                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Откройте SmartPOS Pro на ПК → Настройки → Сервер и мобильные → сканируйте QR-код
                    </Text>

                    {connected && (
                        <Chip icon="check-circle" style={styles.chip} textStyle={{ color: '#4ade80' }}>
                            Подключено — адрес будет сохранён
                        </Chip>
                    )}
                </Card.Content>
            </Card>

            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🔑 Лицензия</Title>
                    <Paragraph style={dynamicStyles.textSecondary}>
                        Введите ключ лицензии для активации
                    </Paragraph>

                    <TextInput
                        label="Ключ лицензии"
                        value={licenseKey}
                        onChangeText={setLicenseKey}
                        style={styles.input}
                        mode="outlined"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        autoCapitalize="characters"
                    />

                    <Button
                        mode="contained"
                        onPress={activateLicense}
                        loading={testing}
                        style={styles.button}
                    >
                        Активировать лицензию
                    </Button>

                    {licenseInfo && (
                        <View style={styles.licenseInfo}>
                            <Paragraph style={dynamicStyles.textSecondary}>
                                Организация: {licenseInfo.organization?.name}
                            </Paragraph>
                            <Paragraph style={dynamicStyles.textSecondary}>
                                План: {licenseInfo.license?.plan}
                            </Paragraph>
                        </View>
                    )}
                </Card.Content>
            </Card>

            <Button
                mode="contained"
                onPress={saveAndClose}
                style={styles.saveButton}
                icon="content-save"
            >
                💾 Сохранить и закрыть
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    card: { marginBottom: 16 },
    input: { marginTop: 16, marginBottom: 8 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    button: { flex: 1, marginHorizontal: 4 },
    qrButton: { marginTop: 8, marginBottom: 8, borderRadius: 12, paddingVertical: 4 },
    hint: { fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
    chip: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.15)' },
    licenseInfo: { marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
    saveButton: { marginTop: 16 },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.3)',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22c55e',
        marginRight: 8,
    },
    statusText: {
        color: '#4ade80',
        fontWeight: '600',
        fontSize: 14,
    },
});
