import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './api';

const CURRENT_CASHIER_KEY = 'current_cashier';
const CASHIERS_LIST_KEY = 'cashiers_list';
const PIN_CODES_KEY = 'cashier_pins';

/**
 * Сервис управления кассирами (мульти-касса)
 * Позволяет переключаться между несколькими кассирами без выхода
 */
class CashierService {

    static currentCashier = null;
    static cashiers = [];

    /**
     * Инициализация сервиса
     */
    static async init() {
        try {
            const cashiersJson = await AsyncStorage.getItem(CASHIERS_LIST_KEY);
            const currentJson = await AsyncStorage.getItem(CURRENT_CASHIER_KEY);

            if (cashiersJson) {
                this.cashiers = JSON.parse(cashiersJson);
            }
            if (currentJson) {
                this.currentCashier = JSON.parse(currentJson);
            }

            console.log('[CashierService] Initialized with', this.cashiers.length, 'cashiers');
            return true;
        } catch (error) {
            console.error('[CashierService] Init error:', error);
            return false;
        }
    }

    /**
     * Получить текущего кассира
     */
    static async getCurrentCashier() {
        if (!this.currentCashier) {
            const json = await AsyncStorage.getItem(CURRENT_CASHIER_KEY);
            if (json) this.currentCashier = JSON.parse(json);
        }
        return this.currentCashier;
    }

    /**
     * Установить текущего кассира
     */
    static async setCurrentCashier(cashier) {
        this.currentCashier = cashier;
        await AsyncStorage.setItem(CURRENT_CASHIER_KEY, JSON.stringify(cashier));
        return cashier;
    }

    /**
     * Получить список кассиров
     */
    static async getCashiers() {
        if (this.cashiers.length === 0) {
            const json = await AsyncStorage.getItem(CASHIERS_LIST_KEY);
            if (json) this.cashiers = JSON.parse(json);
        }
        return this.cashiers;
    }

    /**
     * Добавить кассира
     */
    static async addCashier(cashier, pin) {
        // Добавить в локальный список
        const newCashier = {
            id: cashier.id || Date.now(),
            name: cashier.name,
            username: cashier.username,
            role: cashier.role || 'cashier',
            addedAt: new Date().toISOString()
        };

        this.cashiers.push(newCashier);
        await AsyncStorage.setItem(CASHIERS_LIST_KEY, JSON.stringify(this.cashiers));

        // Сохранить PIN если указан
        if (pin) {
            await this.setPin(newCashier.id, pin);
        }

        console.log('[CashierService] Added cashier:', newCashier.name);
        return newCashier;
    }

    /**
     * Удалить кассира из списка
     */
    static async removeCashier(cashierId) {
        this.cashiers = this.cashiers.filter(c => c.id !== cashierId);
        await AsyncStorage.setItem(CASHIERS_LIST_KEY, JSON.stringify(this.cashiers));

        // Если удалён текущий - очистить
        if (this.currentCashier?.id === cashierId) {
            this.currentCashier = null;
            await AsyncStorage.removeItem(CURRENT_CASHIER_KEY);
        }

        return true;
    }

    // ============ PIN-коды ============

    /**
     * Установить PIN для кассира
     */
    static async setPin(cashierId, pin) {
        try {
            const pinsJson = await AsyncStorage.getItem(PIN_CODES_KEY);
            const pins = pinsJson ? JSON.parse(pinsJson) : {};
            pins[String(cashierId)] = pin;
            await AsyncStorage.setItem(PIN_CODES_KEY, JSON.stringify(pins));
            return true;
        } catch (error) {
            console.error('[CashierService] Set PIN error:', error);
            return false;
        }
    }

    /**
     * Проверить PIN кассира
     */
    static async verifyPin(cashierId, pin) {
        try {
            const pinsJson = await AsyncStorage.getItem(PIN_CODES_KEY);
            const pins = pinsJson ? JSON.parse(pinsJson) : {};
            return pins[String(cashierId)] === pin;
        } catch (error) {
            return false;
        }
    }

    /**
     * Переключиться на другого кассира с проверкой PIN
     */
    static async switchCashier(cashierId, pin) {
        const cashier = this.cashiers.find(c => c.id === cashierId);
        if (!cashier) {
            throw new Error('Кассир не найден');
        }

        // Проверить PIN
        const pinValid = await this.verifyPin(cashierId, pin);
        if (!pinValid) {
            throw new Error('Неверный PIN-код');
        }

        await this.setCurrentCashier(cashier);
        console.log('[CashierService] Switched to:', cashier.name);
        return cashier;
    }

    /**
     * Быстрое переключение (для биометрии)
     */
    static async quickSwitch(cashierId) {
        const cashier = this.cashiers.find(c => c.id === cashierId);
        if (!cashier) {
            throw new Error('Кассир не найден');
        }

        await this.setCurrentCashier(cashier);
        return cashier;
    }

    /**
     * Выход текущего кассира
     */
    static async logout() {
        this.currentCashier = null;
        await AsyncStorage.removeItem(CURRENT_CASHIER_KEY);
        return true;
    }

    /**
     * Очистить все данные
     */
    static async clearAll() {
        this.cashiers = [];
        this.currentCashier = null;
        await AsyncStorage.multiRemove([CASHIERS_LIST_KEY, CURRENT_CASHIER_KEY, PIN_CODES_KEY]);
    }

    /**
     * Синхронизировать с сервером (получить список доступных пользователей)
     */
    static async syncWithServer() {
        try {
            const response = await authAPI.getUsers();
            const users = response.data.users || [];

            // Фильтровать только кассиров
            const cashiers = users.filter(u =>
                u.role === 'cashier' || u.role === 'manager' || u.role === 'admin'
            );

            return cashiers;
        } catch (error) {
            console.error('[CashierService] Sync error:', error);
            return [];
        }
    }
}

export default CashierService;
