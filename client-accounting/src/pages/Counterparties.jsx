import React, { useState, useEffect } from 'react';
import { counterpartiesAPI } from '../services/api';
import { Plus, Users, Building2, Phone, Mail, CreditCard, TrendingUp, TrendingDown, X, Edit, Trash2, Eye } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';

import { useI18n } from '../i18n';

function Counterparties() {
    const { handleSuccess, handleError } = useActionHandler();
    const { t } = useI18n();
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedCounterparty, setSelectedCounterparty] = useState(null);
    const [activeTab, setActiveTab] = useState('general'); // general, history, balance, stats
    const [history, setHistory] = useState([]);
    const [balance, setBalance] = useState(null);
    const [stats, setStats] = useState(null);
    const [filterType, setFilterType] = useState('all'); // all, customer, supplier
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: 'customer',
        inn: '',
        kpp: '',
        address: '',
        phone: '',
        email: '',
        contactPerson: '',
        paymentTerms: 0,
        creditLimit: 0,
        isActive: true
    });

    useEffect(() => {
        loadCounterparties();
    }, [filterType, searchTerm]);

    const loadCounterparties = async () => {
        try {
            const params = {};
            if (filterType !== 'all') params.type = filterType;
            if (searchTerm) params.search = searchTerm;

            const response = await counterpartiesAPI.getAll(params);
            setCounterparties(response.data.counterparties);
        } catch (error) {
            console.error('Ошибка загрузки контрагентов:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        const newCode = `КТ-${Date.now()}`;
        setFormData({
            code: newCode,
            name: '',
            type: 'customer',
            inn: '',
            kpp: '',
            address: '',
            phone: '',
            email: '',
            contactPerson: '',
            paymentTerms: 0,
            creditLimit: 0,
            isActive: true
        });
        setShowModal(true);
    };

    const handleEdit = (counterparty) => {
        setFormData({
            code: counterparty.code,
            name: counterparty.name,
            type: counterparty.type,
            inn: counterparty.inn || '',
            kpp: counterparty.kpp || '',
            address: counterparty.address || '',
            phone: counterparty.phone || '',
            email: counterparty.email || '',
            contactPerson: counterparty.contact_person || '',
            paymentTerms: counterparty.payment_terms || 0,
            creditLimit: parseFloat(counterparty.credit_limit) || 0,
            isActive: counterparty.is_active
        });
        setSelectedCounterparty(counterparty);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (selectedCounterparty) {
                await counterpartiesAPI.update(selectedCounterparty.id, formData);
                handleSuccess('Контрагент успешно обновлён');
            } else {
                await counterpartiesAPI.create(formData);
                handleSuccess('Контрагент успешно создан');
            }
            setShowModal(false);
            setSelectedCounterparty(null);
            loadCounterparties();
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            handleError(error.response?.data?.error || 'Ошибка сохранения контрагента');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить контрагента?')) return;

        try {
            await counterpartiesAPI.delete(id);
            handleSuccess('Контрагент удалён');
            loadCounterparties();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            handleError(error.response?.data?.error || 'Ошибка удаления контрагента');
        }
    };

    const handleViewDetails = async (counterparty) => {
        setSelectedCounterparty(counterparty);
        setActiveTab('general');
        setShowDetailModal(true);

        // Загружаем дополнительные данные
        try {
            const [historyRes, balanceRes, statsRes] = await Promise.all([
                counterpartiesAPI.getHistory(counterparty.id, { limit: 50 }),
                counterpartiesAPI.getBalance(counterparty.id),
                counterpartiesAPI.getStats(counterparty.id)
            ]);

            setHistory(historyRes.data.history);
            setBalance(balanceRes.data.balance);
            setStats(statsRes.data.stats);
        } catch (error) {
            console.error('Ошибка загрузки деталей:', error);
        }
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getTypeBadge = (type) => {
        const types = {
            customer: { label: 'Покупатель', class: 'badge-primary' },
            supplier: { label: 'Поставщик', class: 'badge-success' },
            both: { label: 'Покупатель/Поставщик', class: 'badge-info' }
        };
        const t = types[type] || { label: type, class: 'badge-secondary' };
        return <span className={`badge ${t.class}`}>{t.label}</span>;
    };

    const getStatusBadge = (status) => {
        const statuses = {
            draft: { label: 'Черновик', class: 'badge-warning' },
            confirmed: { label: 'Проведен', class: 'badge-success' },
            paid: { label: 'Оплачен', class: 'badge-success' }
        };
        const s = statuses[status] || { label: status, class: 'badge-secondary' };
        return <span className={`badge ${s.class}`}>{s.label}</span>;
    };

    return (
        <div className="counterparties-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('counterparties.title')}</h1>
                    <p className="text-muted">{t('counterparties.subtitle', 'Управление клиентами и поставщиками')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={counterparties}
                        filename="Counterparties"
                        sheetName="Counterparties"
                        folder="counterparties"
                        columns={{
                            code: t('common.code', 'Код'),
                            name: t('common.name', 'Название'),
                            type: t('common.type', 'Тип'),
                            inn: t('counterparties.inn', 'ИНН'),
                            phone: t('common.phone', 'Телефон'),
                            email: 'Email',
                            address: t('counterparties.address', 'Адрес'),
                            credit_limit: t('counterparties.creditLimit', 'Кредитный лимит'),
                            is_active: t('common.active', 'Активен')
                        }}
                    />
                    <button className="btn btn-primary" onClick={handleCreateNew}>
                        <Plus size={20} />
                        {t('counterparties.newCounterparty', 'Новый контрагент')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-3">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterType('all')}
                        >
                            <Users size={16} />
                            {t('common.all', 'Все')}
                        </button>
                        <button
                            className={`btn ${filterType === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterType('customer')}
                        >
                            <Building2 size={16} />
                            {t('counterparties.customers', 'Покупатели')}
                        </button>
                        <button
                            className={`btn ${filterType === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterType('supplier')}
                        >
                            <Building2 size={16} />
                            {t('counterparties.suppliers', 'Поставщики')}
                        </button>
                    </div>

                    <div style={{ flex: 1, maxWidth: '400px' }}>
                        <input
                            type="text"
                            placeholder="Поиск по названию, ИНН, коду..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : counterparties.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="text-muted" />
                        <h3>{t('counterparties.kontragenty_ne_naydeny', 'Контрагенты не найдены')}</h3>
                        <p className="text-muted">{t('counterparties.sozdayte_pervogo_kontragenta', 'Создайте первого контрагента')}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('counterparties.kod', 'Код')}</th>
                                <th>{t('counterparties.nazvanie', 'Название')}</th>
                                <th>{t('counterparties.tip', 'Тип')}</th>
                                <th>{t('counterparties.inn', 'ИНН')}</th>
                                <th>{t('counterparties.telefon', 'Телефон')}</th>
                                <th>Email</th>
                                <th>{t('counterparties.status', 'Статус')}</th>
                                <th>{t('counterparties.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {counterparties.map((cp) => (
                                <tr key={cp.id}>
                                    <td><code>{cp.code}</code></td>
                                    <td><strong>{cp.name}</strong></td>
                                    <td>{getTypeBadge(cp.type)}</td>
                                    <td>{cp.inn || '—'}</td>
                                    <td>
                                        {cp.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Phone size={14} />
                                                {cp.phone}
                                            </div>
                                        )}
                                        {!cp.phone && '—'}
                                    </td>
                                    <td>
                                        {cp.email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Mail size={14} />
                                                {cp.email}
                                            </div>
                                        )}
                                        {!cp.email && '—'}
                                    </td>
                                    <td>
                                        {cp.is_active ? (
                                            <span className="badge badge-success">{t('counterparties.aktiven', 'Активен')}</span>
                                        ) : (
                                            <span className="badge badge-secondary">{t('counterparties.neaktiven', 'Неактивен')}</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleViewDetails(cp)}
                                                title={t('counterparties.podrobnee', 'Подробнее')}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleEdit(cp)}
                                                title={t('counterparties.redaktirovat', 'Редактировать')}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(cp.id)}
                                                title={t('counterparties.udalit', 'Удалить')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h2>{selectedCounterparty ? 'Редактирование контрагента' : 'Новый контрагент'}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('counterparties.kod', 'Код')}</label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('counterparties.tip', 'Тип')}</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                            required
                                        >
                                            <option value="customer">Покупатель</option>
                                            <option value="supplier">Поставщик</option>
                                            <option value="both">Покупатель/Поставщик</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('counterparties.nazvanie', 'Название *')}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('counterparties.inn', 'ИНН')}</label>
                                        <input
                                            type="text"
                                            value={formData.inn}
                                            onChange={e => setFormData({ ...formData, inn: e.target.value })}
                                            maxLength="12"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('counterparties.kpp', 'КПП')}</label>
                                        <input
                                            type="text"
                                            value={formData.kpp}
                                            onChange={e => setFormData({ ...formData, kpp: e.target.value })}
                                            maxLength="9"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('counterparties.adres', 'Адрес')}</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        rows="2"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('counterparties.telefon', 'Телефон')}</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('counterparties.kontaktnoe_litso', 'Контактное лицо')}</label>
                                    <input
                                        type="text"
                                        value={formData.contactPerson}
                                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{t('counterparties.otsrochka_platezha_dney', 'Отсрочка платежа (дней)')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.paymentTerms}
                                            onChange={e => setFormData({ ...formData, paymentTerms: parseInt(e.target.value) })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('counterparties.kreditnyy_limit_sum', 'Кредитный лимит (сум)')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.creditLimit}
                                            onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        {t('counterparties.aktiven', 'Активен')}
                                    </label>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {selectedCounterparty ? t('common.save') : t('common.create', 'Создать')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal with Tabs */}
            {showDetailModal && selectedCounterparty && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{selectedCounterparty.name}</h2>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    {getTypeBadge(selectedCounterparty.type)}
                                    <code>{selectedCounterparty.code}</code>
                                </div>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="btn-close">×</button>
                        </div>

                        {/* Tabs */}
                        <div className="tabs">
                            <button
                                className={`tab ${activeTab === 'general' ? 'active' : ''}`}
                                onClick={() => setActiveTab('general')}
                            >
                                Общее
                            </button>
                            <button
                                className={`tab ${activeTab === 'balance' ? 'active' : ''}`}
                                onClick={() => setActiveTab('balance')}
                            >
                                Взаиморасчеты
                            </button>
                            <button
                                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                                onClick={() => setActiveTab('history')}
                            >
                                История ({history.length})
                            </button>
                            <button
                                className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                                onClick={() => setActiveTab('stats')}
                            >
                                Статистика
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <div className="tab-content">
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <label>{t('counterparties.inn', 'ИНН')}</label>
                                            <div>{selectedCounterparty.inn || '—'}</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.kpp', 'КПП')}</label>
                                            <div>{selectedCounterparty.kpp || '—'}</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.adres', 'Адрес')}</label>
                                            <div>{selectedCounterparty.address || '—'}</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.telefon', 'Телефон')}</label>
                                            <div>{selectedCounterparty.phone || '—'}</div>
                                        </div>

                                        <div className="info-item">
                                            <label>Email</label>
                                            <div>{selectedCounterparty.email || '—'}</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.kontaktnoe_litso', 'Контактное лицо')}</label>
                                            <div>{selectedCounterparty.contact_person || '—'}</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.otsrochka_platezha', 'Отсрочка платежа')}</label>
                                            <div>{selectedCounterparty.payment_terms || 0} дней</div>
                                        </div>
                                        <div className="info-item">
                                            <label>{t('counterparties.kreditnyy_limit', 'Кредитный лимит')}</label>
                                            <div>{formatCurrency(selectedCounterparty.credit_limit)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Balance Tab */}
                            {activeTab === 'balance' && balance && (
                                <div className="tab-content">
                                    <div className="grid grid-2 mb-3">
                                        <div className="stat-card glass">
                                            <div className="stat-content">
                                                <div className="stat-label">{t('counterparties.debitorskaya_zadolzhennost', 'Дебиторская задолженность')}</div>
                                                <div className="stat-value" style={{ color: balance.receivable > 0 ? '#10b981' : '#64748b' }}>
                                                    {formatCurrency(balance.receivable)}
                                                </div>
                                                <div className="stat-meta">{t('counterparties.nam_dolzhny', 'Нам должны')}</div>
                                            </div>
                                        </div>

                                        <div className="stat-card glass">
                                            <div className="stat-content">
                                                <div className="stat-label">{t('counterparties.kreditorskaya_zadolzhennost', 'Кредиторская задолженность')}</div>
                                                <div className="stat-value" style={{ color: balance.payable > 0 ? '#ef4444' : '#64748b' }}>
                                                    {formatCurrency(balance.payable)}
                                                </div>
                                                <div className="stat-meta">{t('counterparties.my_dolzhny', 'Мы должны')}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card mb-3">
                                        <h3>{t('counterparties.chistyy_balans', 'Чистый баланс')}</h3>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: balance.netBalance >= 0 ? '#10b981' : '#ef4444' }}>
                                            {balance.netBalance >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
                                            {formatCurrency(Math.abs(balance.netBalance))}
                                        </div>
                                        <p className="text-muted">
                                            {balance.netBalance > 0 && 'Положительный баланс (нам должны)'}
                                            {balance.netBalance < 0 && 'Отрицательный баланс (мы должны)'}
                                            {balance.netBalance === 0 && 'Баланс нулевой'}
                                        </p>
                                    </div>

                                    <div className="grid grid-2">
                                        <div className="card">
                                            <h4>{t('counterparties.prodazhi', 'Продажи')}</h4>
                                            <p>Всего: {formatCurrency(balance.totalSales)}</p>
                                            <p>Оплачено: {formatCurrency(balance.incomingPayments)}</p>
                                            <p className="text-muted">{balance.salesCount} документов</p>
                                        </div>

                                        <div className="card">
                                            <h4>{t('counterparties.zakupki', 'Закупки')}</h4>
                                            <p>Всего: {formatCurrency(balance.totalPurchases)}</p>
                                            <p>Оплачено: {formatCurrency(balance.outgoingPayments)}</p>
                                            <p className="text-muted">{balance.purchasesCount} документов</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* History Tab */}
                            {activeTab === 'history' && (
                                <div className="tab-content">
                                    {history.length === 0 ? (
                                        <div className="empty-state">
                                            <p>{t('counterparties.net_operatsiy', 'Нет операций')}</p>
                                        </div>
                                    ) : (
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>{t('counterparties.data', 'Дата')}</th>
                                                    <th>{t('counterparties.tip', 'Тип')}</th>
                                                    <th>{t('counterparties.nomer', 'Номер')}</th>
                                                    <th>{t('counterparties.summa', 'Сумма')}</th>
                                                    <th>{t('counterparties.status', 'Статус')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{new Date(item.document_date).toLocaleDateString('ru-RU')}</td>
                                                        <td>{item.type_label}</td>
                                                        <td><code>{item.document_number}</code></td>
                                                        <td><strong>{formatCurrency(item.amount)}</strong></td>
                                                        <td>{getStatusBadge(item.status)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            {/* Stats Tab */}
                            {activeTab === 'stats' && stats && (
                                <div className="tab-content">
                                    <h3>{t('counterparties.top_tovarov', 'Топ товаров')}</h3>
                                    {stats.topProducts.length === 0 ? (
                                        <p className="text-muted">{t('counterparties.net_dannyh', 'Нет данных')}</p>
                                    ) : (
                                        <table className="mb-3">
                                            <thead>
                                                <tr>
                                                    <th>{t('counterparties.tovar', 'Товар')}</th>
                                                    <th>{t('counterparties.kolichestvo', 'Количество')}</th>
                                                    <th>{t('counterparties.vyruchka', 'Выручка')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.topProducts.map((product, index) => (
                                                    <tr key={index}>
                                                        <td>{product.name}</td>
                                                        <td>{product.total_quantity}</td>
                                                        <td><strong>{formatCurrency(product.total_revenue)}</strong></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    <h3>{t('counterparties.dinamika_prodazh', 'Динамика продаж')}</h3>
                                    {stats.salesTrend.length === 0 ? (
                                        <p className="text-muted">{t('counterparties.net_dannyh', 'Нет данных')}</p>
                                    ) : (
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>{t('counterparties.mesyats', 'Месяц')}</th>
                                                    <th>{t('counterparties.prodazh', 'Продаж')}</th>
                                                    <th>{t('counterparties.summa', 'Сумма')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.salesTrend.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{new Date(item.month).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })}</td>
                                                        <td>{item.sales_count}</td>
                                                        <td><strong>{formatCurrency(item.total_amount)}</strong></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Counterparties;
