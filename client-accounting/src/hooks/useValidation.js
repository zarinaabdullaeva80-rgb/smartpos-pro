/**
 * useValidation - хук для валидации форм
 * Поддерживает: обязательные поля, email, телефон, ИНН, и др.
 */

import { useState, useCallback, useMemo } from 'react';

// Правила валидации
const validators = {
    required: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    },

    email: (value) => {
        if (!value) return true; // Пустое значение валидно (используйте required отдельно)
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(value);
    },

    phone: (value) => {
        if (!value) return true;
        const cleaned = value.replace(/[\s\-\(\)]/g, '');
        return /^\+998\d{9}$/.test(cleaned);
    },

    inn: (value) => {
        if (!value) return true;
        return /^\d{9}$/.test(value);
    },

    minLength: (min) => (value) => {
        if (!value) return true;
        return value.length >= min;
    },

    maxLength: (max) => (value) => {
        if (!value) return true;
        return value.length <= max;
    },

    min: (minValue) => (value) => {
        if (value === '' || value === null || value === undefined) return true;
        return Number(value) >= minValue;
    },

    max: (maxValue) => (value) => {
        if (value === '' || value === null || value === undefined) return true;
        return Number(value) <= maxValue;
    },

    pattern: (regex) => (value) => {
        if (!value) return true;
        return regex.test(value);
    },

    url: (value) => {
        if (!value) return true;
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },

    numeric: (value) => {
        if (!value) return true;
        return /^\d+$/.test(value);
    },

    decimal: (value) => {
        if (!value) return true;
        return /^\d+(\.\d{1,2})?$/.test(value);
    }
};

// Сообщения об ошибках
const errorMessages = {
    required: 'Это поле обязательно',
    email: 'Введите корректный email',
    phone: 'Введите телефон в формате +998XXXXXXXXX',
    inn: 'ИНН должен содержать 9 цифр',
    minLength: (min) => `Минимум ${min} символов`,
    maxLength: (max) => `Максимум ${max} символов`,
    min: (val) => `Минимальное значение: ${val}`,
    max: (val) => `Максимальное значение: ${val}`,
    pattern: 'Неверный формат',
    url: 'Введите корректный URL',
    numeric: 'Только цифры',
    decimal: 'Введите число (до 2 знаков после запятой)'
};

/**
 * useValidation - хук валидации
 * @param {Object} schema - схема валидации { fieldName: { required: true, email: true, ... } }
 * @returns {Object} - { errors, validate, validateField, isValid, reset }
 */
export function useValidation(schema) {
    const [errors, setErrors] = useState({});

    // Валидация одного поля
    const validateField = useCallback((fieldName, value) => {
        const rules = schema[fieldName];
        if (!rules) return null;

        for (const [rule, ruleValue] of Object.entries(rules)) {
            if (ruleValue === false) continue;

            let validator;
            let message;

            if (typeof validators[rule] === 'function') {
                if (['minLength', 'maxLength', 'min', 'max', 'pattern'].includes(rule)) {
                    validator = validators[rule](ruleValue);
                    message = typeof errorMessages[rule] === 'function'
                        ? errorMessages[rule](ruleValue)
                        : errorMessages[rule];
                } else {
                    validator = validators[rule];
                    message = errorMessages[rule];
                }

                if (!validator(value)) {
                    return message;
                }
            }
        }

        return null;
    }, [schema]);

    // Валидация всей формы
    const validate = useCallback((data) => {
        const newErrors = {};
        let isValid = true;

        for (const fieldName of Object.keys(schema)) {
            const error = validateField(fieldName, data[fieldName]);
            if (error) {
                newErrors[fieldName] = error;
                isValid = false;
            }
        }

        setErrors(newErrors);
        return isValid;
    }, [schema, validateField]);

    // Проверка валидности
    const isValid = useMemo(() => {
        return Object.keys(errors).length === 0;
    }, [errors]);

    // Сброс ошибок
    const reset = useCallback(() => {
        setErrors({});
    }, []);

    // Установка ошибки вручную
    const setFieldError = useCallback((fieldName, message) => {
        setErrors(prev => ({ ...prev, [fieldName]: message }));
    }, []);

    // Очистка ошибки поля
    const clearFieldError = useCallback((fieldName) => {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[fieldName];
            return newErrors;
        });
    }, []);

    return {
        errors,
        validate,
        validateField,
        isValid,
        reset,
        setFieldError,
        clearFieldError
    };
}

// Хелпер для отображения ошибок в форме
export function FormError({ error }) {
    if (!error) return null;

    return (
        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {error}
        </span>
    );
}

export default useValidation;
