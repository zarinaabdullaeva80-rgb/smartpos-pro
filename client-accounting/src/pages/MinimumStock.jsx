import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, Settings, Save, Search, Edit, Check, X } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useI18n } from '../i18n';

function MinimumStock() {
    const { t } = useI18n();
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setItems(apiData.items || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('MinimumStock: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            critical: { label: 'Критично', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle },
            warning: { label: 'Внимание', color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
            ok: { label: 'В норме', color: '#10b981', bg: '#dcfce7', icon: Check }
        };
        return statuses[status] || statuses.ok;
    };

    const [message, setMessage] = useState(null);
    const [editValues, setEditValues] = useState({});

    const handleEdit = (item) => {
        setEditingId(item.id);
        setEditValues({
            min: item.min,
            optimal: item.optimal,
            max: item.max
        });
    };

    const handleSaveItem = (itemId) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                const newItem = {
                    ...item,
                    min: editValues.min,
                    optimal: editValues.optimal,
                    max: editValues.max,
                    status: item.current < editValues.min ? 'critical' :
                        item.current < editValues.optimal ? 'warning' : 'ok'
                };
                return newItem;
            }
            return item;
        }));
        setEditingId(null);
        setMessage({ type: 'success', text: 'Пороги обновлены!' });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSaveAll = () => {
        // Сохранение на сервер (в реальности отправить на API)
        localStorage.setItem('minimumStock', JSON.stringify(items));
        setMessage({ type: 'success', text: 'Все пороги сохранены!' });
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="minimum-stock-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('minimumstock.minimalnye_ostatki', '📉 Минимальные остатки')}</h1>
                    <p className="text-muted">{t('minimumstock.nastroyka_porogov_zapasov', 'Настройка порогов запасов')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleSaveAll}>
                    <Save size={18} /> Сохранить всё
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_products}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('minimumstock.vsego_tovarov', 'Всего товаров')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#fee2e2' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{stats.critical}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Критично</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#fef3c7' }}>
                    <AlertTriangle size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.warning}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Внимание</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dcfce7' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.ok}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>В норме</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('minimumstock.nastroyka_porogov', '📋 Настройка порогов')}</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select>
                            <option>{t('minimumstock.vse_kategorii', 'Все категории')}</option>
                            <option>{t('minimumstock.smartfony', 'Смартфоны')}</option>
                            <option>{t('minimumstock.noutbuki', 'Ноутбуки')}</option>
                            <option>{t('minimumstock.naushniki', 'Наушники')}</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '200px' }} />
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('minimumstock.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('minimumstock.tovar', 'Товар')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.tekuschiy', 'Текущий')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.minimum', 'Минимум')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.optimum', 'Оптимум')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.maksimum', 'Максимум')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('minimumstock.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const statusInfo = getStatusInfo(item.status);
                                const StatusIcon = statusInfo.icon;
                                const isEditing = editingId === item.id;

                                return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{item.product}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{item.sku} • {item.category}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: item.current < item.min ? '#ef4444' : '#10b981'
                                            }}>
                                                {item.current}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.min}
                                                    onChange={e => setEditValues({ ...editValues, min: parseInt(e.target.value) || 0 })}
                                                    style={{ width: '60px', textAlign: 'center' }}
                                                />
                                            ) : (
                                                <span style={{ color: '#ef4444' }}>{item.min}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.optimal}
                                                    onChange={e => setEditValues({ ...editValues, optimal: parseInt(e.target.value) || 0 })}
                                                    style={{ width: '60px', textAlign: 'center' }}
                                                />
                                            ) : (
                                                <span style={{ color: '#3b82f6' }}>{item.optimal}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValues.max}
                                                    onChange={e => setEditValues({ ...editValues, max: parseInt(e.target.value) || 0 })}
                                                    style={{ width: '60px', textAlign: 'center' }}
                                                />
                                            ) : (
                                                <span style={{ color: '#10b981' }}>{item.max}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button className="btn btn-sm btn-primary" onClick={() => handleSaveItem(item.id)}><Check size={14} /></button>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)}><Edit size={14} /></button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default MinimumStock;
