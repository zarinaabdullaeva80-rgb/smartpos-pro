import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Edit, Trash2, Check, X, CreditCard, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import { financeAPI, counterpartiesAPI, analyticsAPI } from '../services/api';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
const Finance = () => {
    const { handleSuccess, handleError } = useActionHandler();
    const confirm = useConfirm();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('accounts');
    const [accounts, setAccounts] = useState([]);
    const [payments, setPayments] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [profitLoss, setProfitLoss] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'account' or 'payment'
    const [editingItem, setEditingItem] = useState(null);

    const [formData, setFormData] = useState({
        // Account fields
        code: '',
        name: '',
        type: 'cash',
        account_number: '',
        bank_name: '',
        currency: 'UZS',
        balance: 0,
        // Payment fields
        document_number: '',
        document_date: new Date().toISOString().split('T')[0],
        payment_type: 'incoming',
        counterparty_id: '',
        bank_account_id: '',
        amount: 0,
        purpose: ''
    });

    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        type: '',
        status: ''
    });

    useEffect(() => {
        loadAccounts();
        loadCounterparties();
    }, []);

    useEffect(() => {
        if (activeTab === 'payments') {
            loadPayments();
        } else if (activeTab === 'transactions') {
            loadTransactions();
            loadProfitLoss();
        }
    }, [activeTab, filters]);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const response = await financeAPI.getAccounts();
            setAccounts(response.data.accounts || []);
        } catch (error) {
            console.error('Ошибка загрузки счетов:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPayments = async () => {
        setLoading(true);
        try {
            const response = await financeAPI.getPayments(filters);
            setPayments(response.data.payments || []);
        } catch (error) {
            console.error('Ошибка загрузки платежей:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const response = await financeAPI.getTransactions(filters);
            setTransactions(response.data.transactions || []);
        } catch (error) {
            console.error('Ошибка загрузки транзакций:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProfitLoss = async () => {
        try {
            const response = await analyticsAPI.getProfitLoss({
                startDate: filters.dateFrom || undefined,
                endDate: filters.dateTo || undefined
            });
            setProfitLoss(response.data);
        } catch (error) {
            console.error('Ошибка загрузки P&L:', error);
        }
    };

    const loadCounterparties = async () => {
        try {
            const response = await counterpartiesAPI.getAll();
            setCounterparties(response.data.counterparties || []);
        } catch (error) {
            console.error('Ошибка загрузки контрагентов:', error);
        }
    };

    const handleOpenModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);

        if (item) {
            setFormData({ ...item });
        } else {
            if (type === 'account') {
                setFormData({
                    code: '',
                    name: '',
                    type: 'cash',
                    account_number: '',
                    bank_name: '',
                    currency: 'UZS',
                    balance: 0
                });
            } else if (type === 'payment') {
                const nextNumber = `ПЛ-${String(payments.length + 1).padStart(5, '0')}`;
                setFormData({
                    document_number: nextNumber,
                    document_date: new Date().toISOString().split('T')[0],
                    payment_type: 'incoming',
                    counterparty_id: '',
                    bank_account_id: accounts[0]?.id || '',
                    amount: 0,
                    currency: 'UZS',
                    purpose: ''
                });
            }
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSubmitAccount = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingItem) {
                await financeAPI.updateAccount(editingItem.id, formData);
                handleSuccess('Счёт успешно обновлён');
            } else {
                await financeAPI.createAccount(formData);
                handleSuccess('Счёт успешно создан');
            }
            await loadAccounts();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения счета:', error);
            handleError('Ошибка сохранения счёта');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitPayment = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await financeAPI.createPayment(formData);
            handleSuccess('Платёж успешно создан');
            await loadPayments();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения платежа:', error);
            handleError('Ошибка сохранения платежа');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Вы уверены, что хотите удалить этот счет?' }))) return;

        try {
            await financeAPI.deleteAccount(id);
            await loadAccounts();
            handleSuccess('Счёт удалён');
        } catch (error) {
            console.error('Ошибка удаления счета:', error);
            handleError('Невозможно удалить счет. Возможно, по нему есть платежи.');
        }
    };

    const handleDeletePayment = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Вы уверены, что хотите удалить этот платеж?' }))) return;

        try {
            await financeAPI.deletePayment(id);
            await loadPayments();
            handleSuccess('Платёж удалён');
        } catch (error) {
            console.error('Ошибка удаления платежа:', error);
            handleError('Не удалось удалить платеж');
        }
    };

    const handleConfirmPayment = async (id) => {
        if (!(await confirm({ message: 'Провести платеж? Это обновит баланс счета.' }))) return;

        try {
            await financeAPI.confirmPayment(id);
            await loadPayments();
            await loadAccounts();
            handleSuccess('Платёж проведён');
        } catch (error) {
            console.error('Ошибка проведения платежа:', error);
            handleError('Не удалось провести платеж');
        }
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getAccountTypeLabel = (type) => {
        return type === 'cash' ? 'Касса' : 'Банк';
    };

    const getAccountTypeIcon = (type) => {
        return type === 'cash' ? <Wallet size={20} /> : <CreditCard size={20} />;
    };

    const getPaymentTypeLabel = (type) => {
        return type === 'incoming' ? 'Приход' : 'Расход';
    };

    const getPaymentTypeColor = (type) => {
        return type === 'incoming' ? 'text-green-600' : 'text-red-600';
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'badge-warning',
            confirmed: 'badge-success'
        };
        const labels = {
            draft: 'Черновик',
            confirmed: 'Проведен'
        };
        return <span className={`badge ${styles[status]}`}>{labels[status]}</span>;
    };

    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const cashBalance = accounts.filter(a => a.type === 'cash').reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const bankBalance = accounts.filter(a => a.type === 'bank').reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Wallet className="page-icon" />
                        {t('finance.title')}
                    </h1>
                    <p className="page-subtitle">{t('finance.subtitle', 'Управление счетами, кассами и платежами')}</p>
                </div>
                <ExportButton
                    data={activeTab === 'accounts' ? accounts : activeTab === 'payments' ? payments : transactions}
                    filename={activeTab === 'accounts' ? 'Счета' : activeTab === 'payments' ? 'Платежи' : 'Транзакции'}
                    sheetName={activeTab === 'accounts' ? 'Счета' : activeTab === 'payments' ? 'Платежи' : 'Транзакции'}
                    columns={activeTab === 'accounts' ? {
                        code: 'Код',
                        name: 'Название',
                        type: 'Тип',
                        account_number: 'Номер счета',
                        bank_name: 'Банк',
                        currency: 'Валюта',
                        balance: 'Баланс',
                        is_active: 'Активен'
                    } : activeTab === 'payments' ? {
                        document_number: 'Номер',
                        document_date: 'Дата',
                        payment_type: 'Тип',
                        counterparty_name: 'Контрагент',
                        bank_account_name: 'Счет',
                        amount: 'Сумма',
                        purpose: 'Назначение',
                        status: 'Статус'
                    } : {
                        date: 'Дата',
                        type: 'Тип',
                        description: 'Описание',
                        counterparty: 'Контрагент',
                        amount: 'Сумма'
                    }}
                />
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('finance.totalBalance', 'Общий баланс')}</span>
                        <DollarSign className="stat-icon text-blue-500" size={24} />
                    </div>
                    <div className="stat-value">{formatCurrency(totalBalance)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('finance.cash', 'Касса')}</span>
                        <Wallet className="stat-icon text-green-500" size={24} />
                    </div>
                    <div className="stat-value">{formatCurrency(cashBalance)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('finance.bank', 'Банк')}</span>
                        <CreditCard className="stat-icon text-purple-500" size={24} />
                    </div>
                    <div className="stat-value">{formatCurrency(bankBalance)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('finance.accountsCount', 'Счетов')}</span>
                        <Wallet className="stat-icon text-orange-500" size={24} />
                    </div>
                    <div className="stat-value">{accounts.length}</div>
                </div>
            </div>

            {/* Табы */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'accounts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('accounts')}
                >
                    {t('finance.accountsAndCash', 'Счета и кассы')}
                </button>
                <button
                    className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payments')}
                >
                    {t('finance.payments', 'Платежи')}
                </button>
                <button
                    className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    {t('finance.incomeExpense', 'Приходы/Расходы')}
                </button>
            </div>

            {/* Контент вкладок */}
            {activeTab === 'accounts' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('finance.accountsAndCash', 'Счета и кассы')}</h2>
                        <button className="btn btn-primary" onClick={() => handleOpenModal('account')}>
                            <Plus size={20} />
                            {t('finance.newAccount', 'Новый счет')}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {accounts.map(account => (
                            <div key={account.id} className="card glass">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {getAccountTypeIcon(account.type)}
                                        <div>
                                            <h3 className="font-semibold">{account.name}</h3>
                                            <p className="text-sm text-gray-500">{account.code}</p>
                                        </div>
                                    </div>
                                    <span className={`badge ${account.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                        {account.is_active ? 'Активен' : 'Неактивен'}
                                    </span>
                                </div>

                                <div className="mb-3">
                                    <div className="text-sm text-gray-500">{t('finance.tip', 'Тип')}</div>
                                    <div className="font-medium">{getAccountTypeLabel(account.type)}</div>
                                </div>

                                {account.type === 'bank' && account.account_number && (
                                    <div className="mb-3">
                                        <div className="text-sm text-gray-500">{t('finance.nomer_scheta', 'Номер счета')}</div>
                                        <div className="font-mono text-sm">{account.account_number}</div>
                                    </div>
                                )}

                                {account.bank_name && (
                                    <div className="mb-3">
                                        <div className="text-sm text-gray-500">Банк</div>
                                        <div className="text-sm">{account.bank_name}</div>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <div className="text-sm text-gray-500">{t('finance.balans', 'Баланс')}</div>
                                    <div className="text-xl font-bold text-blue-600">
                                        {formatCurrency(account.balance)}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        className="btn btn-sm btn-secondary flex-1"
                                        onClick={() => handleOpenModal('account', account)}
                                    >
                                        <Edit size={16} />
                                        Изменить
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDeleteAccount(account.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('finance.payments', 'Платежи')}</h2>
                        <button className="btn btn-primary" onClick={() => handleOpenModal('payment')}>
                            <Plus size={20} />
                            {t('finance.newPayment', 'Новый платеж')}
                        </button>
                    </div>

                    {/* Фильтры */}
                    <div className="card glass mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="label">{t('finance.data_ot', 'Дата от')}</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">{t('finance.data_do', 'Дата до')}</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">{t('finance.tip', 'Тип')}</label>
                                <select
                                    className="input"
                                    value={filters.type}
                                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                >
                                    <option value="">{t('finance.vse', 'Все')}</option>
                                    <option value="incoming">{t('finance.prihod', 'Приход')}</option>
                                    <option value="outgoing">{t('finance.rashod', 'Расход')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">{t('finance.status', 'Статус')}</label>
                                <select
                                    className="input"
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                >
                                    <option value="">{t('finance.vse', 'Все')}</option>
                                    <option value="draft">{t('finance.chernovik', 'Черновик')}</option>
                                    <option value="confirmed">{t('finance.proveden', 'Проведен')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('finance.nomer', 'Номер')}</th>
                                    <th>{t('finance.data', 'Дата')}</th>
                                    <th>{t('finance.tip', 'Тип')}</th>
                                    <th>Контрагент</th>
                                    <th>Счет</th>
                                    <th>{t('finance.summa', 'Сумма')}</th>
                                    <th>{t('finance.naznachenie', 'Назначение')}</th>
                                    <th>{t('finance.status', 'Статус')}</th>
                                    <th>{t('finance.deystviya', 'Действия')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(payment => (
                                    <tr key={payment.id}>
                                        <td>{payment.document_number}</td>
                                        <td>{new Date(payment.document_date).toLocaleDateString('ru-RU')}</td>
                                        <td>
                                            <span className={getPaymentTypeColor(payment.payment_type)}>
                                                {payment.payment_type === 'incoming' ? <TrendingUp size={16} className="inline mr-1" /> : <TrendingDown size={16} className="inline mr-1" />}
                                                {getPaymentTypeLabel(payment.payment_type)}
                                            </span>
                                        </td>
                                        <td>{payment.counterparty_name || '—'}</td>
                                        <td>{payment.bank_account_name}</td>
                                        <td className="font-semibold">{formatCurrency(payment.amount)}</td>
                                        <td className="max-w-xs truncate">{payment.purpose}</td>
                                        <td>{getStatusBadge(payment.status)}</td>
                                        <td>
                                            <div className="flex gap-1">
                                                {payment.status === 'draft' && (
                                                    <>
                                                        <button
                                                            className="btn btn-xs btn-success"
                                                            onClick={() => handleConfirmPayment(payment.id)}
                                                            title={t('finance.provesti', 'Провести')}
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-xs btn-secondary"
                                                            onClick={() => handleOpenModal('payment', payment)}
                                                            title={t('finance.izmenit', 'Изменить')}
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-xs btn-danger"
                                                            onClick={() => handleDeletePayment(payment.id)}
                                                            title={t('finance.udalit', 'Удалить')}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('finance.incomeExpenseReport', 'Отчёт приходов и расходов')}</h2>
                    </div>

                    {/* Фильтры */}
                    <div className="card glass mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">{t('finance.data_ot', 'Дата от')}</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">{t('finance.data_do', 'Дата до')}</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Сводка */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="stat-card glass">
                            <div className="stat-header">
                                <span className="stat-label">{t('finance.income', 'Приходы')}</span>
                                <TrendingUp className="stat-icon text-green-500" size={24} />
                            </div>
                            <div className="stat-value text-green-600">
                                {formatCurrency(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0))}
                            </div>
                        </div>
                        <div className="stat-card glass">
                            <div className="stat-header">
                                <span className="stat-label">{t('finance.expenses', 'Расходы')}</span>
                                <TrendingDown className="stat-icon text-red-500" size={24} />
                            </div>
                            <div className="stat-value text-red-600">
                                {formatCurrency(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0))}
                            </div>
                        </div>
                        <div className="stat-card glass">
                            <div className="stat-header">
                                <span className="stat-label">{t('finance.netProfit', 'Чистая прибыль')}</span>
                                <DollarSign className="stat-icon text-blue-500" size={24} />
                            </div>
                            <div className="stat-value text-blue-600">
                                {formatCurrency(
                                    transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0) -
                                    transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0)
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('finance.data', 'Дата')}</th>
                                    <th>{t('finance.tip', 'Тип')}</th>
                                    <th>Описание</th>
                                    <th>Контрагент</th>
                                    <th>{t('finance.summa', 'Сумма')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(transaction => (
                                    <tr key={transaction.id}>
                                        <td>{new Date(transaction.date).toLocaleDateString('ru-RU')}</td>
                                        <td>
                                            <span className={transaction.type === 'income' ? 'badge badge-success' : 'badge badge-danger'}>
                                                {transaction.type === 'income' ? 'Приход' : 'Расход'}
                                            </span>
                                        </td>
                                        <td>{transaction.description}</td>
                                        <td>{transaction.counterparty || '—'}</td>
                                        <td className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal для создания/редактирования */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingItem ? 'Редактировать' : 'Создать'} {modalType === 'account' ? 'счет' : 'платеж'}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={modalType === 'account' ? handleSubmitAccount : handleSubmitPayment}>
                            <div className="modal-body">
                                {modalType === 'account' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label required">{t('finance.kod', 'Код')}</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={formData.code || ''}
                                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="label required">Название</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="label required">{t('finance.tip', 'Тип')}</label>
                                            <select
                                                className="input"
                                                value={formData.type || 'cash'}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                required
                                            >
                                                <option value="cash">{t('finance.kassa', 'Касса')}</option>
                                                <option value="bank">Банк</option>
                                            </select>
                                        </div>
                                        {formData.type === 'bank' && (
                                            <>
                                                <div>
                                                    <label className="label">{t('finance.nomer_scheta', 'Номер счета')}</label>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={formData.account_number || ''}
                                                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">{t('finance.nazvanie_banka', 'Название банка')}</label>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        value={formData.bank_name || ''}
                                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label className="label">{t('finance.valyuta', 'Валюта')}</label>
                                            <select
                                                className="input"
                                                value={formData.currency || 'UZS'}
                                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                            >
                                                <option value="UZS">{t('finance.sum', 'UZS (сум)')}</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="RUB">RUB</option>
                                            </select>
                                        </div>
                                        {!editingItem && (
                                            <div>
                                                <label className="label">{t('finance.nachalnyy_balans', 'Начальный баланс')}</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="input"
                                                    value={formData.balance || 0}
                                                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label required">{t('finance.nomer_dokumenta', 'Номер документа')}</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={formData.document_number || ''}
                                                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="label required">{t('finance.data', 'Дата')}</label>
                                            <input
                                                type="date"
                                                className="input"
                                                value={formData.document_date || ''}
                                                onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="label required">{t('finance.tip_platezha', 'Тип платежа')}</label>
                                            <select
                                                className="input"
                                                value={formData.payment_type || 'incoming'}
                                                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                                                required
                                            >
                                                <option value="incoming">{t('finance.prihod', 'Приход')}</option>
                                                <option value="outgoing">{t('finance.rashod', 'Расход')}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Контрагент</label>
                                            <select
                                                className="input"
                                                value={formData.counterparty_id || ''}
                                                onChange={(e) => setFormData({ ...formData, counterparty_id: e.target.value })}
                                            >
                                                <option value="">{t('finance.ne_vybran', 'Не выбран')}</option>
                                                {counterparties.map(cp => (
                                                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label required">Счет</label>
                                            <select
                                                className="input"
                                                value={formData.bank_account_id || ''}
                                                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                                required
                                            >
                                                <option value="">{t('finance.vyberite_schet', 'Выберите счет')}</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label required">{t('finance.summa', 'Сумма')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                value={formData.amount || 0}
                                                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="label">{t('finance.naznachenie_platezha', 'Назначение платежа')}</label>
                                            <textarea
                                                className="input"
                                                rows="3"
                                                value={formData.purpose || ''}
                                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}
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

export default Finance;
