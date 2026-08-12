import React, { useState, useEffect } from 'react';
import { SHORTCUT_MAP } from '../hooks/useKeyboardShortcuts';
import { Keyboard, X } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Floating overlay showing all keyboard shortcuts.
 * Triggered by Ctrl+/ from anywhere in the app.
 */
function ShortcutsOverlay() {
    const [visible, setVisible] = useState(false);
    const { t } = useI18n();

    useEffect(() => {
        const showHandler = () => setVisible(true);
        const escHandler = () => setVisible(false);
        window.addEventListener('shortcut:help', showHandler);
        window.addEventListener('shortcut:escape', escHandler);
        return () => {
            window.removeEventListener('shortcut:help', showHandler);
            window.removeEventListener('shortcut:escape', escHandler);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000,
                animation: 'fadeIn 0.2s ease',
            }}
            onClick={() => setVisible(false)}
        >
            <div
                style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    borderRadius: '20px',
                    padding: '32px',
                    maxWidth: '860px',
                    width: '95%',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    position: 'relative',
                    border: '1px solid rgba(167,139,250,0.2)',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Keyboard size={26} color="#fff" />
                        </div>
                        <div>
                            <h2 style={{
                                margin: 0, fontSize: '22px', fontWeight: 700,
                                background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                {t('shortcuts.title', 'Горячие клавиши')}
                            </h2>
                            <p style={{ margin: 0, fontSize: '13px', color: '#888', marginTop: '2px' }}>
                                {t('shortcuts.subtitle', 'Нажмите Ctrl+/ в любом месте для справки')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setVisible(false)}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: '#999',
                            display: 'flex',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#999'; }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Shortcut categories grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                    {SHORTCUT_MAP.map((category) => (
                        <div key={category.category}>
                            <h3 style={{
                                color: '#a78bfa',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '1.5px',
                                marginBottom: '12px',
                                borderBottom: '1px solid rgba(167,139,250,0.15)',
                                paddingBottom: '8px',
                            }}>
                                {category.category}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {category.shortcuts.map((shortcut) => (
                                    <div
                                        key={shortcut.keys}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            transition: 'background 0.15s',
                                            cursor: 'default',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ color: '#ccc', fontSize: '13px' }}>
                                            {shortcut.description}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                                            {shortcut.keys.split('+').map((key, i, arr) => (
                                                <React.Fragment key={i}>
                                                    <kbd style={{
                                                        background: 'linear-gradient(180deg, #2e2e50 0%, #1e1e40 100%)',
                                                        border: '1px solid rgba(255,255,255,0.12)',
                                                        borderBottom: '2px solid rgba(255,255,255,0.06)',
                                                        borderRadius: '6px',
                                                        padding: '2px 8px',
                                                        fontSize: '11px',
                                                        fontFamily: 'monospace',
                                                        color: '#d0d0ff',
                                                        minWidth: '22px',
                                                        textAlign: 'center',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {key}
                                                    </kbd>
                                                    {i < arr.length - 1 && (
                                                        <span style={{ color: '#555', fontSize: '11px', alignSelf: 'center' }}>+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: '28px', textAlign: 'center', color: '#555', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    {t('shortcuts.close_hint', 'Нажмите')} {' '}
                    <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', fontFamily: 'monospace', color: '#aaa' }}>Esc</kbd>
                    {' '} {t('shortcuts.or_click', 'или кликните вне окна для закрытия')}
                </div>
            </div>
        </div>
    );
}

export default ShortcutsOverlay;
