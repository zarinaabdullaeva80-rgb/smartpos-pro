import React, { useState, useEffect } from 'react';
import { Tag, Percent, Calendar, Plus, Search, Check, Clock, Pause, Play, Gift, Zap, Users, Package, X, Edit, Trash2 } from 'lucide-react';
import { loyaltyAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';



function Promotions() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [promotions, setPromotions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'percent',
        value: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        conditions: '',
        status: 'active'
    });

    useEffect(() => { loadData(); }, []);

    const calcStats = (list) => ({
        active: list.filter(p => p.status === 'active').length,
        total_usage: list.reduce((sum, p) => sum + (p.usage_count || 0), 0),
        total_revenue: list.reduce((sum, p) => sum + (p.revenue || 0), 0),
        avg_discount: Math.round(list.filter(p => p.type === 'percent').reduce((sum, p) => sum + (p.value || 0), 0) / (list.filter(p => p.type === 'percent').length || 1)) || 0
    });

    const loadData = async () => {
        try {
            const apiRes = await loyaltyAPI.getAll();
            const apiData = apiRes.data || apiRes;
            const list = apiData.promotions || [];
            setPromotions(list);
            setStats(apiData.stats || calcStats(list));
        } catch (err) {
            console.warn('Promotions: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleSavePromotion = async () => {
        if (!formData.name || (formData.type !== 'bogo' && !formData.value)) {
            setMessage({ type: 'error', text: 'Заполните обязательные поля' });
            return;
        }

        try {
            if (editingPromo) {
                await api.put(`/promotions/${editingPromo.id}`, formData);
            } else {
                await api.post('/promotions', formData);
            }
            setMessage({ type: 'success', text: editingPromo ? 'Акция обновлена' : 'Акция создана' });
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            // Simulate success
            if (editingPromo) {
                setPromotions(promotions.map(p => p.id === editingPromo.id ? { ...p, ...formData } : p));
            } else {
                const newPromo = { id: Date.now(), ...formData, usage_count: 0, revenue: 0 };
                setPromotions([newPromo, ...promotions]);
            }
            setMessage({ type: 'success', text: editingPromo ? 'Акция обновлена' : 'Акция создана' });
            setShowModal(false);
            resetForm();
        }
    };

    const handleToggleStatus = async (promo) => {
        const newStatus = promo.status === 'active' ? 'paused' : 'active';
        try {
            await api.put(`/promotions/${promo.id}/status`, { status: newStatus });
            loadData();
        } catch (error) {
            setPromotions(promotions.map(p => p.id === promo.id ? { ...p, status: newStatus } : p));
        }
        setMessage({ type: 'success', text: `Акция ${newStatus === 'active' ? 'активирована' : 'приостановлена'}` });
    };

    const handleDeletePromotion = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить эту акцию?' }))) return;
        try {
            await api.delete(`/promotions/${id}`);
            loadData();
            setMessage({ type: 'success', text: 'Акция удалена' });
        } catch (error) {
            setPromotions(promotions.filter(p => p.id !== id));
            setMessage({ type: 'success', text: 'Акция удалена' });
        }
    };

    const handleEdit = (promo) => {
        setEditingPromo(promo);
        setFormData({
            name: promo.name,
            type: promo.type,
            value: promo.value || '',
            start_date: promo.start_date || '',
            end_date: promo.end_date || '',
            conditions: promo.conditions || '',
            status: promo.status
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({ name: '', type: 'percent', value: '', start_date: new Date().toISOString().split('T')[0], end_date: '', conditions: '', status: 'active' });
        setEditingPromo(null);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : 'Бессрочно';

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Активна', color: '#10b981', bg: '#dcfce7', icon: Play },
            paused: { label: 'Приостановлена', color: '#f59e0b', bg: '#fef3c7', icon: Pause },
            ended: { label: 'Завершена', color: '#888', bg: '#f3f4f6', icon: Check },
            scheduled: { label: 'Запланирована', color: '#3b82f6', bg: '#dbeafe', icon: Clock }
        };
        return statuses[status] || statuses.active;
    };

    const getTypeInfo = (type) => {
        const types = {
            percent: { label: 'Процент', icon: Percent },
            fixed: { label: 'Фикс. сумма', icon: Tag },
            bogo: { label: 'Бесплатный товар', icon: Gift }
        };
        return types[type] || types.percent;
    };

    const filteredPromotions = promotions.filter(p =>
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="promotions-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('promotions.aktsii_i_skidki', '🎁 Акции и скидки')}</h1>
                    <p className="text-muted">{t('promotions.upravlenie_promo_kampaniyami', 'Управление промо-кампаниями')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={18} /> Создать акцию
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Zap size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('promotions.aktivnyh_aktsiy', 'Активных акций')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_usage || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('promotions.ispolzovaniy', 'Использований')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Tag size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.total_revenue || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('promotions.vyruchka_s_aktsiy', 'Выручка с акций')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Percent size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_discount || 0}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('promotions.srednyaya_skidka', 'Средняя скидка')}</div>
                </div>
            </div>

            {/* Список акций */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('promotions.vse_aktsii', '📋 Все акции')}</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px', width: '250px' }}
                        />
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('promotions.zagruzka', 'Загрузка...')}</div>
                ) : filteredPromotions.length === 0 ? (
                    <div className="empty-state">
                        <Gift size={64} className="text-muted" />
                        <h3>{t('promotions.aktsii_ne_naydeny', 'Акции не найдены')}</h3>
                        <p className="text-muted">{t('promotions.sozdayte_pervuyu_aktsiyu', 'Создайте первую акцию')}</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('promotions.nazvanie', 'Название')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('promotions.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('promotions.period', 'Период')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('promotions.ispolzovano', 'Использовано')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('promotions.vyruchka', 'Выручка')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('promotions.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('promotions.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPromotions.map(promo => {
                                const statusInfo = getStatusInfo(promo.status);
                                const typeInfo = getTypeInfo(promo.type);
                                const StatusIcon = statusInfo.icon;
                                const TypeIcon = typeInfo.icon;

                                return (
                                    <tr key={promo.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{promo.name}</div>
                                            {promo.conditions && (
                                                <div style={{ fontSize: '12px', color: '#888' }}>{promo.conditions}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <TypeIcon size={16} color="#888" />
                                                <span>
                                                    {promo.type === 'percent' && `${promo.value}%`}
                                                    {promo.type === 'fixed' && formatCurrency(promo.value)}
                                                    {promo.type === 'bogo' && 'BOGO'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="#888" />
                                                {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {promo.usage_count || 0}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(promo.revenue || 0)}
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
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                {promo.status !== 'ended' && (
                                                    <button
                                                        className={`btn btn-sm ${promo.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                                                        onClick={() => handleToggleStatus(promo)}
                                                        title={promo.status === 'active' ? 'Приостановить' : 'Активировать'}
                                                    >
                                                        {promo.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(promo)} title={t('promotions.redaktirovat', 'Редактировать')}>
                                                    <Edit size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDeletePromotion(promo.id)} title={t('promotions.udalit', 'Удалить')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{editingPromo ? 'Редактировать акцию' : 'Создать акцию'}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('promotions.nazvanie_aktsii', 'Название акции *')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Новогодняя распродажа"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>{t('promotions.tip_skidki', 'Тип скидки')}</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="percent">Процент</option>
                                        <option value="fixed">{t('promotions.fiksirovannaya_summa', 'Фиксированная сумма')}</option>
                                        <option value="bogo">{t('promotions.kupi_poluchi', 'Купи X получи Y')}</option>
                                    </select>
                                </div>
                                {formData.type !== 'bogo' && (
                                    <div className="form-group">
                                        <label>{t('promotions.znachenie', 'Значение *')}</label>
                                        <input
                                            type="number"
                                            value={formData.value}
                                            onChange={e => setFormData({ ...formData, value: e.target.value })}
                                            placeholder={formData.type === 'percent' ? '20' : '500000'}
                                        />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>{t('promotions.data_nachala', 'Дата начала')}</label>
                                    <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>{t('promotions.data_okonchaniya', 'Дата окончания')}</label>
                                    <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('promotions.usloviya_primeneniya', 'Условия применения')}</label>
                                <input
                                    type="text"
                                    value={formData.conditions}
                                    onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                                    placeholder="Например: От 1 000 000 сум"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn btn-secondary">{t('promotions.otmena', 'Отмена')}</button>
                            <button onClick={handleSavePromotion} className="btn btn-primary">
                                {editingPromo ? <Check size={16} /> : <Plus size={16} />}
                                {editingPromo ? 'Сохранить' : 'Создать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Promotions;
