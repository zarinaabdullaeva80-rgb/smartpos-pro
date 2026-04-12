/**
 * useLocalStorage - хук для работы с localStorage
 * С автоматической сериализацией и fallback значениями
 */

import { useState, useCallback, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
    // Получение начального значения
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Сохранение значения
    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Удаление значения
    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    // Синхронизация между вкладками
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(JSON.parse(e.newValue));
                } catch {
                    setStoredValue(e.newValue);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key]);

    return [storedValue, setValue, removeValue];
}

/**
 * useSessionStorage - аналог для sessionStorage
 */
export function useSessionStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = sessionStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            sessionStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.warn(`Error setting sessionStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

export default useLocalStorage;
