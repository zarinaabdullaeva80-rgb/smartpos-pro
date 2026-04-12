import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, Check, X, Search, UserPlus } from 'lucide-react';
import { employeesAPI } from '../services/api';


import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function StaffManagement() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState(null);
    const [newPassword, setNewPassword] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
        role: 'Кассир'
    });

    const roles = ['Администратор', 'Менеджер', 'Кассир', 'Бухгалтер', 'Кладовщик'];

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const apiRes = await employeesAPI.getAll();
            const data = apiRes.data || apiRes;
            setEmployees(data.employees || data || []);
        } catch (err) {
            console.warn('StaffManagement.jsx: API недоступен:', err.message);
            setEmployees([]);
            setMessage({ type: 'error', text: 'Не удалось загрузить сотрудников: ' + (err.response?.data?.error || err.message) });
        }
        setLoading(false);
    };

    const handleOpenModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData({
                username: employee.username || '',
                password: '',
                fullName: employee.full_name || '',
                email: employee.email || '',
                phone: employee.phone || '',
                role: employee.role || 'Кассир'
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                username: '',
                password: '',
                fullName: '',
                email: '',
                phone: '',
                role: 'Кассир'
            });
        }
        setNewPassword(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingEmployee(null);
        setNewPassword(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingEmployee) {
                await employeesAPI.update(editingEmployee.id, {
                    email: formData.email,
                    fullName: formData.fullName,
                    phone: formData.phone,
                    role: formData.role,
                    isActive: true,
                    newPassword: formData.password || undefined
                });
                setMessage({ type: 'success', text: 'Сотрудник обновлён' });
            } else {
                if (!formData.username || !formData.password) {
                    setMessage({ type: 'error', text: 'Логин и пароль обязательны' });
                    setLoading(false);
                    return;
                }
                await employeesAPI.create(formData);
                setMessage({ type: 'success', text: 'Сотрудник создан' });
            }
            await loadEmployees();
            handleCloseModal();
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка сохранения' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить сотрудника?' }))) return;

        try {
            await employeesAPI.delete(id);
            setMessage({ type: 'success', text: 'Сотрудник удалён' });
            await loadEmployees();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            setMessage({ type: 'error', text: 'Не удалось удалить сотрудника' });
        }
    };

    const handleResetPassword = async (id) => {
        if (!(await confirm({ message: 'Сбросить пароль сотрудника?' }))) return;

        try {
            const response = await employeesAPI.resetPassword(id);
            setNewPassword(response.data.newPassword);
            setMessage({ type: 'success', text: `Пароль сброшен: ${response.data.newPassword}` });
        } catch (error) {
            console.error('Ошибка сброса пароля:', error);
            setMessage({ type: 'error', text: 'Не удалось сбросить пароль' });
        }
    };

    const filteredEmployees = employees.filter(emp =>
        !searchQuery.trim() ||
        emp.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users className="page-icon" />
                        Управление сотрудниками
                    </h1>
                    <p className="page-subtitle">{t('staffmanagement.sozdanie_loginov_i_paroley_dlya_sotrudnik', 'Создание логинов и паролей для сотрудников вашей организации')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <UserPlus size={18} />
                    Добавить сотрудника
                </button>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} mb-4`}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {newPassword && (
                <div className="alert alert-info mb-4">
                    <Key size={18} />
                    <div>
                        <strong>{t('staffmanagement.novyy_parol', 'Новый пароль:')}</strong> {newPassword}
                        <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                            Скопируйте и передайте сотруднику. Этот пароль больше не будет показан.
                        </p>
                    </div>
                </div>
            )}

            <div className="card mb-4">
                <div className="flex gap-3 items-center">
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Поиск сотрудников..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('staffmanagement.login', 'Логин')}</th>
                                <th>{t('staffmanagement.fio', 'ФИО')}</th>
                                <th>Email</th>
                                <th>{t('staffmanagement.telefon', 'Телефон')}</th>
                                <th>{t('staffmanagement.rol', 'Роль')}</th>
                                <th>{t('staffmanagement.status', 'Статус')}</th>
                                <th>{t('staffmanagement.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Загрузка...
                                    </td>
                                </tr>
                            ) : filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        <Users size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                                        <p>{t('staffmanagement.sotrudniki_ne_naydeny', 'Сотрудники не найдены')}</p>
                                        <p style={{ fontSize: '13px' }}>{t('staffmanagement.nazhmite_dobavit_sotrudnika_chtoby_soz', 'Нажмите "Добавить сотрудника", чтобы создать первого')}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td><strong>{employee.username}</strong></td>
                                        <td>{employee.full_name || '—'}</td>
                                        <td>{employee.email || '—'}</td>
                                        <td>{employee.phone || '—'}</td>
                                        <td>
                                            <span className="badge badge-info">{employee.role || 'Кассир'}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${employee.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                                {employee.is_active ? 'Активен' : 'Отключен'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleOpenModal(employee)}
                                                    title={t('staffmanagement.izmenit', 'Изменить')}
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-warning btn-sm"
                                                    onClick={() => handleResetPassword(employee.id)}
                                                    title={t('staffmanagement.sbrosit_parol', 'Сбросить пароль')}
                                                >
                                                    <Key size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDelete(employee.id)}
                                                    title={t('staffmanagement.udalit', 'Удалить')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                            </h2>
                            <button className="modal-close" onClick={handleCloseModal}>
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label required">{t('staffmanagement.login', 'Логин')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        disabled={!!editingEmployee}
                                        required={!editingEmployee}
                                    />
                                    {editingEmployee && (
                                        <small style={{ color: 'var(--color-text-muted)' }}>
                                            Логин нельзя изменить
                                        </small>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{editingEmployee ? 'Новый пароль (оставьте пустым, если не меняете)' : 'Пароль'}</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingEmployee}
                                        minLength={6}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('staffmanagement.fio', 'ФИО')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">{t('staffmanagement.telefon', 'Телефон')}</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('staffmanagement.rol', 'Роль')}</label>
                                    <select
                                        className="form-input"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        {roles.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
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
}

export default StaffManagement;
