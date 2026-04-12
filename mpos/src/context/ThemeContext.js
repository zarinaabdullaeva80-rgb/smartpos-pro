import React, { createContext, useContext, useState, useEffect } from 'react';
import SettingsService, { THEMES } from '../services/settings';

// Цветовые схемы
export const COLORS = {
    dark: {
        background: '#0f172a',
        surface: '#1e293b',
        surfaceVariant: '#334155',
        primary: '#3b82f6',
        secondary: '#10b981',
        text: '#f1f5f9',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        border: '#334155',
        card: '#1e293b',
        input: '#0f172a',
    },
    light: {
        background: '#f8fafc',
        surface: '#ffffff',
        surfaceVariant: '#f1f5f9',
        primary: '#2563eb',
        secondary: '#059669',
        text: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#94a3b8',
        error: '#dc2626',
        warning: '#d97706',
        success: '#059669',
        border: '#e2e8f0',
        card: '#ffffff',
        input: '#f1f5f9',
    },
};

// Контекст темы
const ThemeContext = createContext({
    theme: THEMES.DARK,
    colors: COLORS.dark,
    isDark: true,
    setTheme: () => { },
});

// Провайдер темы
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(THEMES.DARK);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        const saved = await SettingsService.getTheme();
        setTheme(saved);
    };

    const changeTheme = async (newTheme) => {
        setTheme(newTheme);
        await SettingsService.setTheme(newTheme);
    };

    const value = {
        theme,
        colors: theme === THEMES.DARK ? COLORS.dark : COLORS.light,
        isDark: theme === THEMES.DARK,
        setTheme: changeTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

// Хук для использования темы
export function useTheme() {
    return useContext(ThemeContext);
}

// Функция для создания стилей с учётом темы
export function createThemedStyles(colors) {
    return {
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        card: {
            backgroundColor: colors.card,
            borderColor: colors.border,
        },
        text: {
            color: colors.text,
        },
        textSecondary: {
            color: colors.textSecondary,
        },
        input: {
            backgroundColor: colors.input,
        },
        surface: {
            backgroundColor: colors.surface,
        },
    };
}

export default ThemeContext;
