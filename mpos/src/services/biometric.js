import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_REQUIRED_KEY = 'biometric_required_for_sales';

/**
 * Сервис биометрической аутентификации
 * Поддерживает Face ID, Touch ID, отпечаток пальца
 * На вебе — биометрия недоступна
 */
class BiometricService {

    /**
     * Проверить доступность биометрии на устройстве
     */
    static async isAvailable() {
        if (Platform.OS === 'web') return false;

        try {
            const LocalAuthentication = require('expo-local-authentication');
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            return compatible && enrolled;
        } catch (error) {
            console.error('[Biometric] Check availability error:', error);
            return false;
        }
    }

    /**
     * Получить типы доступной биометрии
     */
    static async getAvailableTypes() {
        if (Platform.OS === 'web') return [];

        try {
            const LocalAuthentication = require('expo-local-authentication');
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            const typeNames = types.map(type => {
                switch (type) {
                    case LocalAuthentication.AuthenticationType.FINGERPRINT:
                        return 'fingerprint';
                    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
                        return 'face';
                    case LocalAuthentication.AuthenticationType.IRIS:
                        return 'iris';
                    default:
                        return 'unknown';
                }
            });
            return typeNames;
        } catch (error) {
            console.error('[Biometric] Get types error:', error);
            return [];
        }
    }

    /**
     * Получить название типа биометрии для отображения
     */
    static async getBiometricName() {
        if (Platform.OS === 'web') return 'Биометрия';
        const types = await this.getAvailableTypes();
        if (types.includes('face')) return 'Face ID';
        if (types.includes('fingerprint')) return 'Отпечаток пальца';
        if (types.includes('iris')) return 'Сканер радужки';
        return 'Биометрия';
    }

    /**
     * Выполнить биометрическую аутентификацию
     */
    static async authenticate(options = {}) {
        if (Platform.OS === 'web') {
            return { success: false, error: 'Биометрия недоступна в веб-версии' };
        }

        try {
            const LocalAuthentication = require('expo-local-authentication');
            const {
                promptMessage = 'Подтвердите вашу личность',
                cancelLabel = 'Отмена',
                fallbackLabel = 'Использовать PIN',
                disableDeviceFallback = false
            } = options;

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage,
                cancelLabel,
                fallbackLabel,
                disableDeviceFallback,
            });

            console.log('[Biometric] Auth result:', result);
            return result;
        } catch (error) {
            console.error('[Biometric] Auth error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Аутентификация для входа в приложение
     */
    static async authenticateForLogin() {
        const name = await this.getBiometricName();
        return this.authenticate({
            promptMessage: `Войдите с помощью ${name}`,
            fallbackLabel: 'Ввести PIN'
        });
    }

    /**
     * Аутентификация для подтверждения продажи
     */
    static async authenticateForSale(amount) {
        const formattedAmount = Math.round(amount).toLocaleString('ru-RU') + " so'm";
        return this.authenticate({
            promptMessage: `Подтвердите продажу на ${formattedAmount}`,
            cancelLabel: 'Отмена',
            disableDeviceFallback: false
        });
    }

    /**
     * Аутентификация для закрытия смены
     */
    static async authenticateForShiftClose() {
        return this.authenticate({
            promptMessage: 'Подтвердите закрытие смены',
            disableDeviceFallback: false
        });
    }

    // ============ Настройки ============

    /**
     * Проверить включена ли биометрия
     */
    static async isEnabled() {
        try {
            const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
            return value === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Включить/выключить биометрию
     */
    static async setEnabled(enabled) {
        try {
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
            return true;
        } catch (error) {
            console.error('[Biometric] Set enabled error:', error);
            return false;
        }
    }

    /**
     * Проверить требуется ли биометрия для продаж
     */
    static async isRequiredForSales() {
        try {
            const value = await AsyncStorage.getItem(BIOMETRIC_REQUIRED_KEY);
            return value === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Установить требование биометрии для продаж
     */
    static async setRequiredForSales(required) {
        try {
            await AsyncStorage.setItem(BIOMETRIC_REQUIRED_KEY, String(required));
            return true;
        } catch (error) {
            console.error('[Biometric] Set required error:', error);
            return false;
        }
    }

    /**
     * Получить все настройки биометрии
     */
    static async getSettings() {
        const [available, enabled, requiredForSales, types, name] = await Promise.all([
            this.isAvailable(),
            this.isEnabled(),
            this.isRequiredForSales(),
            this.getAvailableTypes(),
            this.getBiometricName()
        ]);

        return {
            available,
            enabled,
            requiredForSales,
            types,
            name
        };
    }
}

export default BiometricService;
