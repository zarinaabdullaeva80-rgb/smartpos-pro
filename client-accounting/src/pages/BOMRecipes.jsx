import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit, Eye, Copy, ChevronRight, Layers } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function BOMRecipes() {
    const { t } = useI18n();
    const toast = useToast();
    const [recipes, setRecipes] = useState([]);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('BOMRecipes.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('BOMRecipes: не удалось загрузить данные', err.message);
        }

        setSelectedRecipe(recipes[0] || null);
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    return (
        <div className="bom-recipes-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('bomrecipes.retseptury', '🔧 Рецептуры / BOM')}</h1>
                    <p className="text-muted">{t('bomrecipes.sostav_izdeliy_i_komplektov', 'Состав изделий и комплектов')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Создание новой рецептуры...')}>
                    <Plus size={18} /> Новая рецептура
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список рецептур */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск рецептуры..." style={{ paddingLeft: '40px', width: '100%' }} />
                        </div>
                    </div>
                    <div>
                        {recipes.map(recipe => (
                            <div
                                key={recipe.id}
                                onClick={() => setSelectedRecipe(recipe)}
                                style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedRecipe?.id === recipe.id ? 'var(--primary-light)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}
                            >
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '8px',
                                    background: 'var(--primary-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Layers size={20} color="var(--primary)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{recipe.name}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>{recipe.sku}</div>
                                </div>
                                <ChevronRight size={16} color="#888" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Детали рецептуры */}
                {selectedRecipe && (
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ margin: '0 0 8px' }}>{selectedRecipe.name}</h2>
                                <div style={{ color: '#888' }}>SKU: {selectedRecipe.sku}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => toast.info('Копирование рецептуры...')}>
                                    <Copy size={16} /> Копировать
                                </button>
                                <button className="btn btn-secondary" onClick={() => toast.info('Редактирование рецептуры...')}>
                                    <Edit size={16} /> Редактировать
                                </button>
                            </div>
                        </div>

                        {/* Выход */}
                        <div style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderRadius: '12px',
                            color: 'white',
                            marginBottom: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('bomrecipes.vyhod_produktsii', 'Выход продукции')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{selectedRecipe.output_qty} шт</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('bomrecipes.sebestoimost', 'Себестоимость')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(selectedRecipe.cost)}</div>
                            </div>
                        </div>

                        {/* Компоненты */}
                        <h4 style={{ margin: '0 0 12px' }}>📦 Компоненты ({selectedRecipe.components?.length})</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>{t('bomrecipes.komponent', 'Компонент')}</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>SKU</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>{t('bomrecipes.kol_vo', 'Кол-во')}</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>{t('bomrecipes.stoimost', 'Стоимость')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedRecipe.components?.map((comp, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Package size={16} color="#888" />
                                                <span style={{ fontWeight: 500 }}>{comp.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', color: '#888', fontSize: '13px' }}>{comp.sku}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: 'var(--primary-light)',
                                                color: 'var(--primary)',
                                                padding: '4px 12px',
                                                borderRadius: '8px',
                                                fontWeight: 'bold'
                                            }}>
                                                {comp.qty} {comp.unit}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 500 }}>
                                            {formatCurrency(comp.cost)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                                    <td colSpan="3" style={{ padding: '12px' }}>{t('bomrecipes.itogo_sebestoimost', 'Итого себестоимость:')}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(selectedRecipe.cost)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BOMRecipes;
