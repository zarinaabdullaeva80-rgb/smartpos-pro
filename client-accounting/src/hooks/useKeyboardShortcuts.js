import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts hook for SmartPOS Pro
 * 
 * Navigation:
 *   F1        — Dashboard (Главная)
 *   F2        — Sales (Продажи / Касса)
 *   F3        — Products (Товары)
 *   F4        — Warehouse (Склад)
 *   F5        — Refresh page
 *   F6        — Reports (Отчёты)
 *   F7        — Finance (Финансы)
 *   F8        — CRM / Клиенты
 *   F9        — Settings (Настройки)
 *   F10       — Employees (Сотрудники)
 *
 * Actions:
 *   Ctrl+N    — New item (triggers custom event)
 *   Ctrl+F    — Focus search
 *   Ctrl+S    — Save (triggers custom event)
 *   Ctrl+P    — Print (triggers custom event)
 *   Ctrl+E    — Export
 *   Ctrl+I    — Import
 *   Ctrl+Shift+S — New Sale
 *   Ctrl+Shift+P — New Purchase
 *   Escape    — Close modal / cancel
 *   Ctrl+?    — Show shortcuts help
 */

// Shortcut definitions for display in help overlay
export const SHORTCUT_MAP = [
    { category: 'Навигация', shortcuts: [
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
    ]},
    { category: 'Действия', shortcuts: [
        { keys: 'Ctrl+N', description: 'Создать новый элемент' },
        { keys: 'Ctrl+F', description: 'Поиск' },
        { keys: 'Ctrl+S', description: 'Сохранить' },
        { keys: 'Ctrl+P', description: 'Печать' },
        { keys: 'Ctrl+E', description: 'Экспорт' },
        { keys: 'Ctrl+I', description: 'Импорт' },
        { keys: 'Escape', description: 'Закрыть / Отмена' },
        { keys: 'Ctrl+/', description: 'Показать горячие клавиши' },
    ]},
];

export function useKeyboardShortcuts() {
    const navigate = useNavigate();

    const handleKeyDown = useCallback((e) => {
        // Don't trigger shortcuts when typing in inputs
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

        // Allow F-keys and Escape even in inputs
        const isFKey = e.key.startsWith('F') && e.key.length <= 3;
        const isEscape = e.key === 'Escape';

        if (isInput && !isFKey && !isEscape) return;

        // === F-KEY NAVIGATION ===
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
                case 'Escape':
                    window.dispatchEvent(new CustomEvent('shortcut:escape'));
                    return;
            }
        }

        // === CTRL + KEY ACTIONS ===
        if (e.ctrlKey && !e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'n':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('shortcut:new'));
                    }
                    return;
                case 'f':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:search'));
                    // Also try to focus search input
                    setTimeout(() => {
                        const searchInput = document.querySelector('.search-bar input, input[type="search"], input[placeholder*="оиск"], input[placeholder*="earch"]');
                        if (searchInput) searchInput.focus();
                    }, 50);
                    return;
                case 's':
                    if (e.shiftKey) {
                        // Ctrl+Shift+S — New Sale
                        e.preventDefault();
                        navigate('/sales');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('shortcut:new')), 300);
                    } else {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('shortcut:save'));
                    }
                    return;
                case 'p':
                    if (e.shiftKey) {
                        // Ctrl+Shift+P — New Purchase
                        e.preventDefault();
                        navigate('/purchases');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('shortcut:new')), 300);
                    } else {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('shortcut:print'));
                    }
                    return;
                case 'e':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:export'));
                    return;
                case 'i':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:import'));
                    return;
                case '/':
                case '?':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('shortcut:help'));
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
 * Hook to listen for a specific shortcut event
 * @param {string} shortcutName - e.g. 'new', 'save', 'search', 'escape', 'refresh'
 * @param {Function} handler - callback
 */
export function useShortcutAction(shortcutName, handler) {
    useEffect(() => {
        const eventName = `shortcut:${shortcutName}`;
        const listener = () => handler();
        window.addEventListener(eventName, listener);
        return () => window.removeEventListener(eventName, listener);
    }, [shortcutName, handler]);
}
