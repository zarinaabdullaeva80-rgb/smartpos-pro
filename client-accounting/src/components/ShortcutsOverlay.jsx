import React, { useState, useEffect } from 'react';
import { SHORTCUT_MAP } from '../hooks/useKeyboardShortcuts';
import { Keyboard, X } from 'lucide-react';

/**
 * Floating overlay that shows all keyboard shortcuts
 * Triggered by Ctrl+/ or from the shortcuts page
 */
function ShortcutsOverlay() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const showHandler = () => setVisible(true);
        window.addEventListener('shortcut:help', showHandler);
        return () => window.removeEventListener('shortcut:help', showHandler);
    }, []);

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease'
        }} onClick={() => setVisible(false)}>
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Keyboard size={28} style={{ color: '#a78bfa' }} />
                        <h2 style={{
                            margin: 0,
                            fontSize: '22px',
                            background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Горячие клавиши
                        </h2>
                    </div>
                    <button
                        onClick={() => setVisible(false)}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: '#999',
                            display: 'flex'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Shortcut categories */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {SHORTCUT_MAP.map((category) => (
                        <div key={category.category}>
                            <h3 style={{
                                color: '#a78bfa',
                                fontSize: '14px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '12px',
                                borderBottom: '1px solid rgba(167,139,250,0.2)',
                                paddingBottom: '8px'
                            }}>
                                {category.category}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {category.shortcuts.map((shortcut) => (
                                    <div key={shortcut.keys} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        transition: 'background 0.2s'
                                    }}>
                                        <span style={{
                                            color: '#ccc',
                                            fontSize: '13px'
                                        }}>
                                            {shortcut.description}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {shortcut.keys.split('+').map((key, i) => (
                                                <kbd key={i} style={{
                                                    background: 'linear-gradient(180deg, #3a3a5c 0%, #2a2a4a 100%)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    borderRadius: '5px',
                                                    padding: '2px 8px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    color: '#e0e0e0',
                                                    minWidth: '24px',
                                                    textAlign: 'center',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                }}>
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer hint */}
                <div style={{
                    marginTop: '24px',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '12px'
                }}>
                    Нажмите <kbd style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                    }}>Esc</kbd> или кликните вне окна для закрытия
                </div>
            </div>
        </div>
    );
}

export default ShortcutsOverlay;
