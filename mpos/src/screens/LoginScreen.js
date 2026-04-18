import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { TextInput, Button, Title, Card, Paragraph, ActivityIndicator, Portal, Dialog, Divider, List, IconButton, Chip } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import SoundManager from '../services/sounds';
import { autoDiscoverServer, setApiUrl, getApiUrl, APP_VERSION, initSettings, setCloudUrl, getCloudUrl, getLicenseData } from '../config/settings';

// Ключи хранилища
const STORAGE_KEYS = {
    SERVER_URL: 'server_url',
    SERVER_LIST: 'server_list',
    LAST_SERVER: 'last_server_name',
};

// Камера для QR
let CameraView = null;
if (Platform.OS !== 'web') {
    try {
        const cameraModule = require('expo-camera');
        CameraView = cameraModule.CameraView;
    } catch (e) {
        console.log('[Login] expo-camera not available');
    }
}

export default function LoginScreen({ onLogin, onChangeServer }) {
    const { colors } = useTheme();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [serverStatus, setServerStatus] = useState('searching');
    const [serverUrl, setServerUrl] = useState('');
    const [serverName, setServerName] = useState('');

    // Диалоги
    const [showServerDialog, setShowServerDialog] = useState(false);
    const [showServerList, setShowServerList] = useState(false);
    const [showAddServer, setShowAddServer] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [testingServer, setTestingServer] = useState(false);

    // Форма добавления сервера
    const [newServerName, setNewServerName] = useState('');
    const [newServerUrl, setNewServerUrl] = useState('');

    // Список сохранённых серверов
    const [savedServers, setSavedServers] = useState([]);

    // Загрузка сохранённых серверов
    useEffect(() => {
        loadSavedServers();
    }, []);

    const loadSavedServers = async () => {
        try {
            const list = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_LIST);
            if (list) {
                setSavedServers(JSON.parse(list));
            }
        } catch (e) {
            console.log('[Login] Error loading server list:', e);
        }
    };

    const saveServerList = async (list) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SERVER_LIST, JSON.stringify(list));
            setSavedServers(list);
        } catch (e) {
            console.log('[Login] Error saving server list:', e);
        }
    };

    // Добавление сервера в список
    const addServer = async (name, url) => {
        const cleanUrl = url.replace(/\/+$/, '');
        const serverEntry = {
            id: Date.now().toString(),
            name: name || cleanUrl,
            url: cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`,
            addedAt: new Date().toISOString(),
        };
        const newList = [...savedServers.filter(s => s.url !== serverEntry.url), serverEntry];
        await saveServerList(newList);
        return serverEntry;
    };

    // Удаление сервера из списка
    const removeServer = async (id) => {
        const newList = savedServers.filter(s => s.id !== id);
        await saveServerList(newList);
    };

    // Подключение к серверу
    const connectToServer = async (url, name = '') => {
        setTestingServer(true);
        try {
            const cleanUrl = url.replace(/\/+$/, '');
            const testUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${testUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                setApiUrl(testUrl);
                setServerUrl(testUrl);
                setServerName(name);
                await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, testUrl);
                await AsyncStorage.setItem(STORAGE_KEYS.LAST_SERVER, name);
                setServerStatus('found');
                setShowServerDialog(false);
                setShowServerList(false);
                setShowAddServer(false);

                // Автоматически сохраняем в список
                if (name) {
                    await addServer(name, testUrl);
                }

                Alert.alert('✅ Подключено', `Сервер: ${name || testUrl}`);
                return true;
            } else {
                Alert.alert('❌ Ошибка', 'Сервер ответил с ошибкой');
                return false;
            }
        } catch (e) {
            Alert.alert('❌ Ошибка подключения', 'Не удалось подключиться.\nПроверьте:\n• Адрес и порт\n• Сервер запущен\n• Устройство в сети');
            return false;
        } finally {
            setTestingServer(false);
        }
    };

    // QR-сканер
    const [qrScanned, setQrScanned] = useState(false);

    const handleQRScanned = async ({ data }) => {
        if (qrScanned) return;
        setQrScanned(true);

        console.log('[Login] QR scanned:', data);
        let url = data;
        let name = '';
        try {
            const parsed = JSON.parse(data);
            url = parsed.url || data;
            name = parsed.name || '';
        } catch (e) {}

        setShowQRScanner(false);
        setQrScanned(false);
        await connectToServer(url, name);
    };

    // Подключение к серверу на основе лицензии
    useEffect(() => {
        const connectFromLicense = async () => {
            setServerStatus('searching');
            await initSettings();

            const licenseData = getLicenseData();
            const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);

            if (savedUrl) {
                // Проверяем доступность сохранённого сервера
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    const response = await fetch(`${savedUrl}/health`, {
                        method: 'GET',
                        signal: controller.signal,
                        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
                    });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        setApiUrl(savedUrl);
                        setServerUrl(savedUrl);
                        setServerName(licenseData?.company_name || '');
                        setServerStatus('found');
                        return;
                    }
                } catch (e) {
                    console.log('[Login] Saved server unavailable:', e.message);
                }
            }

            // Fallback: попробовать автопоиск
            const foundUrl = await autoDiscoverServer();
            if (foundUrl) {
                setApiUrl(foundUrl);
                setServerUrl(foundUrl);
                setServerName(licenseData?.company_name || '');
                await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, foundUrl);
                setServerStatus('found');
            } else {
                setServerUrl(getApiUrl());
                setServerName(licenseData?.company_name || '');
                setServerStatus('not_found');
            }
        };

        connectFromLicense();
    }, []);

    // Автологин после нахождения сервера
    useEffect(() => {
        if (serverStatus !== 'found') return;

        const tryAutoLogin = async () => {
            const savedToken = await AsyncStorage.getItem('token');
            const savedUser = await AsyncStorage.getItem('saved_username');

            // Очистить устаревший saved_password если он ещё есть
            await AsyncStorage.removeItem('saved_password');

            if (!savedToken && !savedUser) return;

            // 1) Пробуем сохранённый токен
            if (savedToken) {
                try {
                    console.log('[AutoLogin] Trying saved token');
                    const res = await authAPI.getCurrentUser();
                    if (res.data && res.data.id) {
                        await AsyncStorage.setItem('user', JSON.stringify(res.data));
                        onLogin();
                        return;
                    }
                } catch (e) {
                    console.log('[AutoLogin] Token expired:', e.message);
                    await AsyncStorage.removeItem('token');
                }
            }

            // 2) Токен протух — подставить сохранённый логин для удобства
            if (savedUser) setUsername(savedUser);
        };

        tryAutoLogin();
    }, [serverStatus]);

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            SoundManager.playError();
            Alert.alert('Ошибка', 'Введите логин и пароль');
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.login({ username: username.trim(), password });
            const { token, user } = response.data;

            await AsyncStorage.setItem('token', token);
            await AsyncStorage.setItem('user', JSON.stringify(user));
            // Сохранить только имя пользователя для удобства (пароль НЕ сохраняем)
            await AsyncStorage.setItem('saved_username', username.trim());

            // 🔒 Кэшировать данные для офлайн-логина (хэш пароля)
            try {
                // Простой хэш для проверки пароля без сервера
                const encoder = new TextEncoder();
                const data = encoder.encode(password + '_smartpos_salt_' + username.trim());
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                await AsyncStorage.setItem('offline_credentials', JSON.stringify({
                    username: username.trim(),
                    passwordHash: hashHex,
                    user: user,
                    cachedAt: Date.now(),
                }));
                console.log('[Login] Offline credentials cached ✓');
            } catch (hashError) {
                console.warn('[Login] Failed to cache offline credentials:', hashError.message);
            }

            SoundManager.playSuccess();
            onLogin();
        } catch (error) {
            // 🔄 Попытка офлайн-логина при ошибке сети
            if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || !error.response) {
                console.log('[Login] Server unavailable, trying offline login...');
                try {
                    const cached = await AsyncStorage.getItem('offline_credentials');
                    if (cached) {
                        const creds = JSON.parse(cached);
                        if (creds.username === username.trim()) {
                            // Проверить пароль через хэш
                            const encoder = new TextEncoder();
                            const data = encoder.encode(password + '_smartpos_salt_' + username.trim());
                            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                            const hashArray = Array.from(new Uint8Array(hashBuffer));
                            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                            if (hashHex === creds.passwordHash) {
                                // Пароль совпал — офлайн-вход
                                await AsyncStorage.setItem('user', JSON.stringify(creds.user));
                                SoundManager.playSuccess();
                                Alert.alert(
                                    '📱 Офлайн-режим',
                                    'Сервер недоступен. Вы вошли в офлайн-режим.\nПродажи будут синхронизированы при подключении к WiFi.',
                                );
                                onLogin();
                                return;
                            }
                        }
                    }
                } catch (offlineError) {
                    console.warn('[Login] Offline login failed:', offlineError.message);
                }
                SoundManager.playError();
                Alert.alert('Сервер недоступен', 'Нет связи с сервером и нет данных для офлайн-входа.\nПодключитесь к WiFi хотя бы один раз.');
            } else {
                SoundManager.playError();
                const message = error.response?.data?.error || 'Неверный логин или пароль.\nПроверьте подключение к серверу.';
                Alert.alert('Ошибка входа', message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Сброс сервера и повторный поиск
    const resetAndSearch = async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.SERVER_URL);
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SERVER);
        setShowServerDialog(false);
        setServerStatus('searching');
        setServerName('');

        const foundUrl = await autoDiscoverServer();
        if (foundUrl) {
            setApiUrl(foundUrl);
            setServerUrl(foundUrl);
            await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, foundUrl);
            setServerStatus('found');
        } else {
            setServerUrl(getApiUrl());
            setServerStatus('not_found');
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    // Рендер статуса сервера
    const renderServerStatus = () => {
        const statusConfig = {
            searching: { icon: null, text: 'Поиск сервера...', color: colors.primary, loading: true },
            found: { icon: '✅', text: serverName ? `${serverName}` : serverUrl, color: '#22c55e', loading: false },
            not_found: { icon: '❌', text: 'Сервер не найден', color: '#ef4444', loading: false },
            cloud: { icon: '☁️', text: 'Облачный сервер', color: colors.textSecondary, loading: false },
        };
        const config = statusConfig[serverStatus] || statusConfig.not_found;

        return (
            <TouchableOpacity
                onPress={() => {
                    setNewServerUrl(serverUrl || 'http://192.168.1.45:5000');
                    setNewServerName('');
                    setShowServerDialog(true);
                }}
                style={styles.serverStatusBtn}
            >
                <View style={styles.serverStatus}>
                    {config.loading && <ActivityIndicator size="small" color={config.color} />}
                    <Paragraph style={[styles.statusText, { color: config.color }]}>
                        {config.icon ? `${config.icon} ` : ''}{config.text}
                    </Paragraph>
                </View>
                <Paragraph style={[styles.tapHint, dynamicStyles.textSecondary]}>
                    ⚙️ Нажмите для настройки сервера
                </Paragraph>
            </TouchableOpacity>
        );
    };

    // Рендер списка серверов
    const renderServerListDialog = () => (
        <Portal>
            <Dialog visible={showServerList} onDismiss={() => setShowServerList(false)} style={{ maxHeight: '80%' }}>
                <Dialog.Title>📋 Сохранённые серверы</Dialog.Title>
                <Dialog.ScrollArea style={{ maxHeight: 300 }}>
                    <ScrollView>
                        {savedServers.length === 0 ? (
                            <Paragraph style={{ textAlign: 'center', padding: 20, color: colors.textSecondary }}>
                                Нет сохранённых серверов.{'\n'}Добавьте сервер через "+"
                            </Paragraph>
                        ) : (
                            savedServers.map((server) => (
                                <List.Item
                                    key={server.id}
                                    title={server.name}
                                    description={server.url}
                                    left={props => <List.Icon {...props} icon="server" />}
                                    right={props => (
                                        <View style={{ flexDirection: 'row' }}>
                                            <IconButton
                                                icon="connection"
                                                size={20}
                                                onPress={() => connectToServer(server.url, server.name)}
                                            />
                                            <IconButton
                                                icon="delete"
                                                size={20}
                                                onPress={() => {
                                                    Alert.alert('Удалить?', `Удалить сервер "${server.name}"?`, [
                                                        { text: 'Отмена' },
                                                        { text: 'Удалить', style: 'destructive', onPress: () => removeServer(server.id) },
                                                    ]);
                                                }}
                                            />
                                        </View>
                                    )}
                                    onPress={() => connectToServer(server.url, server.name)}
                                    style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border || '#333' }}
                                />
                            ))
                        )}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions style={{ justifyContent: 'space-between' }}>
                    <Button icon="plus" onPress={() => {
                        setShowServerList(false);
                        setShowAddServer(true);
                    }}>Добавить</Button>
                    <Button onPress={() => setShowServerList(false)}>Закрыть</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );

    // Рендер добавления сервера
    const [serverType, setServerType] = useState('wifi'); // 'wifi' или 'internet'

    const renderAddServerDialog = () => (
        <Portal>
            <Dialog visible={showAddServer} onDismiss={() => setShowAddServer(false)}>
                <Dialog.Title>➕ Добавить сервер</Dialog.Title>
                <Dialog.Content>
                    {/* Тип подключения */}
                    <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                        <Chip
                            selected={serverType === 'wifi'}
                            onPress={() => {
                                setServerType('wifi');
                                setNewServerUrl('http://192.168.1.45:5000');
                            }}
                            icon="wifi"
                            style={{ flex: 1 }}
                        >
                            WiFi (локальный)
                        </Chip>
                        <Chip
                            selected={serverType === 'internet'}
                            onPress={() => {
                                setServerType('internet');
                                setNewServerUrl('https://');
                            }}
                            icon="web"
                            style={{ flex: 1 }}
                        >
                            Интернет
                        </Chip>
                    </View>

                    <TextInput
                        label="Название (напр. Магазин №1)"
                        value={newServerName}
                        onChangeText={setNewServerName}
                        mode="outlined"
                        style={{ marginBottom: 12 }}
                        left={<TextInput.Icon icon="store" />}
                    />
                    <TextInput
                        label="Адрес сервера"
                        value={newServerUrl}
                        onChangeText={setNewServerUrl}
                        placeholder={serverType === 'wifi' ? 'http://192.168.1.45:5000' : 'https://your-server.com'}
                        mode="outlined"
                        autoCapitalize="none"
                        autoCorrect={false}
                        left={<TextInput.Icon icon={serverType === 'wifi' ? 'wifi' : 'web'} />}
                    />
                    <Paragraph style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
                        {serverType === 'wifi'
                            ? '💡 IP адрес ПК с SmartPOS Pro в вашей WiFi сети'
                            : '💡 Адрес вашего облачного сервера (HTTPS)'}
                    </Paragraph>
                </Dialog.Content>
                <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16 }}>
                    <Button
                        mode="contained"
                        onPress={async () => {
                            if (!newServerUrl.trim()) {
                                Alert.alert('Ошибка', 'Введите адрес сервера');
                                return;
                            }
                            const name = newServerName.trim() || newServerUrl.trim();
                            const success = await connectToServer(newServerUrl.trim(), name);
                            if (success) {
                                await addServer(name, newServerUrl.trim());
                                // Если тип «Интернет» — сохранить как облачный fallback
                                if (serverType === 'internet') {
                                    await setCloudUrl(newServerUrl.trim());
                                }
                            }
                        }}
                        loading={testingServer}
                        disabled={testingServer}
                        icon="check-circle"
                        style={{ marginBottom: 8 }}
                    >
                        Проверить и подключить
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={async () => {
                            if (!newServerUrl.trim()) return;
                            const name = newServerName.trim() || newServerUrl.trim();
                            await addServer(name, newServerUrl.trim());
                            if (serverType === 'internet') {
                                await setCloudUrl(newServerUrl.trim());
                            }
                            setShowAddServer(false);
                            Alert.alert('✅ Сохранено', `Сервер "${name}" добавлен в список`);
                        }}
                        icon="content-save"
                        style={{ marginBottom: 8 }}
                    >
                        Сохранить без проверки
                    </Button>
                    <Button mode="text" onPress={() => setShowAddServer(false)}>Отмена</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );

    // Основной диалог настройки
    const renderServerSettingsDialog = () => (
        <Portal>
            <Dialog visible={showServerDialog} onDismiss={() => setShowServerDialog(false)}>
                <Dialog.Title>⚙️ Настройки сервера</Dialog.Title>
                <Dialog.Content>
                    <Paragraph style={{ marginBottom: 8, color: colors.textSecondary }}>
                        Текущий: {serverUrl || 'не установлен'}
                    </Paragraph>

                    <TextInput
                        label="Адрес сервера"
                        value={newServerUrl}
                        onChangeText={setNewServerUrl}
                        placeholder="http://192.168.1.45:5000"
                        mode="outlined"
                        autoCapitalize="none"
                        autoCorrect={false}
                        left={<TextInput.Icon icon="server" />}
                        style={{ marginBottom: 12 }}
                    />
                </Dialog.Content>
                <Dialog.Actions style={{ flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16 }}>
                    <Button
                        mode="contained"
                        onPress={() => connectToServer(newServerUrl.trim())}
                        loading={testingServer}
                        disabled={testingServer || !newServerUrl.trim()}
                        icon="check-circle"
                        style={{ marginBottom: 8 }}
                    >
                        Подключить
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={() => {
                            setShowServerDialog(false);
                            setShowServerList(true);
                        }}
                        icon="format-list-bulleted"
                        style={{ marginBottom: 8 }}
                    >
                        Мои серверы ({savedServers.length})
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={() => {
                            setShowServerDialog(false);
                            setShowAddServer(true);
                        }}
                        icon="plus-circle"
                        style={{ marginBottom: 8 }}
                    >
                        Добавить новый сервер
                    </Button>

                    {CameraView && (
                        <Button
                            mode="contained"
                            onPress={() => {
                                setShowServerDialog(false);
                                setShowQRScanner(true);
                            }}
                            icon="qrcode-scan"
                            style={{ marginBottom: 8, backgroundColor: colors.primary }}
                        >
                            📱 Сканировать QR-код
                        </Button>
                    )}

                    <Button
                        mode="text"
                        onPress={resetAndSearch}
                        icon="wifi-find"
                        style={{ marginBottom: 8 }}
                    >
                        Автопоиск в WiFi сети
                    </Button>

                    <Button mode="text" onPress={() => setShowServerDialog(false)}>
                        Отмена
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Title style={[styles.logo, dynamicStyles.text]}>🏪</Title>
                <Title style={[styles.title, dynamicStyles.text]}>SmartPOS Pro</Title>
                <Paragraph style={[styles.subtitle, dynamicStyles.textSecondary]}>Мобильный POS</Paragraph>

                {/* Статус сервера скрыт по просьбе пользователя */}
                {/* {renderServerStatus()} */}

                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <TextInput
                            label="Логин"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={[styles.input, dynamicStyles.input]}
                            mode="outlined"
                            left={<TextInput.Icon icon="account" />}
                        />

                        <TextInput
                            label="Пароль"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            style={[styles.input, dynamicStyles.input]}
                            mode="outlined"
                            left={<TextInput.Icon icon="lock" />}
                            right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
                        />

                        <Button
                            mode="contained"
                            onPress={handleLogin}
                            loading={loading}
                            disabled={loading || serverStatus === 'searching'}
                            style={styles.button}
                            icon="login"
                        >
                            Войти
                        </Button>
                    </Card.Content>
                </Card>

                <Paragraph style={[styles.version, dynamicStyles.textSecondary]}>Версия {APP_VERSION}</Paragraph>

                {/* Кнопка смены сервера */}
                {onChangeServer && (
                    <Button
                        mode="text"
                        onPress={async () => {
                            await AsyncStorage.removeItem('server_url');
                            await AsyncStorage.removeItem('server_name');
                            onChangeServer();
                        }}
                        icon="server-network"
                        labelStyle={[dynamicStyles.textSecondary, { fontSize: 12 }]}
                        style={{ marginTop: 4 }}
                    >
                        Сменить сервер
                    </Button>
                )}
            </View>

            {/* Диалоги */}
            {renderServerSettingsDialog()}
            {renderServerListDialog()}
            {renderAddServerDialog()}

            {/* QR-сканер полноэкранный */}
            <Portal>
                {showQRScanner && CameraView && (
                    <View style={StyleSheet.absoluteFillObject}>
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
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
                            <Button
                                mode="contained"
                                onPress={() => setShowQRScanner(false)}
                                style={{ marginTop: 40, backgroundColor: 'rgba(0,0,0,0.6)' }}
                            >
                                Закрыть
                            </Button>
                        </View>
                    </View>
                )}
            </Portal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
    title: { fontSize: 28, textAlign: 'center', fontWeight: 'bold' },
    subtitle: { textAlign: 'center', marginBottom: 8, fontSize: 16 },
    serverStatusBtn: { marginBottom: 12, alignItems: 'center' },
    serverStatus: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    statusText: { textAlign: 'center', fontSize: 12 },
    tapHint: { textAlign: 'center', fontSize: 11, marginTop: 2 },
    card: { marginBottom: 24 },
    input: { marginBottom: 16 },
    button: { marginTop: 8, paddingVertical: 8 },
    version: { textAlign: 'center', fontSize: 12 },
    // QR Styles
    qrOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    qrFrame: { width: 250, height: 250, position: 'relative' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#10b981', borderWidth: 4 },
    topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    qrHint: { color: '#fff', marginTop: 24, textAlign: 'center', fontSize: 16, textShadowColor: '#000', textShadowRadius: 4 },
});
