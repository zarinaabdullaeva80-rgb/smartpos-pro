import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations from './translations';

const I18nContext = createContext();

const LANG_KEY = 'smartpos_lang';

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('ru');
  const [loaded, setLoaded] = useState(false);

  // Загрузить сохранённый язык
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved && translations[saved]) {
        setLang(saved);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const t = useCallback((key) => {
    return translations[lang]?.[key] || translations.ru?.[key] || key;
  }, [lang]);

  const switchLanguage = useCallback(async (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      await AsyncStorage.setItem(LANG_KEY, newLang);
    }
  }, []);

  const value = {
    lang,
    t,
    switchLanguage,
    loaded,
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

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      lang: 'ru',
      t: (key) => translations.ru?.[key] || key,
      switchLanguage: () => {},
      loaded: true,
      languages: [],
    };
  }
  return context;
}

export default I18nContext;
