import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ru from './ru';
import uz from './uz';

const translations = { ru, uz };

const I18nContext = createContext();

/**
 * Получить вложенное значение по ключу "nav.dashboard"
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, key) => o?.[key], obj);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('smartpos_lang') || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('smartpos_lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = useCallback((key, fallback) => {
    const value = getNestedValue(translations[lang], key);
    if (value !== undefined) return value;
    // Fallback to Russian
    const ruValue = getNestedValue(translations.ru, key);
    if (ruValue !== undefined) return ruValue;
    return fallback || key;
  }, [lang]);

  const switchLanguage = useCallback((newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
    }
  }, []);

  const value = {
    lang,
    t,
    switchLanguage,
    languages: [
      { code: 'ru', name: 'Русский', flag: '🇷🇺' },
      { code: 'uz', name: 'O\'zbek', flag: '🇺🇿' },
    ],
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Хук для использования переводов
 * const { t, lang, switchLanguage, languages } = useI18n();
 * t('nav.dashboard') → "Панель управления" или "Boshqaruv paneli"
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      lang: 'ru',
      t: (key) => getNestedValue(translations.ru, key) || key,
      switchLanguage: () => {},
      languages: [],
    };
  }
  return context;
}

export default I18nContext;
