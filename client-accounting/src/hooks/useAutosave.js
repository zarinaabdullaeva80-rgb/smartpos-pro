import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook для автосохранения данных формы в localStorage
 * @param {string} key - Уникальный ключ для хранения
 * @param {object} data - Данные для сохранения
 * @param {number} delay - Задержка debounce в мс (по умолчанию 1000)
 * @returns {object} { hasSavedDraft, clearDraft, restoreDraft }
 */
export function useAutosave(key, data, delay = 1000) {
    const [hasSavedDraft, setHasSavedDraft] = useState(false);
    const [draftData, setDraftData] = useState(null);
    const timeoutRef = useRef(null);
    const initialLoadRef = useRef(true);

    // Загрузить черновик при первом рендере
    useEffect(() => {
        if (initialLoadRef.current) {
            initialLoadRef.current = false;
            try {
                const saved = localStorage.getItem(`draft_${key}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && Object.keys(parsed).length > 0) {
                        setDraftData(parsed);
                        setHasSavedDraft(true);
                    }
                }
            } catch (e) {
                console.warn('Failed to load draft:', e);
            }
        }
    }, [key]);

    // Автосохранение с debounce
    useEffect(() => {
        if (initialLoadRef.current) return;

        // Проверяем что есть данные для сохранения
        const hasData = data && Object.values(data).some(v => v !== '' && v !== null && v !== undefined);

        if (!hasData) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(`draft_${key}`, JSON.stringify(data));
                console.log(`[Autosave] Draft saved: ${key}`);
            } catch (e) {
                console.warn('Failed to save draft:', e);
            }
        }, delay);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [key, data, delay]);

    // Очистить черновик
    const clearDraft = useCallback(() => {
        localStorage.removeItem(`draft_${key}`);
        setHasSavedDraft(false);
        setDraftData(null);
        console.log(`[Autosave] Draft cleared: ${key}`);
    }, [key]);

    // Восстановить черновик
    const restoreDraft = useCallback(() => {
        setHasSavedDraft(false);
        return draftData;
    }, [draftData]);

    return { hasSavedDraft, draftData, clearDraft, restoreDraft };
}

/**
 * Hook для автозаполнения полей на основе истории ввода
 * @param {string} fieldKey - Ключ поля
 * @param {number} maxHistory - Максимальное количество записей в истории
 * @returns {object} { suggestions, addToHistory, clearHistory }
 */
export function useAutofill(fieldKey, maxHistory = 10) {
    const [suggestions, setSuggestions] = useState([]);

    useEffect(() => {
        try {
            const history = localStorage.getItem(`autofill_${fieldKey}`);
            if (history) {
                setSuggestions(JSON.parse(history));
            }
        } catch (e) {
            console.warn('Failed to load autofill history:', e);
        }
    }, [fieldKey]);

    const addToHistory = useCallback((value) => {
        if (!value || value.trim() === '') return;

        setSuggestions(prev => {
            const filtered = prev.filter(v => v !== value);
            const updated = [value, ...filtered].slice(0, maxHistory);
            localStorage.setItem(`autofill_${fieldKey}`, JSON.stringify(updated));
            return updated;
        });
    }, [fieldKey, maxHistory]);

    const clearHistory = useCallback(() => {
        localStorage.removeItem(`autofill_${fieldKey}`);
        setSuggestions([]);
    }, [fieldKey]);

    const getSuggestions = useCallback((query) => {
        if (!query) return suggestions.slice(0, 5);
        const lower = query.toLowerCase();
        return suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 5);
    }, [suggestions]);

    return { suggestions, getSuggestions, addToHistory, clearHistory };
}

export default { useAutosave, useAutofill };
