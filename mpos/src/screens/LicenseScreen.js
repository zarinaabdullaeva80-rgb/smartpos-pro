import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { TextInput, Button, Title, Card, Paragraph, ActivityIndicator, Divider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { licenseAPI } from '../services/api';
import { setLicenseKey, setApiUrl, APP_VERSION, getCloudUrl } from '../config/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LicenseScreen({ onActivated }) {
    const { colors } = useTheme();

    const [licenseKey, setLicenseKeyInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Ручной ввод адреса
    const [showManual, setShowManual] = useState(false);
    const [manualUrl, setManualUrl] = useState('http://192.168.1.45:5000');
    const [manualName, setManualName] = useState('');

    // Автоформатирование ключа (XXXX-XXXX-XXXX-XXXX)
    const formatKey = (text) => {
        const clean = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const parts = clean.match(/.{1,4}/g) || [];
        return parts.join('-').substring(0, 19);
    };

    const handleActivate = async () => {
        const key = licenseKey.trim();
        if (key.length < 8) {
            setError('Введите полный лицензионный ключ');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Запрос к облачному серверу
            const cloudUrl = getCloudUrl() + '/api';
            console.log('[License] Resolving key via:', cloudUrl);
            const response = await licenseAPI.resolve(key, cloudUrl);
            const data = response.data;

            if (data.valid) {
                // Сохраняем лицензию и URL сервера
                await setLicenseKey(key, {
                    company_name: data.company_name,
                    server_url: data.server_url,
                    server_type: data.server_type,
                    license_type: data.license_type,
                    expires_at: data.expires_at,
                    max_devices: data.max_devices,
                });

                Alert.alert(
                    '✅ Лицензия активирована',
                    `Компания: ${data.company_name}\nСервер: ${data.server_type === 'cloud' ? 'Облако' : data.server_url}`,
                    [{ text: 'Продолжить', onPress: () => onActivated() }]
                );
            } else {
                setError(data.error || 'Недействительный ключ');
            }
        } catch (err) {
            console.error('[License] Resolve error:', err.message);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
                setError('Нет связи с сервером. Проверьте интернет-соединение.');
            } else {
                setError('Ошибка проверки ключа. Попробуйте позже.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleManualConnect = async () => {
        if (!manualUrl.trim()) {
            Alert.alert('Ошибка', 'Введите адрес сервера');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const cleanUrl = manualUrl.trim().replace(/\/+$/, '');
            const apiUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;

            // Проверяем доступность сервера
            await licenseAPI.checkHealth(cleanUrl);

            // Сохраняем как "локальный" сервер
            setApiUrl(apiUrl);
            await AsyncStorage.setItem('server_url', apiUrl);
            await setLicenseKey('LOCAL-SERVER', {
                company_name: manualName || 'Локальный сервер',
                server_url: apiUrl,
                server_type: 'local',
                license_type: 'local',
            });

            Alert.alert(
                '✅ Подключено',
                `Сервер: ${cleanUrl}`,
                [{ text: 'Продолжить', onPress: () => onActivated() }]
            );
        } catch (err) {
            setError('Не удалось подключиться. Проверьте адрес и убедитесь что сервер запущен.');
        } finally {
            setLoading(false);
        }
    };

    const dynamicStyles = {
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card },
        input: { backgroundColor: colors.input },
        text: { color: colors.text },
        textSecondary: { color: colors.textSecondary },
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, dynamicStyles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Title style={[styles.logo, dynamicStyles.text]}>🔑</Title>
                <Title style={[styles.title, dynamicStyles.text]}>SmartPOS Pro</Title>
                <Paragraph style={[styles.subtitle, dynamicStyles.textSecondary]}>
                    Активация лицензии
                </Paragraph>

                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        {!showManual ? (
                            <>
                                <TextInput
                                    label="Лицензионный ключ"
                                    value={licenseKey}
                                    onChangeText={(text) => {
                                        setLicenseKeyInput(formatKey(text));
                                        setError('');
                                    }}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    mode="outlined"
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    style={[styles.input, dynamicStyles.input]}
                                    left={<TextInput.Icon icon="key" />}
                                    error={!!error}
                                />

                                {error ? (
                                    <Paragraph style={styles.error}>❌ {error}</Paragraph>
                                ) : null}

                                <Button
                                    mode="contained"
                                    onPress={handleActivate}
                                    loading={loading}
                                    disabled={loading || licenseKey.length < 8}
                                    style={styles.button}
                                    icon="check-circle"
                                >
                                    Активировать
                                </Button>

                                <Divider style={styles.divider} />

                                <Button
                                    mode="text"
                                    onPress={() => setShowManual(true)}
                                    icon="server"
                                    style={styles.linkButton}
                                    labelStyle={dynamicStyles.textSecondary}
                                >
                                    Ввести адрес сервера вручную
                                </Button>
                            </>
                        ) : (
                            <>
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
                                    <Paragraph style={styles.error}>❌ {error}</Paragraph>
                                ) : null}

                                <Paragraph style={[styles.hint, dynamicStyles.textSecondary]}>
                                    💡 IP адрес компьютера с SmartPOS Pro в вашей WiFi сети
                                </Paragraph>

                                <Button
                                    mode="contained"
                                    onPress={handleManualConnect}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.button}
                                    icon="connection"
                                >
                                    Подключиться
                                </Button>

                                <Button
                                    mode="text"
                                    onPress={() => { setShowManual(false); setError(''); }}
                                    icon="key"
                                    style={styles.linkButton}
                                    labelStyle={dynamicStyles.textSecondary}
                                >
                                    Ввести лицензионный ключ
                                </Button>
                            </>
                        )}
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
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
    title: { fontSize: 28, textAlign: 'center', fontWeight: 'bold' },
    subtitle: { textAlign: 'center', marginBottom: 20, fontSize: 16 },
    card: { marginBottom: 24, elevation: 4 },
    input: { marginBottom: 12 },
    button: { marginTop: 8, paddingVertical: 8 },
    divider: { marginVertical: 16 },
    linkButton: { marginTop: 4 },
    error: { color: '#ef4444', fontSize: 13, marginBottom: 8, textAlign: 'center' },
    hint: { fontSize: 11, marginBottom: 8 },
    version: { textAlign: 'center', fontSize: 12 },
});
