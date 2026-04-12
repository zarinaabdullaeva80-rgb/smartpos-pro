import React from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

/**
 * KeyboardShortcutsProvider - обёртка для активации горячих клавиш
 * Использовать внутри Router, чтобы хук имел доступ к useNavigate
 */
function KeyboardShortcutsProvider({ children, onSearch, onNewItem, onQuickSale }) {
    useKeyboardShortcuts({
        onSearch,
        onNewItem,
        onQuickSale,
        enabled: true
    });

    return <>{children}</>;
}

export default KeyboardShortcutsProvider;
