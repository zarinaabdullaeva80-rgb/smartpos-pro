import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Сервис push-уведомлений (упрощённая версия)
 */
class PushNotificationService {
    static initialized = false;

    /**
     * Инициализация уведомлений
     */
    static async init() {
        if (this.initialized) return;

        try {
            // Настройка поведения уведомлений
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                }),
            });

            // Настройки для Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                });
            }

            this.initialized = true;
            console.log('[Push] Initialized');
            return true;
        } catch (error) {
            console.error('[Push] Init error:', error);
            return false;
        }
    }

    /**
     * Отправить локальное уведомление
     */
    static async sendLocalNotification(title, body, data = {}) {
        try {
            if (!this.initialized) await this.init();

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                },
                trigger: null, // Немедленно
            });
            console.log('[Push] Notification sent:', title);
            return true;
        } catch (error) {
            console.error('[Push] Send error:', error);
            return false;
        }
    }

    /**
     * Уведомление о низких остатках
     */
    static async notifyLowStock(productName, quantity) {
        await this.sendLocalNotification(
            '⚠️ Низкие остатки',
            `${productName}: осталось ${quantity} шт.`,
            { type: 'low_stock', productName }
        );
    }

    /**
     * Напоминание о закрытии смены
     */
    static async notifyShiftReminder() {
        await this.sendLocalNotification(
            '⏰ Напоминание',
            'Не забудьте закрыть смену и сделать Z-отчёт',
            { type: 'shift_reminder' }
        );
    }

    /**
     * Уведомление об успешной синхронизации
     */
    static async notifySyncComplete(count) {
        await this.sendLocalNotification(
            '✅ Синхронизация завершена',
            `Обновлено ${count} товаров`,
            { type: 'sync_complete' }
        );
    }
}

export default PushNotificationService;
