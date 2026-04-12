import AsyncStorage from '@react-native-async-storage/async-storage';

// Ключи для хранения настроек
const KEYS = {
    THEME: 'app_theme',
    PRINTER_IP: 'printer_ip',
    PRINTER_TYPE: 'printer_type',
    SOUND_ENABLED: 'sound_enabled',
    AUTO_SYNC: 'auto_sync',
    LANGUAGE: 'language',
};

// Темы
export const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
};

// Цветовые схемы
export const THEME_COLORS = {
    dark: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#3b82f6',
        secondary: '#10b981',
        text: '#f1f5f9',
        textSecondary: '#94a3b8',
        error: '#ef4444',
        warning: '#f59e0b',
    },
    light: {
        background: '#f8fafc',
        surface: '#ffffff',
        primary: '#2563eb',
        secondary: '#059669',
        text: '#1e293b',
        textSecondary: '#64748b',
        error: '#dc2626',
        warning: '#d97706',
    },
};

class SettingsService {
    static async get(key, defaultValue = null) {
        try {
            const value = await AsyncStorage.getItem(key);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    static async set(key, value) {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('[Settings] Error saving:', e);
        }
    }

    // Тема
    static async getTheme() {
        return await this.get(KEYS.THEME, THEMES.DARK);
    }

    static async setTheme(theme) {
        await this.set(KEYS.THEME, theme);
    }

    // Принтер
    static async getPrinterSettings() {
        return {
            ip: await this.get(KEYS.PRINTER_IP, ''),
            type: await this.get(KEYS.PRINTER_TYPE, 'bluetooth'), // 'bluetooth' | 'wifi'
        };
    }

    static async setPrinterSettings(ip, type) {
        await this.set(KEYS.PRINTER_IP, ip);
        await this.set(KEYS.PRINTER_TYPE, type);
    }

    // Звуки
    static async isSoundEnabled() {
        return await this.get(KEYS.SOUND_ENABLED, true);
    }

    static async setSoundEnabled(enabled) {
        await this.set(KEYS.SOUND_ENABLED, enabled);
    }

    // Авто-синхронизация
    static async isAutoSyncEnabled() {
        return await this.get(KEYS.AUTO_SYNC, true);
    }

    static async setAutoSyncEnabled(enabled) {
        await this.set(KEYS.AUTO_SYNC, enabled);
    }

    // Язык
    static async getLanguage() {
        return await this.get(KEYS.LANGUAGE, 'ru');
    }

    static async setLanguage(lang) {
        await this.set(KEYS.LANGUAGE, lang);
    }

    // Получить все настройки
    static async getAll() {
        return {
            theme: await this.getTheme(),
            printer: await this.getPrinterSettings(),
            soundEnabled: await this.isSoundEnabled(),
            autoSync: await this.isAutoSyncEnabled(),
            language: await this.getLanguage(),
        };
    }
}

export default SettingsService;
