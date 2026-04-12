import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
    const [theme, setTheme] = useState('light');
    const [compact, setCompact] = useState(false);

    useEffect(() => {
        // Загрузить сохранённые настройки
        const savedTheme = localStorage.getItem('theme') || 'light';
        const savedCompact = localStorage.getItem('compact') === 'true';

        setTheme(savedTheme);
        setCompact(savedCompact);

        document.documentElement.setAttribute('data-theme', savedTheme);
        document.documentElement.setAttribute('data-compact', savedCompact);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const toggleCompact = () => {
        const newCompact = !compact;
        setCompact(newCompact);
        document.documentElement.setAttribute('data-compact', newCompact);
        localStorage.setItem('compact', newCompact);
    };

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            gap: '12px'
        }}>
            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                className="theme-toggle"
                title={`Переключить на ${theme === 'light' ? 'тёмную' : 'светлую'} тему (Alt + T)`}
                style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: 'var(--card-shadow)'
                }}
            >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Compact Mode Toggle */}
            <button
                onClick={toggleCompact}
                className="compact-toggle"
                title={`${compact ? 'Выключить' : 'Включить'} компактный режим (Alt + C)`}
                style={{
                    background: compact ? 'var(--primary-color)' : 'var(--card-bg)',
                    color: compact ? 'white' : 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    boxShadow: 'var(--card-shadow)',
                    fontSize: '13px',
                    fontWeight: 600
                }}
            >
                {compact ? 'Компактно' : 'Обычно'}
            </button>
        </div>
    );
};

// Глобальные горячие клавиши
export const useKeyboardShortcuts = () => {
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Alt + T = Toggle Theme
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            }

            // Alt + C = Toggle Compact
            if (e.altKey && e.key === 'c') {
                e.preventDefault();
                const current = document.documentElement.getAttribute('data-compact') === 'true';
                document.documentElement.setAttribute('data-compact', !current);
                localStorage.setItem('compact', !current);
            }

            // Alt + S = Focus Search
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                const searchInput = document.querySelector('input[type="search"], input[placeholder*="Поиск"]');
                if (searchInput) searchInput.focus();
            }

            // Alt + N = New (create new item on current page)
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                const newButton = document.querySelector('button[class*="btn-primary"]');
                if (newButton) newButton.click();
            }

            // Esc = Close modal
            if (e.key === 'Escape') {
                const closeButton = document.querySelector('.modal-overlay button, [class*="modal"] button[class*="close"]');
                if (closeButton) closeButton.click();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);
};

export default ThemeToggle;
