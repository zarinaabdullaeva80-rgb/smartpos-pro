import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Switch, List, Button, TextInput, RadioButton, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import SettingsService, { THEMES } from '../services/settings';
import SoundManager from '../services/sounds';
import BiometricService from '../services/biometric';
import { APP_VERSION, getLicenseData, getLicenseKey } from '../config/settings';
import LicenseTimer from '../components/LicenseTimer';

export default function SettingsScreen({ navigation, onThemeChange }) {
    const { theme, colors, setTheme } = useTheme();
    const { t, lang, switchLanguage, languages } = useI18n();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [autoSync, setAutoSync] = useState(true);
    const [printerIP, setPrinterIP] = useState('');
    const [printerType, setPrinterType] = useState('bluetooth');

    // Биометрия
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricForSales, setBiometricForSales] = useState(false);
    const [biometricName, setBiometricName] = useState('Биометрия');

    useEffect(() => { loadSettings(); loadBiometricSettings(); }, []);

    const loadSettings = async () => {
        const settings = await SettingsService.getAll();
        setSoundEnabled(settings.soundEnabled);
        setAutoSync(settings.autoSync);
        setPrinterIP(settings.printer.ip);
        setPrinterType(settings.printer.type);
    };

    const loadBiometricSettings = async () => {
        const bioSettings = await BiometricService.getSettings();
        setBiometricAvailable(bioSettings.available);
        setBiometricEnabled(bioSettings.enabled);
        setBiometricForSales(bioSettings.requiredForSales);
        setBiometricName(bioSettings.name);
    };

    const handleThemeChange = async (newTheme) => {
        setTheme(newTheme);
        if (onThemeChange) onThemeChange(newTheme);
    };

    const handleSoundChange = async (value) => {
        setSoundEnabled(value);
        await SettingsService.setSoundEnabled(value);
        SoundManager.setEnabled(value);
        if (value) SoundManager.playSuccess();
    };

    const handleAutoSyncChange = async (value) => {
        setAutoSync(value);
        await SettingsService.setAutoSyncEnabled(value);
    };

    const handleBiometricChange = async (value) => {
        if (value) {
            // Проверить биометрию перед включением
            const result = await BiometricService.authenticate({
                promptMessage: `Подтвердите включение ${biometricName}`
            });
            if (!result.success) {
                Alert.alert('Отменено', 'Биометрия не включена');
                return;
            }
        }
        setBiometricEnabled(value);
        await BiometricService.setEnabled(value);
        SoundManager.playSuccess();
    };

    const handleBiometricForSalesChange = async (value) => {
        setBiometricForSales(value);
        await BiometricService.setRequiredForSales(value);
    };

    const savePrinterSettings = async () => {
        await SettingsService.setPrinterSettings(printerIP, printerType);
        SoundManager.playSuccess();
        Alert.alert('Сохранено', 'Настройки принтера сохранены');
    };

    const testVibration = () => {
        SoundManager.playSuccess();
    };

    const testBiometric = async () => {
        const result = await BiometricService.authenticate({
            promptMessage: `Тест ${biometricName}`
        });
        if (result.success) {
            SoundManager.playSuccess();
            Alert.alert('✅ Успешно', `${biometricName} работает!`);
        } else {
            Alert.alert('❌ Ошибка', result.error || 'Аутентификация не пройдена');
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
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            {/* Внешний вид */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🎨 Внешний вид</Title>

                    <List.Item
                        title="Тёмная тема"
                        titleStyle={dynamicStyles.text}
                        left={() => <List.Icon icon="weather-night" color={colors.primary} />}
                        right={() => <RadioButton value="dark" status={theme === THEMES.DARK ? 'checked' : 'unchecked'} onPress={() => handleThemeChange(THEMES.DARK)} />}
                        onPress={() => handleThemeChange(THEMES.DARK)}
                    />

                    <List.Item
                        title="Светлая тема"
                        titleStyle={dynamicStyles.text}
                        left={() => <List.Icon icon="weather-sunny" color={colors.warning} />}
                        right={() => <RadioButton value="light" status={theme === THEMES.LIGHT ? 'checked' : 'unchecked'} onPress={() => handleThemeChange(THEMES.LIGHT)} />}
                        onPress={() => handleThemeChange(THEMES.LIGHT)}
                    />
                </Card.Content>
            </Card>

            {/* Язык / Til */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🌐 {t('language')}</Title>

                    {languages.map(l => (
                        <List.Item
                            key={l.code}
                            title={`${l.flag} ${l.name}`}
                            titleStyle={dynamicStyles.text}
                            left={() => <List.Icon icon="translate" color={lang === l.code ? colors.primary : colors.textSecondary} />}
                            right={() => <RadioButton value={l.code} status={lang === l.code ? 'checked' : 'unchecked'} onPress={() => switchLanguage(l.code)} />}
                            onPress={() => switchLanguage(l.code)}
                        />
                    ))}
                </Card.Content>
            </Card>

            {/* Биометрия */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🔐 Безопасность</Title>

                    {biometricAvailable ? (
                        <>
                            <List.Item
                                title={`Использовать ${biometricName}`}
                                description="Для входа в приложение"
                                titleStyle={dynamicStyles.text}
                                descriptionStyle={dynamicStyles.textSecondary}
                                left={() => <List.Icon icon="fingerprint" color={colors.success} />}
                                right={() => <Switch value={biometricEnabled} onValueChange={handleBiometricChange} />}
                            />

                            {biometricEnabled && (
                                <List.Item
                                    title="Подтверждение продаж"
                                    description={`Требовать ${biometricName} для каждой продажи`}
                                    titleStyle={dynamicStyles.text}
                                    descriptionStyle={dynamicStyles.textSecondary}
                                    left={() => <List.Icon icon="shield-check" color={colors.primary} />}
                                    right={() => <Switch value={biometricForSales} onValueChange={handleBiometricForSalesChange} />}
                                />
                            )}

                            <Button mode="outlined" onPress={testBiometric} style={styles.testButton} icon="fingerprint">
                                Тест {biometricName}
                            </Button>
                        </>
                    ) : (
                        <Paragraph style={dynamicStyles.textSecondary}>
                            ❌ {biometricName} недоступна на этом устройстве
                        </Paragraph>
                    )}
                </Card.Content>
            </Card>

            {/* Звуки */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🔔 Звуки и вибрация</Title>

                    <List.Item
                        title="Вибрация"
                        titleStyle={dynamicStyles.text}
                        left={() => <List.Icon icon="vibrate" color={colors.secondary} />}
                        right={() => <Switch value={soundEnabled} onValueChange={handleSoundChange} />}
                    />

                    <Button mode="outlined" onPress={testVibration} style={styles.testButton} icon="vibrate">
                        Тест вибрации
                    </Button>
                </Card.Content>
            </Card>

            {/* Синхронизация */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🔄 Синхронизация</Title>

                    <List.Item
                        title="Авто-синхронизация"
                        titleStyle={dynamicStyles.text}
                        description="При подключении к сети"
                        descriptionStyle={dynamicStyles.textSecondary}
                        left={() => <List.Icon icon="sync-circle" color={colors.primary} />}
                        right={() => <Switch value={autoSync} onValueChange={handleAutoSyncChange} />}
                    />
                </Card.Content>
            </Card>

            {/* Принтер */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>🖨️ Принтер чеков</Title>

                    <Paragraph style={[styles.label, dynamicStyles.textSecondary]}>Тип подключения:</Paragraph>
                    <View style={styles.radioGroup}>
                        <View style={styles.radioItem}>
                            <RadioButton value="bluetooth" status={printerType === 'bluetooth' ? 'checked' : 'unchecked'} onPress={() => setPrinterType('bluetooth')} />
                            <Text style={dynamicStyles.text}>Bluetooth</Text>
                        </View>
                        <View style={styles.radioItem}>
                            <RadioButton value="wifi" status={printerType === 'wifi' ? 'checked' : 'unchecked'} onPress={() => setPrinterType('wifi')} />
                            <Text style={dynamicStyles.text}>WiFi</Text>
                        </View>
                    </View>

                    <TextInput
                        label={printerType === 'wifi' ? 'IP адрес' : 'MAC адрес'}
                        value={printerIP}
                        onChangeText={setPrinterIP}
                        placeholder={printerType === 'wifi' ? '192.168.1.100' : '00:11:22:33:44:55'}
                        style={[styles.input, dynamicStyles.input]}
                        mode="outlined"
                    />

                    <Button mode="contained" onPress={savePrinterSettings} style={styles.button}>
                        Сохранить
                    </Button>
                </Card.Content>
            </Card>

            {/* Лицензия */}
            {getLicenseKey() && (
                <Card style={[styles.card, dynamicStyles.card]}>
                    <Card.Content>
                        <Title style={dynamicStyles.text}>📋 Лицензия</Title>
                        {getLicenseData()?.company_name && (
                            <Paragraph style={dynamicStyles.text}>
                                🏢 {getLicenseData().company_name}
                            </Paragraph>
                        )}
                        <Paragraph style={[dynamicStyles.textSecondary, { fontSize: 12, fontFamily: 'monospace' }]}>
                            🔑 {getLicenseKey()}
                        </Paragraph>
                        {getLicenseData()?.license_type && (
                            <Paragraph style={dynamicStyles.textSecondary}>
                                Тип: {getLicenseData().license_type}
                            </Paragraph>
                        )}
                        {getLicenseData()?.expires_at && (
                            <View style={{ marginTop: 12 }}>
                                <Paragraph style={[dynamicStyles.textSecondary, { marginBottom: 6 }]}>
                                    Срок действия:
                                </Paragraph>
                                <LicenseTimer expiryDate={getLicenseData().expires_at} />
                            </View>
                        )}
                    </Card.Content>
                </Card>
            )}

            {/* О приложении */}
            <Card style={[styles.card, dynamicStyles.card]}>
                <Card.Content>
                    <Title style={dynamicStyles.text}>ℹ️ О приложении</Title>
                    <Paragraph style={dynamicStyles.text}>SmartPOS Pro</Paragraph>
                    <Paragraph style={dynamicStyles.textSecondary}>Версия {APP_VERSION}</Paragraph>
                </Card.Content>
            </Card>

            <View style={styles.spacer} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { margin: 16, marginBottom: 0 },
    label: { marginTop: 8, marginBottom: 8 },
    radioGroup: { flexDirection: 'row', marginBottom: 16 },
    radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
    input: { marginBottom: 16 },
    button: { marginTop: 8 },
    testButton: { marginTop: 8 },
    spacer: { height: 32 },
});
