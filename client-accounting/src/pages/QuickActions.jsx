import React, { useState } from 'react';
import { Zap, Plus, Search, ShoppingCart, FileText, Users, Package, DollarSign, Printer, BarChart3, Settings, Star, Clock } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function QuickActions() {
    const { t } = useI18n();
    const [actions, setActions] = useState([
        { id: 1, name: 'Новая продажа', icon: ShoppingCart, shortcut: 'F2', color: '#10b981', category: 'sales', pinned: true },
        { id: 2, name: 'Добавить товар', icon: Package, shortcut: 'Ctrl+N', color: '#3b82f6', category: 'products', pinned: true },
        { id: 3, name: 'Новый клиент', icon: Users, shortcut: 'Ctrl+U', color: '#f59e0b', category: 'crm', pinned: true },
        { id: 4, name: 'Печать чека', icon: Printer, shortcut: 'Ctrl+P', color: '#8b5cf6', category: 'sales', pinned: true },
        { id: 5, name: 'Поиск товара', icon: Search, shortcut: 'Ctrl+F', color: '#6b7280', category: 'products', pinned: false },
        { id: 6, name: 'Возврат', icon: DollarSign, shortcut: 'F4', color: '#ef4444', category: 'sales', pinned: false },
        { id: 7, name: 'Отчёт за день', icon: BarChart3, shortcut: 'F5', color: '#3b82f6', category: 'reports', pinned: false },
        { id: 8, name: 'Накладная', icon: FileText, shortcut: 'Ctrl+D', color: '#10b981', category: 'docs', pinned: false },
        { id: 9, name: 'Z-отчёт', icon: FileText, shortcut: 'F8', color: '#f59e0b', category: 'reports', pinned: false }
    ]);

    const [recentActions] = useState([
        { action: 'Новая продажа', time: '2 мин назад' },
        { action: 'Печать чека', time: '5 мин назад' },
        { action: 'Поиск товара', time: '10 мин назад' },
        { action: 'Новый клиент', time: '15 мин назад' }
    ]);

    const togglePin = (id) => {
        setActions(actions.map(a =>
            a.id === id ? { ...a, pinned: !a.pinned } : a
        ));
    };

    const categories = [
        { id: 'sales', name: 'Продажи' },
        { id: 'products', name: 'Товары' },
        { id: 'crm', name: 'CRM' },
        { id: 'reports', name: 'Отчёты' },
        { id: 'docs', name: 'Документы' }
    ];

    const [message, setMessage] = useState(null);
    const handleAddAction = () => setMessage({ type: 'info', text: 'Добавление нового действия...' });

    return (
        <div className="quick-actions-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('quickactions.bystrye_deystviya', '⚡ Быстрые действия')}</h1>
                    <p className="text-muted">{t('quickactions.chasto_ispolzuemye_operatsii', 'Часто используемые операции')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddAction}>
                    <Plus size={18} /> Добавить действие
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Быстрые действия */}
                <div>
                    {/* Закреплённые */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Star size={18} color="#f59e0b" /> Закреплённые
                            </h3>
                        </div>
                        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            {actions.filter(a => a.pinned).map(action => {
                                const ActionIcon = action.icon;

                                return (
                                    <div
                                        key={action.id}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '12px',
                                            background: `${action.color}10`,
                                            border: `1px solid ${action.color}30`,
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: '48px', height: '48px',
                                            borderRadius: '12px',
                                            background: action.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 12px'
                                        }}>
                                            <ActionIcon size={24} color="white" />
                                        </div>
                                        <div style={{ fontWeight: 500, marginBottom: '4px' }}>{action.name}</div>
                                        <code style={{
                                            background: 'white',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: '#888'
                                        }}>
                                            {action.shortcut}
                                        </code>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Все действия по категориям */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('quickactions.vse_deystviya', '📋 Все действия')}</h3>
                        </div>
                        {categories.map(category => {
                            const categoryActions = actions.filter(a => a.category === category.id);
                            if (categoryActions.length === 0) return null;

                            return (
                                <div key={category.id}>
                                    <div style={{
                                        padding: '8px 16px',
                                        background: 'var(--bg-secondary)',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: '#888'
                                    }}>
                                        {category.name}
                                    </div>
                                    {categoryActions.map(action => {
                                        const ActionIcon = action.icon;

                                        return (
                                            <div
                                                key={action.id}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{
                                                    width: '36px', height: '36px',
                                                    borderRadius: '8px',
                                                    background: `${action.color}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <ActionIcon size={18} color={action.color} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{action.name}</div>
                                                </div>
                                                <code style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px'
                                                }}>
                                                    {action.shortcut}
                                                </code>
                                                <button
                                                    onClick={() => togglePin(action.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    <Star
                                                        size={16}
                                                        color={action.pinned ? '#f59e0b' : '#ccc'}
                                                        fill={action.pinned ? '#f59e0b' : 'none'}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Правая панель */}
                <div>
                    {/* Недавние */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={18} /> Недавние
                            </h3>
                        </div>
                        <div>
                            {recentActions.map((item, idx) => (
                                <div key={idx} style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>{item.action}</span>
                                    <span style={{ fontSize: '12px', color: '#888' }}>{item.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Настройки */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Settings size={18} /> Настройки
                        </h3>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>{t('quickactions.pokazyvat_podskazki', 'Показывать подсказки')}</span>
                                <label style={{
                                    width: '44px', height: '24px',
                                    background: '#10b981',
                                    borderRadius: '12px',
                                    position: 'relative',
                                    cursor: 'pointer'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        width: '20px', height: '20px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        top: '2px',
                                        left: '22px',
                                        transition: 'left 0.2s'
                                    }} />
                                </label>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>{t('quickactions.zvukovye_effekty', 'Звуковые эффекты')}</span>
                                <label style={{
                                    width: '44px', height: '24px',
                                    background: '#ccc',
                                    borderRadius: '12px',
                                    position: 'relative',
                                    cursor: 'pointer'
                                }}>
                                    <span style={{
                                        position: 'absolute',
                                        width: '20px', height: '20px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        top: '2px',
                                        left: '2px',
                                        transition: 'left 0.2s'
                                    }} />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px' }}>{t('quickactions.maksimum_zakreplyonnyh', 'Максимум закреплённых:')}</label>
                            <select style={{ width: '100%' }}>
                                <option>4</option>
                                <option>6</option>
                                <option>8</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuickActions;
