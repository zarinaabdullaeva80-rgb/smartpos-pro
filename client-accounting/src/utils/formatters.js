// Форматирование валюты для узбекских сумов (UZS)
export const formatCurrency = (value, options = {}) => {
    const {
        showSymbol = true,
        minimumFractionDigits = 0,
        maximumFractionDigits = 0
    } = options;

    const formatted = new Intl.NumberFormat('uz-UZ', {
        minimumFractionDigits,
        maximumFractionDigits
    }).format(value || 0);

    return showSymbol ? `${formatted} сум` : formatted;
};

// Форматирование числа без валюты
export const formatNumber = (value, decimals = 0) => {
    return new Intl.NumberFormat('uz-UZ', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value || 0);
};

// Парсинг строки валюты в число
export const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    // Удаляем все нечисловые символы кроме точки и запятой
    const cleaned = String(value).replace(/[^\d.,]/g, '');
    // Заменяем запятую на точку
    const normalized = cleaned.replace(',', '.');

    return parseFloat(normalized) || 0;
};

// Форматирование процентов
export const formatPercent = (value, decimals = 1) => {
    return `${formatNumber(value, decimals)}%`;
};

// Форматирование даты
export const formatDate = (date, format = 'short') => {
    if (!date) return '—';

    const d = new Date(date);

    if (format === 'short') {
        return d.toLocaleDateString('ru-RU');
    } else if (format === 'long') {
        return d.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else if (format === 'datetime') {
        return d.toLocaleString('ru-RU');
    }

    return d.toLocaleDateString('ru-RU');
};
