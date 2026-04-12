/**
 * Утилиты для Mobile POS
 */

// Валидация телефона UZ
export function validatePhone(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
}

// Валидация email
export function validateEmail(email) {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Форматирование валюты UZS
export function formatCurrency(value, currency = 'сум') {
    if (value === null || value === undefined) return '0 ' + currency;
    return new Intl.NumberFormat('ru-RU').format(value) + ' ' + currency;
}

// Форматирование даты
export function formatDate(date, options = {}) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options
    });
}

// Форматирование времени
export function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Генерация ID
export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Debounce
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Truncate text
export function truncate(text, length = 50) {
    if (!text || text.length <= length) return text;
    return text.slice(0, length) + '...';
}

// Безопасный JSON parse
export function safeJsonParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

export default {
    validatePhone,
    validateEmail,
    formatCurrency,
    formatDate,
    formatTime,
    generateId,
    debounce,
    truncate,
    safeJsonParse
};
