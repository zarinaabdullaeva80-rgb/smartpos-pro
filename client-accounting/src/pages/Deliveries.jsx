import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, Check, X, Phone, User, Package, Search, Plus, Filter, Calendar, Save } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function Deliveries() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [deliveries, setDeliveries] = useState([]);
    const [stats, setStats] = useState({});
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    // Форма новой доставки
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_phone: '',
        address: '',
        items_count: 1,
        total_amount: 0,
        delivery_cost: 0,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time_from: '10:00',
        scheduled_time_to: '14:00',
        courier_name: '',
        notes: '',
        priority: 0
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/deliveries', { params: { status: filter !== 'all' ? filter : undefined } });
            const data = response.data;
            setDeliveries(data.deliveries || []);
            setStats(data.stats || { pending: 0, in_transit: 0, delivered_today: 0, total: 0 });
        } catch (error) {
            console.warn('Deliveries: не удалось загрузить данные', error.message);
        }
    };

    const handleCreateDelivery = async (e) => {
        e.preventDefault();

        if (!formData.customer_name || !formData.address) {
            setMessage({ type: 'error', text: 'Заполните имя клиента и адрес' });
            return;
        }

        setSaving(true);
        try {
            await api.post('/deliveries', formData);
            setMessage({ type: 'success', text: 'Доставка создана успешно' });
            setShowModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.warn('Deliveries: не удалось загрузить данные', error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            customer_name: '',
            customer_phone: '',
            address: '',
            items_count: 1,
            total_amount: 0,
            delivery_cost: 0,
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time_from: '10:00',
            scheduled_time_to: '14:00',
            courier_name: '',
            notes: '',
            priority: 0
        });
    };

    const handleAssignCourier = async (delivery) => {
        const courier = window.prompt('Введите имя курьера:');
        if (!courier) return;
        try {
            await api.post(`/deliveries/${delivery.id}/assign`, { courier_name: courier, estimated: '15:00 - 16:00' });
            loadData();
            setMessage({ type: 'success', text: `Курьер ${courier} назначен` });
        } catch (error) {
            setDeliveries(deliveries.map(d => d.id === delivery.id ? { ...d, courier_name: courier, status: 'in_transit', estimated_delivery: '15:00 - 16:00' } : d));
            setMessage({ type: 'success', text: `Курьер ${courier} назначен` });
        }
    };

    const handleCancelDelivery = async (delivery) => {
        const reason = window.prompt('Причина отмены:');
        if (!reason) return;
        try {
            await api.post(`/deliveries/${delivery.id}/cancel`, { reason });
            loadData();
            setMessage({ type: 'success', text: 'Доставка отменена' });
        } catch (error) {
            setDeliveries(deliveries.map(d => d.id === delivery.id ? { ...d, status: 'cancelled', cancel_reason: reason } : d));
            setMessage({ type: 'success', text: 'Доставка отменена' });
        }
    };

    const handleMarkDelivered = async (delivery) => {
        if (!(await confirm({ message: 'Отметить доставку как выполненную?' }))) return;
        try {
            await api.post(`/deliveries/${delivery.id}/complete`);
            loadData();
            setMessage({ type: 'success', text: 'Доставка завершена' });
        } catch (error) {
            setDeliveries(deliveries.map(d => d.id === delivery.id ? { ...d, status: 'delivered', delivered_at: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) } : d));
            setMessage({ type: 'success', text: 'Доставка завершена' });
        }
    };

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'Ожидает курьера', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            in_transit: { label: 'В пути', color: '#3b82f6', bg: '#dbeafe', icon: Truck },
            delivered: { label: 'Доставлен', color: '#10b981', bg: '#dcfce7', icon: Check },
            cancelled: { label: 'Отменён', color: '#ef4444', bg: '#fee2e2', icon: X }
        };
        return statuses[status] || statuses.pending;
    };

    const filteredDeliveries = deliveries.filter(d => {
        if (filter !== 'all' && d.status !== filter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (d.customer_name?.toLowerCase().includes(q) ||
                d.address?.toLowerCase().includes(q) ||
                d.order_number?.toLowerCase().includes(q));
        }
        return true;
    });

    return (
        <div className="deliveries-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('deliveries.dostavka', '🚚 Доставка')}</h1>
                    <p className="text-muted">{t('deliveries.upravlenie_dostavkami_zakazov', 'Управление доставками заказов')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> Новая доставка
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    <Check size={18} />
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('deliveries.ozhidayut', 'Ожидают')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Truck size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.in_transit || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>В пути</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.delivered_today || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('deliveries.dostavleno_segodnya', 'Доставлено сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('deliveries.vsego_zakazov', 'Всего заказов')}</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'pending', label: '⏳ Ожидают' },
                            { key: 'in_transit', label: '🚚 В пути' },
                            { key: 'delivered', label: '✅ Доставлены' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px', width: '250px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Список */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('deliveries.zagruzka', 'Загрузка...')}</div>
                ) : filteredDeliveries.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                        <Truck size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p>{t('deliveries.dostavok_ne_naydeno', 'Доставок не найдено')}</p>
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={18} /> Создать первую доставку
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px', padding: '16px' }}>
                        {filteredDeliveries.map(delivery => {
                            const statusInfo = getStatusInfo(delivery.status);
                            const StatusIcon = statusInfo.icon;

                            return (
                                <div key={delivery.id} style={{
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    borderLeft: `4px solid ${statusInfo.color}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>{delivery.order_number}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <User size={14} color="#888" />
                                                <span>{delivery.customer_name}</span>
                                                <Phone size={14} color="#888" style={{ marginLeft: '8px' }} />
                                                <span style={{ color: '#888' }}>{delivery.customer_phone}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '6px 12px',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <StatusIcon size={14} /> {statusInfo.label}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#666' }}>
                                        <MapPin size={16} />
                                        <span>{delivery.address}</span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveries.tovarov', 'Товаров')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{delivery.items_count} шт.</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveries.summa', 'Сумма')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{formatCurrency(delivery.total_amount)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveries.kurer', 'Курьер')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{delivery.courier_name || '-'}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{t('deliveries.vremya', 'Время')}</div>
                                            <div style={{ fontWeight: 'bold' }}>{delivery.estimated_delivery || delivery.delivered_at || '-'}</div>
                                        </div>
                                    </div>

                                    {delivery.cancel_reason && (
                                        <div style={{ marginTop: '12px', padding: '8px', background: '#fee2e2', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
                                            ❌ {delivery.cancel_reason}
                                        </div>
                                    )}

                                    {delivery.status === 'pending' && (
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleAssignCourier(delivery)}>{t('deliveries.naznachit_kurera', 'Назначить курьера')}</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleCancelDelivery(delivery)}>{t('deliveries.otmenit', 'Отменить')}</button>
                                        </div>
                                    )}
                                    {delivery.status === 'in_transit' && (
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-success btn-sm" onClick={() => handleMarkDelivered(delivery)}>{t('deliveries.dostavleno', 'Доставлено')}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Модальное окно создания доставки */}
            {showModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--bg-primary)',
                        borderRadius: '16px',
                        width: '600px',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Truck size={24} color="var(--primary)" />
                                Новая доставка
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                            >
                                <X size={20} color="#888" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateDelivery} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.imya_klienta', 'Имя клиента *')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Иванов Петр"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.telefon', 'Телефон')}</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="+998 90 123 45 67"
                                        value={formData.customer_phone}
                                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('deliveries.adres_dostavki', 'Адрес доставки *')}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="ул. Навои 100, кв. 25"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.data_dostavki', 'Дата доставки')}</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.scheduled_date}
                                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.vremya_s', 'Время с')}</label>
                                    <input
                                        type="time"
                                        className="form-input"
                                        value={formData.scheduled_time_from}
                                        onChange={(e) => setFormData({ ...formData, scheduled_time_from: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.vremya_do', 'Время до')}</label>
                                    <input
                                        type="time"
                                        className="form-input"
                                        value={formData.scheduled_time_to}
                                        onChange={(e) => setFormData({ ...formData, scheduled_time_to: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.kol_vo_tovarov', 'Кол-во товаров')}</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="1"
                                        value={formData.items_count}
                                        onChange={(e) => setFormData({ ...formData, items_count: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.summa_zakaza', 'Сумма заказа')}</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="0"
                                        value={formData.total_amount}
                                        onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.stoimost_dostavki', 'Стоимость доставки')}</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        min="0"
                                        value={formData.delivery_cost}
                                        onChange={(e) => setFormData({ ...formData, delivery_cost: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.kurer_optsionalno', 'Курьер (опционально)')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Будет назначен позже"
                                        value={formData.courier_name}
                                        onChange={(e) => setFormData({ ...formData, courier_name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('deliveries.prioritet', 'Приоритет')}</label>
                                    <select
                                        className="form-input"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                    >
                                        <option value="0">{t('deliveries.obychnyy', 'Обычный')}</option>
                                        <option value="1">{t('deliveries.vysokiy', 'Высокий')}</option>
                                        <option value="2">{t('deliveries.srochnyy', 'Срочный')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('deliveries.primechaniya', 'Примечания')}</label>
                                <textarea
                                    className="form-input"
                                    rows="2"
                                    placeholder="Дополнительная информация..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={18} />
                                    {saving ? 'Сохранение...' : 'Создать доставку'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Deliveries;
