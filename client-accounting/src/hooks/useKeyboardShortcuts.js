import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts hook for SmartPOS Pro
 *
 * Navigation (F-keys):
 *   F1        — Dashboard
 *   F2        — Sales (Касса)
 *   F3        — Products (Товары)
 *   F4        — Warehouse (Склад)
 *   F5        — Refresh (shortcut event)
 *   F6        — Reports (Отчёты)
 *   F7        — Finance (Финансы)
 *   F8        — CRM / Клиенты
 *   F9        — Settings (Настройки)
 *   F10       — Employees (Сотрудники)
 *   F11       — Purchases (Закупки)
 *   F12       — Shifts (Смены)
 *
 * Quick navigation (Ctrl+):
 *   Ctrl+D    — Dashboard
 *   Ctrl+Shift+S  — New Sale (navigate + trigger new)
 *   Ctrl+Shift+P  — New Purchase
 *   Ctrl+Shift+W  — Warehouse
 *   Ctrl+Shift+R  — Reports
 *
 * Actions (Ctrl+):
 *   Ctrl+N    — New item (shortcut event)
 *   Ctrl+F    — Focus search (shortcut event + focus)
 *   Ctrl+S    — Save (shortcut event)
 *   Ctrl+P    — Print (shortcut event)
 *   Ctrl+E    — Export (shortcut event)
 *   Ctrl+I    — Import (shortcut event)
 *   Ctrl+Z    — Undo (shortcut event)
 *   Ctrl+A    — Select all (shortcut event, only outside input)
 *   Ctrl+/    — Show shortcuts help overlay
 *   Escape    — Close modal / cancel
 *   Alt+←     — Browser back
 *   Alt+→     — Browser forward
 */

// Static shortcut map for display — categories with keys + descriptions (RU)
export const SHORTCUT_MAP = [
    {
        category: 'Навигация (F-клавиши)',
        shortcuts: [
            { keys: 'F1', description: 'Главная (Dashboard)' },
            { keys: 'F2', description: 'Продажи / Касса' },
            { keys: 'F3', description: 'Товары' },
            { keys: 'F4', description: 'Склад' },
            { keys: 'F5', description: 'Обновить страницу' },
            { keys: 'F6', description: 'Отчёты' },
            { keys: 'F7', description: 'Финансы' },
            { keys: 'F8', description: 'CRM / Клиенты' },
            { keys: 'F9', description: 'Настройки' },
            { keys: 'F10', description: 'Сотрудники' },
            { keys: 'F11', description: 'Закупки' },
            { keys: 'F12', description: 'Смены' },
        ],
    },
    {
        category: 'Действия',
        shortcuts: [
            { keys: 'Ctrl+N', description: 'Создать новый элемент' },
            { keys: 'Ctrl+F', description: 'Поиск по странице' },
            { keys: 'Ctrl+S', description: 'Сохранить' },
            { keys: 'Ctrl+P', description: 'Печать' },
            { keys: 'Ctrl+E', description: 'Экспорт данных' },
            { keys: 'Ctrl+I', description: 'Импорт данных' },
            { keys: 'Ctrl+Z', description: 'Отменить действие' },
            { keys: 'Escape', description: 'Закрыть / Отмена' },
            { keys: 'Ctrl+/', description: 'Показать горячие клавиши' },
        ],
    },
    {
        category: 'Быстрая навигация (Ctrl+Shift)',
        shortcuts: [
            { keys: 'Ctrl+Shift+S', description: 'Новая продажа' },
            { keys: 'Ctrl+Shift+P', description: 'Новая закупка' },
            { keys: 'Ctrl+Shift+W', description: 'Склад' },
            { keys: 'Ctrl+Shift+R', description: 'Отчёты' },
            { keys: 'Ctrl+Shift+E', description: 'Сотрудники' },
            { keys: 'Ctrl+Shift+C', description: 'CRM / Клиенты' },
            { keys: 'Ctrl+Shift+F', description: 'Финансы' },
        ],
    },
];

export function useKeyboardShortcuts() {
    const navigate = useNavigate();

    const handleKeyDown = useCallback((e) => {
        const target = e.target;
        const isInput =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable;

        // Allow F-keys and Escape even when inside inputs
        const isFKey = e.key.startsWith('F') && e.key.length <= 3;
        const isEscape = e.key === 'Escape';

        if (isInput && !isFKey && !isEscape) return;

        // =====================
        // F-KEY NAVIGATION
        // =====================
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
            switch (e.key) {
                case 'F1':
                    e.preventDefault();
                    navigate('/');
                    return;
                case 'F2':
                    e.preventDefault();
                    navigate('/sales');
                    return;
                case 'F3':
                    e.preventDefault();
                    navigate('/products');
                    return;
                case 'F4':
                    e.preventDefault();
                    navigate('/warehouse');
                    return;
                case 'F5':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:refresh'));
                    return;
                case 'F6':
                    e.preventDefault();
                    navigate('/reports');
                    return;
                case 'F7':
                    e.preventDefault();
                    navigate('/finance');
                    return;
                case 'F8':
                    e.preventDefault();
                    navigate('/crm');
                    return;
                case 'F9':
                    e.preventDefault();
                    navigate('/settings');
                    return;
                case 'F10':
                    e.preventDefault();
                    navigate('/employees');
                    return;
                case 'F11':
                    e.preventDefault();
                    navigate('/purchases');
                    return;
                case 'F12':
                    e.preventDefault();
                    navigate('/shifts');
                    return;
                case 'Escape':
                    window.dispatchEvent(new CustomEvent('shortcut:escape'));
                    return;
            }
        }

        // =====================
        // CTRL + KEY ACTIONS
        // =====================
        if (e.ctrlKey && !e.altKey) {
            const key = e.key.toLowerCase();

            // Ctrl+Shift combos
            if (e.shiftKey) {
                switch (key) {
                    case 's':
                        e.preventDefault();
                        navigate('/sales');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('shortcut:new')), 300);
                        return;
                    case 'p':
                        e.preventDefault();
                        navigate('/purchases');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('shortcut:new')), 300);
                        return;
                    case 'w':
                        e.preventDefault();
                        navigate('/warehouse');
                        return;
                    case 'r':
                        e.preventDefault();
                        navigate('/reports');
                        return;
                    case 'e':
                        e.preventDefault();
                        navigate('/employees');
                        return;
                    case 'c':
                        e.preventDefault();
                        navigate('/crm');
                        return;
                    case 'f':
                        e.preventDefault();
                        navigate('/finance');
                        return;
                }
                return;
            }

            // Ctrl-only combos
            switch (key) {
                case 'n':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:new'));
                    return;
                case 'f':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:search'));
                    setTimeout(() => {
                        const searchInput = document.querySelector(
                            '.search-bar input, input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"], input[placeholder*="Поиск"]'
                        );
                        if (searchInput) searchInput.focus();
                    }, 50);
                    return;
                case 's':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:save'));
                    return;
                case 'p':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:print'));
                    return;
                case 'e':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:export'));
                    return;
                case 'i':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:import'));
                    return;
                case 'z':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:undo'));
                    return;
                case 'd':
                    e.preventDefault();
                    navigate('/');
                    return;
                case '/':
                case '?':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:help'));
                    return;
                // Ctrl+A — select-all shortcut event (only outside inputs)
                case 'a':
                    if (!isInput) {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('shortcut:selectall'));
                    }
                    return;
            }
        }

        // =====================
        // ALT + ARROW (browser-like navigation)
        // =====================
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                window.history.back();
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                window.history.forward();
                return;
            }
        }
    }, [navigate]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Hook to listen for a specific shortcut event in any page/component.
 * @param {string} shortcutName - e.g. 'new', 'save', 'search', 'escape', 'refresh', 'print', 'export', 'import', 'undo', 'selectall'
 * @param {Function} handler - callback to invoke when shortcut fires
 * @param {Array} deps - extra deps for the handler (like useCallback deps)
 */
export function useShortcutAction(shortcutName, handler, deps = []) {
    useEffect(() => {
        const eventName = `shortcut:${shortcutName}`;
        const listener = () => handler();
        window.addEventListener(eventName, listener);
        return () => window.removeEventListener(eventName, listener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shortcutName, ...deps]);
}
