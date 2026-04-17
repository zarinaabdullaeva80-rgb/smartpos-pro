import React, { useState, useEffect } from 'react';
import { Users2, Phone, Mail, TrendingUp, DollarSign, Target, Plus, Search, Edit2, Trash2, X, Save, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { crmAPI } from '../services/api';
import ExportButton from '../components/ExportButton';
import { useI18n } from '../i18n';
import { useConfirm } from '../components/ConfirmDialog';

const CRM = () => {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        discount: 0,
        notes: ''
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const response = await crmAPI.getCustomers({ limit: 500 });
            setCustomers(response.data?.customers || response.data || []);
        } catch (error) {
            console.error('Ошибка загрузки клиентов:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setMessage({ type: 'error', text: 'Имя клиента обязательно' });
            return;
        }
        try {
            if (editingCustomer) {
                await crmAPI.updateCustomer(editingCustomer.id, formData);
                setMessage({ type: 'success', text: '✅ Клиент обновлён' });
            } else {
                await crmAPI.createCustomer(formData);
                setMessage({ type: 'success', text: '✅ Клиент создан' });
            }
            setShowModal(false);
            setEditingCustomer(null);
            resetForm();
            loadCustomers();
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: '❌ Ошибка сохранения: ' + (error.response?.data?.error || error.message) });
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || '',
            discount: customer.discount || 0,
            notes: customer.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (customer) => {
        if (!(await confirm({ message: `Удалить клиента "${customer.name}"?` }))) return;
        try {
            await crmAPI.updateCustomer(customer.id, { deleted: true });
            loadCustomers();
            setMessage({ type: 'success', text: 'Клиент удалён' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка удаления' });
        }
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '', email: '', discount: 0, notes: '' });
    };

    const openCreateModal = () => {
        setEditingCustomer(null);
        resetForm();
        setShowModal(true);
    };

    // Фильтрация
    const filteredCustomers = customers.filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (c.name?.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.card_number?.includes(q));
    });

    // Статистика
    const totalPoints = customers.reduce((sum, c) => sum + parseFloat(c.loyalty_points || 0), 0);
    const withPhone = customers.filter(c => c.phone).length;
    const withEmail = customers.filter(c => c.email).length;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users2 size={28} />
                        CRM — {t('crm.upravlenie_klientami', 'Управление клиентами')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                        {t('crm.baza_klientov_i_loyalnost', 'База клиентов, баллы лояльности и контактные данные')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <ExportButton
                        data={customers}
                        filename="Клиенты_CRM"
                        sheetName="Клиенты"
                        columns={{
                            name: 'Имя',
                            phone: 'Телефон',
                            email: 'Email',
                            discount: 'Скидка %',
                            loyalty_points: 'Баллы',
                            card_number: 'Карта',
                            created_at: 'Дата регистрации'
                        }}
                    />
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={18} /> {t('crm.novyy_klient', 'Новый клиент')}
                    </button>
                </div>
            </div>

            {/* Уведомление */}
            {message && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                    background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#6366f1' }}>
                        <Users2 size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{customers.length}</div>
                        <div className="stat-label">{t('crm.vsego_klientov', 'Всего клиентов')}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#10b981' }}>
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{totalPoints.toLocaleString()}</div>
                        <div className="stat-label">{t('crm.obschie_bally', 'Общие баллы')}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#3b82f6' }}>
                        <Phone size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{withPhone}</div>
                        <div className="stat-label">{t('crm.s_telefonom', 'С телефоном')}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#f59e0b' }}>
                        <Mail size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{withEmail}</div>
                        <div className="stat-label">{t('crm.s_email', 'С email')}</div>
                    </div>
                </div>
            </div>

            {/* Поиск */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder={t('crm.poisk_klienta', 'Поиск по имени, телефону, email...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px', width: '100%' }}
                        />
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {t('crm.pokazano', 'Показано')}: {filteredCustomers.length} {t('crm.iz', 'из')} {customers.length}
                    </div>
                </div>
            </div>

            {/* Таблица клиентов */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('crm.zagruzka', 'Загрузка...')}</div>
                ) : filteredCustomers.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                        <Users2 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                        <p>{searchQuery ? t('crm.nichego_ne_naydeno', 'Ничего не найдено') : t('crm.net_klientov', 'Клиентов пока нет')}</p>
                        {!searchQuery && (
                            <button className="btn btn-primary" onClick={openCreateModal} style={{ marginTop: '12px' }}>
                                <Plus size={18} /> {t('crm.dobavit_pervogo', 'Добавить первого клиента')}
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('crm.imya', 'Имя')}</th>
                                <th>{t('crm.telefon', 'Телефон')}</th>
                                <th>Email</th>
                                <th>{t('crm.karta', 'Карта')}</th>
                                <th>{t('crm.bally', 'Баллы')}</th>
                                <th>{t('crm.skidka', 'Скидка')}</th>
                                <th>{t('crm.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{customer.name}</div>
                                        {customer.notes && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {customer.notes.substring(0, 40)}{customer.notes.length > 40 ? '...' : ''}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {customer.phone ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Phone size={14} color="#888" />
                                                {customer.phone}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {customer.email ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Mail size={14} color="#888" />
                                                {customer.email}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {customer.card_number ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1',
                                                padding: '3px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600
                                            }}>
                                                <CreditCard size={14} /> {customer.card_number}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span style={{
                                            fontWeight: 700,
                                            color: parseFloat(customer.loyalty_points || 0) > 0 ? '#10b981' : 'var(--text-muted)'
                                        }}>
                                            {parseFloat(customer.loyalty_points || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td>
                                        {parseFloat(customer.discount || 0) > 0 ? (
                                            <span style={{
                                                background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                                                padding: '3px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600
                                            }}>
                                                {customer.discount}%
                                            </span>
                                        ) : (
                                            <span style={{ color: '#666' }}>0%</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => handleEdit(customer)}
                                                title={t('crm.redaktirovat', 'Редактировать')}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(customer)}
                                                title={t('crm.udalit', 'Удалить')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Users2 size={24} />
                                {editingCustomer ? t('crm.redaktirovat_klienta', 'Редактировать клиента') : t('crm.novyy_klient', 'Новый клиент')}
                            </h2>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label>{t('crm.imya_klienta', 'Имя клиента *')}</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Иванов Пётр Сергеевич"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>{t('crm.telefon', 'Телефон')}</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+998 90 123 45 67"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="client@example.com"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>{t('crm.skidka_procent', 'Скидка (%)')}</label>
                                    <input
                                        type="number"
                                        value={formData.discount}
                                        onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                        min="0" max="100" step="0.5"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('crm.zametki', 'Заметки')}</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Дополнительная информация о клиенте..."
                                    rows={3}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    {t('crm.otmena', 'Отмена')}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={16} />
                                    {editingCustomer ? t('crm.sohranit', 'Сохранить') : t('crm.sozdat', 'Создать')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRM;
