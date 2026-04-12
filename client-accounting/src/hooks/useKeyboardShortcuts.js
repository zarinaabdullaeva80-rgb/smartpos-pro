import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * useKeyboardShortcuts - глобальные горячие клавиши
 * 
 * Навигация:
 * - Ctrl+H: Главная
 * - Ctrl+P: Товары
 * - Ctrl+S: Продажи
 * - Ctrl+R: Отчёты
 * - Ctrl+K: Клиенты
 * - Ctrl+W: Склад
 * 
 * Действия:
 * - F1: Помощь / Новая продажа
 * - F2: Поиск
 * - F12: Быстрый чек
 * - Ctrl+N: Новый элемент
 * - Ctrl+B: Бэкапы
 * - Ctrl+,: Настройки
 * - Escape: Закрыть модальное окно
 */

export function useKeyboardShortcuts(options = {}) {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        onSearch,
        onNewItem,
        onQuickSale,
        onHelp,
        onEscape,
        enabled = true
    } = options;

    const handleKeyDown = useCallback((e) => {
        // Игнорируем если фокус в input/textarea
        const target = e.target;
        const isInputFocused = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        // Разрешаем Escape даже в input
        if (e.key === 'Escape') {
            if (onEscape) {
                onEscape();
                return;
            }
        }

        // В input игнорируем остальные (кроме F-клавиш)
        if (isInputFocused && !e.key.startsWith('F')) {
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        // Ctrl + клавиши
        if (ctrl && !shift) {
            switch (key) {
                case 'h':
                    e.preventDefault();
                    navigate('/');
                    break;
                case 'p':
                    e.preventDefault();
                    navigate('/products');
                    break;
                case 's':
                    e.preventDefault();
                    navigate('/sales');
                    break;
                case 'r':
                    e.preventDefault();
                    navigate('/reports');
                    break;
                case 'k':
                    e.preventDefault();
                    navigate('/crm/customers');
                    break;
                case 'w':
                    e.preventDefault();
                    navigate('/warehouse');
                    break;
                case 'f':
                    e.preventDefault();
                    if (onSearch) onSearch();
                    break;
                case 'n':
                    e.preventDefault();
                    if (onNewItem) onNewItem();
                    break;
                case 'b':
                    e.preventDefault();
                    navigate('/settings/backups');
                    break;
                case ',':
                    e.preventDefault();
                    navigate('/settings');
                    break;
                case '/':
                case '?':
                    e.preventDefault();
                    navigate('/settings/keyboard');
                    break;
                default:
                    break;
            }
        }

        // F-клавиши
        switch (e.key) {
            case 'F1':
                e.preventDefault();
                if (onHelp) onHelp();
                else navigate('/settings/keyboard');
                break;
            case 'F2':
                e.preventDefault();
                if (onSearch) onSearch();
                break;
            case 'F12':
                e.preventDefault();
                if (onQuickSale) onQuickSale();
                break;
            default:
                break;
        }
    }, [navigate, onSearch, onNewItem, onQuickSale, onHelp, onEscape]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown, enabled]);

    return null;
}

export default useKeyboardShortcuts;
