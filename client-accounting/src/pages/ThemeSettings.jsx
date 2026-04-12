import React, { useState } from 'react';
import { Moon, Sun, Palette, Monitor, Check, RefreshCw, Eye } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function ThemeSettings() {
    const { t } = useI18n();
    const [theme, setTheme] = useState('light');
    const [accentColor, setAccentColor] = useState('#3b82f6');
    const [fontSize, setFontSize] = useState('medium');

    const themes = [
        { id: 'light', name: 'Светлая', icon: Sun, colors: { bg: '#ffffff', text: '#1f2937', accent: '#3b82f6' } },
        { id: 'dark', name: 'Тёмная', icon: Moon, colors: { bg: '#1f2937', text: '#f9fafb', accent: '#60a5fa' } },
        { id: 'system', name: 'Системная', icon: Monitor, colors: { bg: '#f3f4f6', text: '#374151', accent: '#3b82f6' } }
    ];

    const accentColors = [
        { id: 'blue', color: '#3b82f6', name: 'Синий' },
        { id: 'green', color: '#10b981', name: 'Зелёный' },
        { id: 'purple', color: '#8b5cf6', name: 'Фиолетовый' },
        { id: 'orange', color: '#f59e0b', name: 'Оранжевый' },
        { id: 'red', color: '#ef4444', name: 'Красный' },
        { id: 'pink', color: '#ec4899', name: 'Розовый' }
    ];

    const fontSizes = [
        { id: 'small', name: 'Мелкий', size: '13px' },
        { id: 'medium', name: 'Средний', size: '14px' },
        { id: 'large', name: 'Крупный', size: '16px' }
    ];

    return (
        <div className="theme-settings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('themesettings.tyomnaya_tema', '🎨 Тёмная тема')}</h1>
                    <p className="text-muted">{t('themesettings.nastroyka_vneshnego_vida_prilozheniya', 'Настройка внешнего вида приложения')}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
                {/* Настройки */}
                <div>
                    {/* Выбор темы */}
                    <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 20px' }}>{t('themesettings.rezhim_otobrazheniya', '🌓 Режим отображения')}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {themes.map(t => {
                                const ThemeIcon = t.icon;

                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => setTheme(t.id)}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '12px',
                                            border: theme === t.id ? `2px solid ${accentColor}` : '2px solid var(--border-color)',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            background: theme === t.id ? `${accentColor}10` : 'transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: '60px', height: '40px',
                                            borderRadius: '8px',
                                            background: t.colors.bg,
                                            border: '1px solid #ddd',
                                            margin: '0 auto 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <ThemeIcon size={20} color={t.colors.text} />
                                        </div>
                                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                                        {theme === t.id && (
                                            <Check size={16} color={accentColor} style={{ marginTop: '8px' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 20px' }}>{t('themesettings.osnovnoy_tsvet', '🎨 Основной цвет')}</h3>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {accentColors.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => setAccentColor(c.color)}
                                    style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '12px',
                                        background: c.color,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: accentColor === c.color ? '3px solid #1f2937' : 'none',
                                        boxShadow: accentColor === c.color ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    title={c.name}
                                >
                                    {accentColor === c.color && <Check size={24} color="white" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Font Size */}
                    <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ margin: '0 0 20px' }}>{t('themesettings.razmer_shrifta', '📝 Размер шрифта')}</h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {fontSizes.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFontSize(f.id)}
                                    className={`btn ${fontSize === f.id ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{
                                        fontSize: f.size,
                                        flex: 1,
                                        background: fontSize === f.id ? accentColor : undefined
                                    }}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Превью */}
                <div>
                    <div className="card" style={{
                        padding: '24px',
                        background: themes.find(t => t.id === theme)?.colors.bg || '#fff',
                        color: themes.find(t => t.id === theme)?.colors.text || '#1f2937'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <Eye size={20} />
                            <h3 style={{ margin: 0 }}>{t('themesettings.predprosmotr', 'Предпросмотр')}</h3>
                        </div>

                        {/* Пример интерфейса */}
                        <div style={{
                            padding: '16px',
                            background: theme === 'dark' ? '#374151' : '#f3f4f6',
                            borderRadius: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px'
                            }}>
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '10px',
                                    background: accentColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Palette size={20} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{t('themesettings.kartochka_tovara', 'Карточка товара')}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>iPhone 15 Pro 256GB</div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold', color: accentColor }}>18 000 000 so'm</span>
                                <button style={{
                                    background: accentColor,
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}>
                                    В корзину
                                </button>
                            </div>
                        </div>

                        {/* Примеры кнопок */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button style={{
                                background: accentColor,
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}>
                                Основная
                            </button>
                            <button style={{
                                background: 'transparent',
                                color: accentColor,
                                border: `1px solid ${accentColor}`,
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}>
                                Вторичная
                            </button>
                        </div>

                        {/* Статусы */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{
                                background: '#dcfce7',
                                color: '#10b981',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}>
                                Успех
                            </span>
                            <span style={{
                                background: '#fef3c7',
                                color: '#f59e0b',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}>
                                Внимание
                            </span>
                            <span style={{
                                background: '#fee2e2',
                                color: '#ef4444',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '12px'
                            }}>
                                Ошибка
                            </span>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{
                        width: '100%',
                        marginTop: '16px',
                        background: accentColor
                    }}>
                        <RefreshCw size={18} /> Применить изменения
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ThemeSettings;
