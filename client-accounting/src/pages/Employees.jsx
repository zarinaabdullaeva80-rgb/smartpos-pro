import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, DollarSign, Calendar, Check, X, AlertCircle } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import { employeesAPI } from '../services/api';
import useActionHandler from '../hooks/useActionHandler';
import ExportButton from '../components/ExportButton';
import { useToast } from '../components/ToastProvider';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
const Employees = () => {
    const toast = useToast();
    const confirm = useConfirm();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('employees');
    const [employees, setEmployees] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'employee' or 'payroll'
    const [editingItem, setEditingItem] = useState(null);
    const { handleSuccess, handleError } = useActionHandler();

    const [formData, setFormData] = useState({
        code: '',
        full_name: '',
        position: '',
        department: '',
        hire_date: '',
        salary: 0,
        phone: '',
        email: '',
        inn: '',
        passport_data: ''
    });

    const [payrollFilters, setPayrollFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        status: ''
    });

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (activeTab === 'payroll') {
            loadPayroll();
        }
    }, [activeTab, payrollFilters]);

    const loadEmployees = async () => {
        setLoading(true);
        try {
            const response = await employeesAPI.getAll();
            setEmployees(response.data?.employees || response.data || []);
        } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error);
            handleError('Не удалось загрузить сотрудников');
        } finally {
            setLoading(false);
        }
    };

    const loadPayroll = async () => {
        setLoading(true);
        try {
            const params = {
                month: payrollFilters.month,
                year: payrollFilters.year,
                status: payrollFilters.status || undefined
            };
            const response = await employeesAPI.getPayroll(params);
            setPayroll(response.data?.payroll || []);
        } catch (error) {
            console.error('Ошибка загрузки зарплаты:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);

        if (item && type === 'employee') {
            setFormData({ ...item });
        } else if (!item && type === 'employee') {
            setFormData({
                code: '',
                full_name: '',
                position: '',
                department: '',
                hire_date: '',
                salary: 0,
                phone: '',
                email: '',
                inn: '',
                passport_data: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleSubmitEmployee = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingItem) {
                await employeesAPI.update(editingItem.id, formData);
                handleSuccess('Сотрудник обновлён');
            } else {
                await employeesAPI.create(formData);
                handleSuccess('Сотрудник создан');
            }
            await loadEmployees();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения сотрудника:', error);
            handleError('Ошибка сохранения сотрудника');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Вы уверены, что хотите удалить этого сотрудника?' }))) return;

        try {
            await employeesAPI.delete(id);
            handleSuccess('Сотрудник удалён');
            await loadEmployees();
        } catch (error) {
            console.error('Ошибка удаления сотрудника:', error);
            handleError('Невозможно удалить сотрудника. Возможно, по нему есть начисления.');
        }
    };

    const handleMassCalculate = async () => {
        if (!(await confirm({ message: `Начислить зарплату всем сотрудникам за ${payrollFilters.month}/${payrollFilters.year}?` }))) return;

        setLoading(true);
        try {
            await employeesAPI.massCalculatePayroll({
                period_month: payrollFilters.month,
                period_year: payrollFilters.year
            });
            await loadPayroll();
            toast.success('Зарплата начислена успешно');
        } catch (error) {
            console.error('Ошибка массового начисления:', error);
            toast.error('Не удалось начислить зарплату');
        } finally {
            setLoading(false);
        }
    };

    const handlePaySalary = async (id) => {
        if (!(await confirm({ message: 'Отметить зарплату как выплаченную?' }))) return;

        try {
            await employeesAPI.payPayroll(id, { payment_date: new Date().toISOString().split('T')[0] });
            await loadPayroll();
        } catch (error) {
            console.error('Ошибка выплаты:', error);
        }
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getMonthName = (month) => {
        const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        return months[month - 1] || month;
    };

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.is_active).length;
    const totalPayroll = payroll.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
    const paidPayroll = payroll.filter(p => p.status === 'paid').length;

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users className="page-icon" />
                        {t('employees.title')}
                    </h1>
                    <p className="page-subtitle">{t('employees.subtitle', 'Управление сотрудниками и расчет заработной платы')}</p>
                </div>
                <ExportButton
                    data={activeTab === 'employees' ? employees : payroll}
                    filename={activeTab === 'employees' ? 'Сотрудники' : 'Зарплата'}
                    sheetName={activeTab === 'employees' ? 'Сотрудники' : 'Зарплата'}
                    columns={activeTab === 'employees' ? {
                        code: 'Код',
                        full_name: 'ФИО',
                        position: 'Должность',
                        department: 'Отдел',
                        hire_date: 'Дата приема',
                        salary: 'Оклад',
                        phone: 'Телефон',
                        is_active: 'Активен'
                    } : {
                        full_name: 'Сотрудник',
                        position: 'Должность',
                        period_month: 'Месяц',
                        period_year: 'Год',
                        salary_amount: 'Оклад',
                        bonus: 'Премия',
                        total_amount: 'К выплате',
                        status: 'Статус'
                    }}
                />
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('employees.totalEmployees', 'Всего сотрудников')}</span>
                        <Users className="stat-icon text-blue-500" size={24} />
                    </div>
                    <div className="stat-value">{totalEmployees}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('employees.active', 'Активных')}</span>
                        <Check className="stat-icon text-green-500" size={24} />
                    </div>
                    <div className="stat-value">{activeEmployees}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('employees.payrollFund', 'Фонд зарплаты')}</span>
                        <DollarSign className="stat-icon text-purple-500" size={24} />
                    </div>
                    <div className="stat-value text-lg">{formatCurrency(totalPayroll)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('employees.paidOut', 'Выплачено')}</span>
                        <Calendar className="stat-icon text-orange-500" size={24} />
                    </div>
                    <div className="stat-value">{paidPayroll} / {payroll.length}</div>
                </div>
            </div>

            {/* Табы */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'employees' ? 'active' : ''}`}
                    onClick={() => setActiveTab('employees')}
                >
                    {t('employees.employees', 'Сотрудники')}
                </button>
                <button
                    className={`tab ${activeTab === 'payroll' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payroll')}
                >
                    {t('employees.payroll', 'Зарплата')}
                </button>
            </div>

            {/* Вкладка сотрудников */}
            {activeTab === 'employees' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('employees.employeeList', 'Список сотрудников')}</h2>
                        <button className="btn btn-primary" onClick={() => handleOpenModal('employee')}>
                            <Plus size={20} />
                            {t('employees.newEmployee', 'Новый сотрудник')}
                        </button>
                    </div>

                    <div className="table-container mt-4">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('employees.kod', 'Код')}</th>
                                    <th>ФИО</th>
                                    <th>{t('employees.dolzhnost', 'Должность')}</th>
                                    <th>{t('employees.otdel', 'Отдел')}</th>
                                    <th>{t('employees.data_priema', 'Дата приема')}</th>
                                    <th>{t('employees.oklad', 'Оклад')}</th>
                                    <th>{t('employees.telefon', 'Телефон')}</th>
                                    <th>{t('employees.status', 'Статус')}</th>
                                    <th>{t('employees.deystviya', 'Действия')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(employee => (
                                    <tr key={employee.id}>
                                        <td>{employee.code}</td>
                                        <td className="font-medium">{employee.full_name}</td>
                                        <td>{employee.position}</td>
                                        <td>{employee.department || '—'}</td>
                                        <td>{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ru-RU') : '—'}</td>
                                        <td className="font-semibold">{formatCurrency(employee.salary)}</td>
                                        <td>{employee.phone || '—'}</td>
                                        <td>
                                            <span className={`badge ${employee.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                                {employee.is_active ? 'Активен' : 'Неактивен'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button
                                                    className="btn btn-xs btn-secondary"
                                                    onClick={() => handleOpenModal('employee', employee)}
                                                    title={t('employees.izmenit', 'Изменить')}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-danger"
                                                    onClick={() => handleDeleteEmployee(employee.id)}
                                                    title={t('employees.udalit', 'Удалить')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Вкладка зарплаты */}
            {activeTab === 'payroll' && (
                <div className="content-section">
                    <div className="section-header">
                        <h2 className="section-title">{t('employees.nachislenie_zarplaty', 'Начисление зарплаты')}</h2>
                        <button className="btn btn-primary" onClick={handleMassCalculate}>
                            <Calendar size={20} />
                            Начислить всем
                        </button>
                    </div>

                    {/* Фильтры */}
                    <div className="card glass mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="label">{t('employees.mesyats', 'Месяц')}</label>
                                <select
                                    className="input"
                                    value={payrollFilters.month}
                                    onChange={(e) => setPayrollFilters({ ...payrollFilters, month: e.target.value })}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{getMonthName(m)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">{t('employees.god', 'Год')}</label>
                                <select
                                    className="input"
                                    value={payrollFilters.year}
                                    onChange={(e) => setPayrollFilters({ ...payrollFilters, year: e.target.value })}
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">{t('employees.status', 'Статус')}</label>
                                <select
                                    className="input"
                                    value={payrollFilters.status}
                                    onChange={(e) => setPayrollFilters({ ...payrollFilters, status: e.target.value })}
                                >
                                    <option value="">{t('employees.vse', 'Все')}</option>
                                    <option value="calculated">{t('employees.nachisleno', 'Начислено')}</option>
                                    <option value="paid">{t('employees.vyplacheno', 'Выплачено')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Сотрудник</th>
                                    <th>{t('employees.dolzhnost', 'Должность')}</th>
                                    <th>{t('employees.period', 'Период')}</th>
                                    <th>{t('employees.oklad', 'Оклад')}</th>
                                    <th>{t('employees.premiya', 'Премия')}</th>
                                    <th>{t('employees.uderzhaniya', 'Удержания')}</th>
                                    <th>{t('employees.k_vyplate', 'К выплате')}</th>
                                    <th>{t('employees.status', 'Статус')}</th>
                                    <th>{t('employees.deystviya', 'Действия')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payroll.map(item => (
                                    <tr key={item.id}>
                                        <td className="font-medium">{item.full_name}</td>
                                        <td>{item.position}</td>
                                        <td>{getMonthName(item.period_month)} {item.period_year}</td>
                                        <td>{formatCurrency(item.salary_amount)}</td>
                                        <td className="text-green-600">{item.bonus > 0 ? formatCurrency(item.bonus) : '—'}</td>
                                        <td className="text-red-600">{item.deductions > 0 ? formatCurrency(item.deductions) : '—'}</td>
                                        <td className="font-semibold text-blue-600">{formatCurrency(item.total_amount)}</td>
                                        <td>
                                            <span className={`badge ${item.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                {item.status === 'paid' ? 'Выплачено' : 'Начислено'}
                                            </span>
                                        </td>
                                        <td>
                                            {item.status !== 'paid' && (
                                                <button
                                                    className="btn btn-xs btn-success"
                                                    onClick={() => handlePaySalary(item.id)}
                                                    title={t('employees.vyplatit', 'Выплатить')}
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && modalType === 'employee' && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingItem ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitEmployee}>
                            <div className="modal-body">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="label required">{t('employees.kod', 'Код')}</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.code || ''}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label required">ФИО</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.full_name || ''}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">{t('employees.dolzhnost', 'Должность')}</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.position || ''}
                                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">{t('employees.otdel', 'Отдел')}</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.department || ''}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">{t('employees.data_priema', 'Дата приема')}</label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={formData.hire_date || ''}
                                            onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label required">{t('employees.oklad', 'Оклад')}</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="input"
                                            value={formData.salary || 0}
                                            onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">{t('employees.telefon', 'Телефон')}</label>
                                        <input
                                            type="tel"
                                            className="input"
                                            value={formData.phone || ''}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Email</label>
                                        <input
                                            type="email"
                                            className="input"
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">{t('employees.inn', 'ИНН')}</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.inn || ''}
                                            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? t('common.loading', 'Сохранение...') : t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
