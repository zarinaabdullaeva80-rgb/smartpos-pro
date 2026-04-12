// Excel Export Utility
import * as XLSX from 'xlsx';

export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Auto-size columns
        const maxWidth = data.reduce((w, r) => Math.max(w, ...Object.keys(r).map(k => k.length)), 10);
        worksheet['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: maxWidth }));

        XLSX.writeFile(workbook, `${filename}.xlsx`);
        return true;
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        return false;
    }
};

// Keyboard Shortcuts Handler
export const useKeyboardShortcuts = (shortcuts) => {
    React.useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key.toLowerCase();
            const ctrl = event.ctrlKey || event.metaKey;
            const alt = event.altKey;
            const shift = event.shiftKey;

            const combo = `${ctrl ? 'ctrl+' : ''}${alt ? 'alt+' : ''}${shift ? 'shift+' : ''}${key}`;

            if (shortcuts[combo]) {
                event.preventDefault();
                shortcuts[combo]();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
};

// Data Caching
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedData = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
};

export const setCachedData = (key, data) => {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
};

export const clearCache = (key) => {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
};

// Debounce for search inputs
export const useDebounce = (value, delay = 500) => {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
};

// Format helpers
export const formatters = {
    currency: (value) => new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'UZS'
    }).format(value || 0),

    date: (value) => new Date(value).toLocaleDateString('ru-RU'),

    dateTime: (value) => new Date(value).toLocaleString('ru-RU'),

    number: (value, decimals = 2) => Number(value || 0).toFixed(decimals),

    percent: (value) => `${(value * 100).toFixed(2)}%`
};
