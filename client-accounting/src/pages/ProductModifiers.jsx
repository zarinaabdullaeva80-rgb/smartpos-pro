import React, { useState, useEffect } from 'react';
import { Palette, Plus, Edit2, Trash2, Package, DollarSign, Check } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function ProductModifiers() {
    const { t } = useI18n();
    const toast = useToast();
    const [modifiers, setModifiers] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newModifier, setNewModifier] = useState({ name: '', type: 'size', options: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadModifiers(); }, []);

    const loadModifiers = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setModifiers(apiData.modifiers || []);
        } catch (err) {
            console.warn('ProductModifiers: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => {
        if (value === 0) return 'Без доплаты';
        return '+' + new Intl.NumberFormat('ru-RU').format(value) + " so'm";
    };

    const getTypeIcon = (type) => {
        const icons = {
            'size': '📐',
            'color': '🎨',
            'storage': '💾',
            'addon': '➕'
        };
        return icons[type] || '📦';
    };

    const getTypeName = (type) => {
        const names = {
            'size': 'Размер',
            'color': 'Цвет',
            'storage': 'Объём памяти',
            'addon': 'Добавки'
        };
        return names[type] || type;
    };

    return (
        <div className="product-modifiers-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('productmodifiers.modifikatory_tovarov', '🎨 Модификаторы товаров')}</h1>
                    <p className="text-muted">{t('productmodifiers.razmery_tsveta_dobavki_i_drugie_variant', 'Размеры, цвета, добавки и другие варианты')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={18} /> Создать модификатор
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Palette size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{modifiers.length}</div>
                    <div style={{ color: '#666' }}>{t('productmodifiers.modifikatorov', 'Модификаторов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {modifiers.reduce((sum, m) => sum + m.applied_to, 0)}
                    </div>
                    <div style={{ color: '#666' }}>{t('productmodifiers.tovarov_s_modifikatorami', 'Товаров с модификаторами')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {modifiers.reduce((sum, m) => sum + m.options.length, 0)}
                    </div>
                    <div style={{ color: '#666' }}>{t('productmodifiers.vsego_optsiy', 'Всего опций')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>15%</div>
                    <div style={{ color: '#666' }}>{t('productmodifiers.rost_vyruchki', 'Рост выручки')}</div>
                </div>
            </div>

            {/* Список модификаторов */}
            {loading ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>{t('productmodifiers.zagruzka', 'Загрузка...')}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                    {modifiers.map(mod => (
                        <div key={mod.id} className="card" style={{ overflow: 'hidden' }}>
                            <div style={{
                                padding: '20px',
                                background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '32px' }}>{getTypeIcon(mod.type)}</span>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{mod.name}</h3>
                                        <div style={{ fontSize: '13px', color: '#888' }}>
                                            {getTypeName(mod.type)} • Применён к {mod.applied_to} товарам
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Редактирование: ${mod.name}`)}><Edit2 size={14} /></button>
                                    <button className="btn btn-sm btn-secondary" onClick={() => toast.success(`Удаление: ${mod.name}`)}><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div style={{ padding: '16px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('productmodifiers.optsiya', 'Опция')}</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('productmodifiers.doplata', 'Доплата')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mod.options.map(opt => (
                                            <tr key={opt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {opt.hex && (
                                                            <div style={{
                                                                width: '20px', height: '20px',
                                                                borderRadius: '4px',
                                                                background: opt.hex,
                                                                border: opt.hex === '#FFFFFF' ? '1px solid #ddd' : 'none'
                                                            }} />
                                                        )}
                                                        {opt.value}
                                                    </div>
                                                </td>
                                                <td style={{
                                                    padding: '10px 12px',
                                                    textAlign: 'right',
                                                    color: opt.price_modifier > 0 ? '#10b981' : '#888'
                                                }}>
                                                    {formatCurrency(opt.price_modifier)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Модал создания */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('productmodifiers.novyy_modifikator', '🎨 Новый модификатор')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('productmodifiers.nazvanie', 'Название')}</label>
                                <input type="text" placeholder="Размер" />
                            </div>
                            <div className="form-group">
                                <label>{t('productmodifiers.tip', 'Тип')}</label>
                                <select>
                                    <option value="size">{t('productmodifiers.razmer', 'Размер')}</option>
                                    <option value="color">{t('productmodifiers.tsvet', 'Цвет')}</option>
                                    <option value="storage">{t('productmodifiers.obyom_pamyati', 'Объём памяти')}</option>
                                    <option value="addon">{t('productmodifiers.dobavki_dopolneniya', 'Добавки/Дополнения')}</option>
                                    <option value="other">{t('productmodifiers.drugoe', 'Другое')}</option>
                                </select>
                            </div>
                            <p style={{ color: '#888', fontSize: '14px' }}>
                                Опции можно добавить после создания модификатора
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t('productmodifiers.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => { setShowCreate(false); toast.success('Модификатор создан!'); }}>
                                <Plus size={18} /> Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductModifiers;
