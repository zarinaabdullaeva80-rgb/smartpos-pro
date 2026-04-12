import React, { useState, useEffect } from 'react';
import { Hash, Search, Plus, Package, CheckCircle, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { productsAPI } from '../services/api';
import { getApiUrl } from '../config/settings';
import api from '../services/api';
import { useI18n } from '../i18n';

function SerialNumbers() {
    const { t } = useI18n();
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [serials, setSerials] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSerials, setNewSerials] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setProducts(apiData.products || apiData || []);
        } catch (err) {
            console.warn('SerialNumbers: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const selectProduct = async (product) => {
        setSelectedProduct(product);
        try {
            const response = await api.get(`/extended/serials/${product.id}`);
            const data = response.data || response;
            setSerials(data.serials || data || []);
        } catch (error) {
            console.warn('SerialNumbers: не удалось загрузить данные', error.message);
        }
    };

    const addSerials = async () => {
        const serialsList = newSerials.split('\n').filter(s => s.trim());
        try {
            await api.post(`/extended/serials/${selectedProduct.id}`, {
                serials: serialsList.map(s => s.trim())
            });
        } catch (error) {
            console.warn('Add serials API failed, local only:', error.message);
        }
        const newItems = serialsList.map((sn, idx) => ({
            id: Date.now() + idx,
            serial_number: sn.trim(),
            status: 'available',
            warranty_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }));
        setSerials([...newItems, ...serials]);
        setNewSerials('');
        setShowAddModal(false);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusBadge = (status) => {
        const styles = {
            available: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle, text: 'В наличии' },
            sold: { bg: '#dbeafe', color: '#1d4ed8', icon: Package, text: 'Продан' },
            returned: { bg: '#fef3c7', color: '#d97706', icon: RotateCcw, text: 'Возврат' },
            defective: { bg: '#fee2e2', color: '#dc2626', icon: AlertTriangle, text: 'Брак' }
        };
        const s = styles[status] || styles.available;
        const Icon = s.icon;
        return (
            <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={14} /> {s.text}
            </span>
        );
    };

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="serial-numbers-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('serialnumbers.seriynye_nomera', '# Серийные номера')}</h1>
                    <p className="text-muted">{t('serialnumbers.uchyot_tovarov_po_seriynym_nomeram', 'Учёт товаров по серийным номерам')}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список товаров */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск товара..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>{t('serialnumbers.zagruzka', 'Загрузка...')}</div>
                        ) : filteredProducts.map(product => (
                            <div
                                key={product.id}
                                onClick={() => selectProduct(product)}
                                style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedProduct?.id === product.id ? 'var(--primary-light)' : 'transparent'
                                }}
                            >
                                <div style={{ fontWeight: 500 }}>{product.name}</div>
                                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                                    SKU: {product.sku}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px' }}>
                                    <span style={{ color: '#10b981' }}>✓ {product.available} в наличии</span>
                                    <span style={{ color: '#888' }}>Всего: {product.serials_count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Серийные номера */}
                <div>
                    {selectedProduct ? (
                        <div className="card">
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>{selectedProduct.name}</h3>
                                    <div style={{ color: '#888', fontSize: '14px' }}>SKU: {selectedProduct.sku}</div>
                                </div>
                                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                                    <Plus size={18} /> Добавить серийники
                                </button>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-secondary)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>{t('serialnumbers.seriynyy_nomer', 'Серийный номер')}</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>{t('serialnumbers.status', 'Статус')}</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>{t('serialnumbers.garantiya_do', 'Гарантия до')}</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>{t('serialnumbers.primechanie', 'Примечание')}</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>{t('serialnumbers.deystviya', 'Действия')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {serials.map(sn => (
                                        <tr key={sn.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                {sn.serial_number}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {getStatusBadge(sn.status)}
                                            </td>
                                            <td style={{ padding: '12px' }}>{formatDate(sn.warranty_until)}</td>
                                            <td style={{ padding: '12px', color: '#888', fontSize: '13px' }}>
                                                {sn.notes || (sn.sale_date ? `Продан ${formatDate(sn.sale_date)}` : '-')}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('serialnumbers.udalit', 'Удалить')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                            <Hash size={64} style={{ color: '#ccc', marginBottom: '20px' }} />
                            <h3>{t('serialnumbers.vyberite_tovar', 'Выберите товар')}</h3>
                            <p className="text-muted">{t('serialnumbers.vyberite_tovar_sleva_dlya_prosmotra_seriy', 'Выберите товар слева для просмотра серийных номеров')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Модал добавления */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('serialnumbers.dobavit_seriynye_nomera', '➕ Добавить серийные номера')}</h2>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#666', marginBottom: '16px' }}>
                                Введите серийные номера (каждый с новой строки):
                            </p>
                            <textarea
                                value={newSerials}
                                onChange={(e) => setNewSerials(e.target.value)}
                                rows={10}
                                placeholder={"F4GH78KL90MN\nA1B2C3D4E5F6\nX9Y8Z7W6V5U4"}
                                style={{ fontFamily: 'monospace' }}
                            />
                            <div style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                                Найдено: {newSerials.split('\n').filter(s => s.trim()).length} серийных номеров
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>{t('serialnumbers.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={addSerials}>
                                <Plus size={18} /> Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SerialNumbers;
