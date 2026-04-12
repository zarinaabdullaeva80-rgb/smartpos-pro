import React, { useState, useEffect } from 'react';
import { Keyboard, Command, Search, Settings, Save, Info } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function KeyboardShortcuts() {
    const { t } = useI18n();
    const [shortcuts, setShortcuts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => { loadShortcuts(); }, []);

    const loadShortcuts = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setShortcuts(apiData.shortcuts || []);
        } catch (err) {
            console.warn('KeyboardShortcuts: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const categories = ['all', ...new Set(shortcuts.map(s => s.category))];

    const filteredShortcuts = shortcuts.filter(s => {
        const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
        const matchesSearch = s.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.key.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const groupedShortcuts = filteredShortcuts.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = [];
        acc[s.category].push(s);
        return acc;
    }, {});

    return (
        <div className="keyboard-shortcuts-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('keyboardshortcuts.goryachie_klavishi', '⌨️ Горячие клавиши')}</h1>
                    <p className="text-muted">{t('keyboardshortcuts.klaviaturnye_sochetaniya_dlya_bystroy_rabot', 'Клавиатурные сочетания для быстрой работы')}</p>
                </div>
            </div>

            {/* Инфо */}
            <div className="card" style={{ marginBottom: '20px', padding: '20px', background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Info size={32} color="#3b82f6" />
                    <div>
                        <h3 style={{ margin: '0 0 4px' }}>{t('keyboardshortcuts.uskorte_rabotu_s_goryachimi_klavishami', 'Ускорьте работу с горячими клавишами!')}</h3>
                        <p style={{ margin: 0, color: '#666' }}>
                            Используйте клавиатурные сочетания для быстрого доступа к функциям.
                            Нажмите <kbd style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ddd' }}>Ctrl</kbd> +
                            <kbd style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '4px' }}>?</kbd> в любом месте для справки.
                        </p>
                    </div>
                </div>
            </div>

            {/* Поиск и фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск команды..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px', width: '100%' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-secondary)',
                                    color: selectedCategory === cat ? 'white' : 'inherit',
                                    cursor: 'pointer'
                                }}
                            >
                                {cat === 'all' ? 'Все' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Список */}
            {Object.entries(groupedShortcuts).map(([category, items]) => (
                <div key={category} className="card" style={{ marginBottom: '20px' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{category}</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: 'var(--border-color)' }}>
                        {items.map((shortcut, idx) => (
                            <div key={idx} style={{
                                padding: '16px',
                                background: 'var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <span style={{ fontSize: '24px' }}>{shortcut.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{shortcut.action}</div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: '4px'
                                }}>
                                    {shortcut.key.split(' + ').map((k, i) => (
                                        <React.Fragment key={i}>
                                            {i > 0 && <span style={{ color: '#888' }}>+</span>}
                                            <kbd style={{
                                                background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
                                                border: '1px solid #ced4da',
                                                borderRadius: '6px',
                                                padding: '6px 10px',
                                                fontSize: '13px',
                                                fontWeight: 'bold',
                                                boxShadow: '0 2px 0 #adb5bd',
                                                minWidth: '32px',
                                                textAlign: 'center'
                                            }}>
                                                {k}
                                            </kbd>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default KeyboardShortcuts;
