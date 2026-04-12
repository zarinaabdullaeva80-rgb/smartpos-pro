import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { categoriesAPI } from '../services/api';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
const Categories = () => {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const { handleSuccess, handleError } = useActionHandler();

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const response = await categoriesAPI.getAll();
            setCategories(response.data?.categories || response.data || []);
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
            handleError('Не удалось загрузить категории');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (category = null) => {
        setEditingCategory(category);
        setFormData(category ? {
            name: category.name,
            description: category.description || ''
        } : {
            name: '',
            description: ''
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingCategory) {
                await categoriesAPI.update(editingCategory.id, formData);
                handleSuccess('Категория обновлена');
            } else {
                await categoriesAPI.create(formData);
                handleSuccess('Категория создана');
            }
            await loadCategories();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения категории:', error);
            handleError('Ошибка сохранения категории');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Вы уверены, что хотите удалить эту категорию?' }))) return;

        try {
            await categoriesAPI.delete(id);
            handleSuccess('Категория удалена');
            await loadCategories();
        } catch (error) {
            console.error('Ошибка удаления категории:', error);
            handleError('Не удалось удалить категорию. Возможно, она используется в товарах.');
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Package className="page-icon" />
                        Категории товаров
                    </h1>
                    <p className="page-subtitle">{t('categories.upravlenie_kategoriyami_dlya_klassifikatsii', 'Управление категориями для классификации товаров')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={categories}
                        filename="Категории"
                        sheetName="Категории"
                        folder="categories"
                        columns={{
                            id: 'ID',
                            name: 'Название',
                            description: 'Описание'
                        }}
                    />
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus size={20} />
                        Новая категория
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                    <div key={category.id} className="card glass">
                        <h3 className="font-semibold text-lg mb-2">{category.name}</h3>
                        {category.description && (
                            <p className="text-sm text-gray-500 mb-4">{category.description}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                className="btn btn-sm btn-secondary flex-1"
                                onClick={() => handleOpenModal(category)}
                            >
                                <Edit size={16} />
                                Изменить
                            </button>
                            <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(category.id)}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {categories.length === 0 && !loading && (
                <div className="text-center py-12">
                    <Package size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">{t('categories.net_kategoriy_sozdayte_pervuyu_kategoriyu', 'Нет категорий. Создайте первую категорию.')}</p>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="space-y-4">
                                    <div>
                                        <label className="label required">Название</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Описание</label>
                                        <textarea
                                            className="input"
                                            rows="3"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
