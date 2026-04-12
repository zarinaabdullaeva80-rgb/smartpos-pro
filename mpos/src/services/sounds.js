import { Platform } from 'react-native';

/**
 * Менеджер звуков и вибрации для POS-приложения
 * Использует Expo Haptics для надёжной вибрации (только native)
 * На вебе — no-op
 */
class SoundManager {
    static enabled = true;

    /**
     * Включить/выключить звуки
     */
    static setEnabled(value) {
        this.enabled = value;
        console.log('[Sound] Enabled:', value);
    }

    /**
     * Тактильная обратная связь через Expo Haptics
     */
    static async haptic(type = 'medium') {
        if (!this.enabled) return;

        // На вебе вибрация не поддерживается
        if (Platform.OS === 'web') {
            // Попробовать navigator.vibrate (поддерживается не на iOS Safari)
            try {
                if (navigator.vibrate) {
                    navigator.vibrate(type === 'heavy' || type === 'error' ? 100 : 30);
                }
            } catch (e) {}
            return;
        }

        try {
            const Haptics = require('expo-haptics');
            switch (type) {
                case 'light':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'medium':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'heavy':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
                case 'success':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                case 'error':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    break;
                case 'warning':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    break;
                default:
                    await Haptics.selectionAsync();
            }
        } catch (error) {
            console.log('[Sound] Haptic not available');
        }
    }

    /**
     * Звук добавления в корзину
     */
    static playAddToCart() {
        this.haptic('light');
    }

    /**
     * Звук успеха
     */
    static playSuccess() {
        this.haptic('success');
    }

    /**
     * Звук ошибки
     */
    static playError() {
        this.haptic('error');
    }

    /**
     * Звук сканирования
     */
    static playScan() {
        this.haptic('medium');
    }

    /**
     * Звук уведомления
     */
    static playNotification() {
        this.haptic('warning');
    }

    /**
     * Звук кнопки
     */
    static playTap() {
        this.haptic('light');
    }
}

export default SoundManager;
