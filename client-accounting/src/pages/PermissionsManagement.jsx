import React, { useState, useEffect } from 'react';
import { Users, Shield, Key, Plus, Save, Trash2, Lock } from 'lucide-react';
import { permissionsAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';
import '../styles/Common.css';
import { useI18n } from '../i18n';

const PermissionsManagement = () => {
    const { t } = useI18n();
    const confirm = useConfirm();

const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [selectedRole, setSelectedRole] = useState(null);
    const [rolePermissions, setRolePermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRole, setNewRole] = useState({ code: '', name: '', description: '' });
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadRoles();
        loadPermissions();
    }, []);

    useEffect(() => {
        if (selectedRole) {
            loadRolePermissions(selectedRole.id);
        }
    }, [selectedRole]);

    const loadRoles = async () => {
        try {
            const apiRes = await permissionsAPI.getRoles();
            const apiData = apiRes.data || apiRes;
            const rolesArr = Array.isArray(apiData) ? apiData : (apiData.roles || []);
            setRoles(rolesArr);
            if (rolesArr.length > 0 && !selectedRole) {
                setSelectedRole(rolesArr[0]);
            }
        } catch (err) {
            console.warn('PermissionsManagement.jsx: API недоступен');
        }
        setLoading(false);
    };

    const loadPermissions = async () => {
        try {
            const res = await permissionsAPI.getAll();
            const data = res.data || res;
            setPermissions(data.grouped || data);
        } catch (error) {
            console.error('Error loading permissions:', error);
        }
    };

    const loadRolePermissions = async (roleId) => {
        try {
            const res = await permissionsAPI.getRolePermissions(roleId);
            const data = res.data || res;
            const permsArr = Array.isArray(data) ? data : [];
            setRolePermissions(permsArr.map(p => p.id));
        } catch (error) {
            console.error('Error loading role permissions:', error);
        }
    };

    const togglePermission = (permissionId) => {
        if (selectedRole?.is_system) {
            setMessage({ type: 'error', text: 'Нельзя изменять системные роли' });
            return;
        }

        setRolePermissions(prev => {
            if (prev.includes(permissionId)) {
                return prev.filter(id => id !== permissionId);
            } else {
                return [...prev, permissionId];
            }
        });
    };

    const saveRolePermissions = async () => {
        if (!selectedRole) return;

        setLoading(true);
        try {
            await permissionsAPI.updateRole(selectedRole.id, {
                name: selectedRole.name,
                description: selectedRole.description,
                permissions: rolePermissions
            });
            setMessage({ type: 'success', text: 'Права роли обновлены' });
            loadRoles();
        } catch (error) {
            console.error('Error saving permissions:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка сохранения прав' });
        } finally {
            setLoading(false);
        }
    };

    const createRole = async () => {
        setLoading(true);
        try {
            await permissionsAPI.createRole(newRole);
            setMessage({ type: 'success', text: 'Роль создана' });
            setShowCreateModal(false);
            setNewRole({ code: '', name: '', description: '' });
            loadRoles();
        } catch (error) {
            console.error('Error creating role:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка создания роли' });
        } finally {
            setLoading(false);
        }
    };

    const deleteRole = async (roleId) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить роль?' }))) return;

        try {
            await permissionsAPI.deleteRole(roleId);
            setMessage({ type: 'success', text: 'Роль удалена' });
            setSelectedRole(null);
            loadRoles();
        } catch (error) {
            console.error('Error deleting role:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || error.message });
        }
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Shield size={32} /> {t('permissionsmanagement.upravlenie_rolyami_i_pravami', 'Управление ролями и правами')}</h1>
                    <p>{t('permissionsmanagement.nastroyka_prav_dostupa_dlya_polzovateley', 'Настройка прав доступа для пользователей системы')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={20} /> {t('permissionsmanagement.sozdat_rol', 'Создать роль')}
                </button>
            </div>
            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1rem' }}>
                    {message.text}
                    <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setMessage(null)}>✕</button>
                </div>
            )}

            <div className="permissions-container">
                {/* Список ролей */}
                <div className="roles-list card">
                    <h2><Users size={24} /> {t('permissionsmanagement.roli', 'Роли')}</h2>
                    <div className="roles-items">
                        {roles.map(role => (
                            <div
                                key={role.id}
                                className={`role-item ${selectedRole?.id === role.id ? 'active' : ''}`}
                                onClick={() => setSelectedRole(role)}
                            >
                                <div className="role-info">
                                    <div className="role-name">
                                        {role.is_system && <Lock size={16} />}
                                        {role.name}
                                    </div>
                                    <div className="role-meta">
                                        {role.permissions_count} прав • {role.users_count} пользователей
                                    </div>
                                </div>
                                {!role.is_system && (
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteRole(role.id);
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Права доступа */}
                <div className="permissions-list card">
                    {selectedRole && (
                        <>
                            <div className="permissions-header">
                                <div>
                                    <h2>{selectedRole.name}</h2>
                                    <p>{selectedRole.description}</p>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={saveRolePermissions}
                                    disabled={loading || selectedRole.is_system}
                                >
                                    <Save size={20} /> Сохранить
                                </button>
                            </div>

                            <div className="permissions-grid">
                                {Object.entries(permissions).map(([module, perms]) => (
                                    <div key={module} className="permission-module">
                                        <h3><Key size={20} /> {module.toUpperCase()}</h3>
                                        {perms.map(perm => (
                                            <label key={perm.id} className="permission-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={rolePermissions.includes(perm.id)}
                                                    onChange={() => togglePermission(perm.id)}
                                                    disabled={selectedRole.is_system}
                                                />
                                                <div className="permission-info">
                                                    <div className="permission-name">{perm.name}</div>
                                                    <div className="permission-desc">{perm.description}</div>
                                                    <div className="permission-code">{perm.code}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Модальное окно создания роли */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{t('permissionsmanagement.sozdat_rol', 'Создать роль')}</h2>
                        <div className="form-group">
                            <label>{t('permissionsmanagement.kod_roli', 'Код роли *')}</label>
                            <input
                                type="text"
                                value={newRole.code}
                                onChange={e => setNewRole({ ...newRole, code: e.target.value })}
                                placeholder="manager"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('permissionsmanagement.nazvanie', 'Название *')}</label>
                            <input
                                type="text"
                                value={newRole.name}
                                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                placeholder="Менеджер"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('permissionsmanagement.opisanie', 'Описание')}</label>
                            <textarea
                                value={newRole.description}
                                onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                                placeholder="Описание роли"
                                rows={3}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                Отмена
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={createRole}
                                disabled={!newRole.code || !newRole.name}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .permissions-container {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 20px;
                    margin-top: 20px;
                }

                .roles-list, .permissions-list {
                    background: var(--card-bg);
                    border-radius: 12px;
                    padding: 20px;
                }

                .roles-items {
                    margin-top: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .role-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }

                .role-item:hover {
                    background: rgba(68, 114, 196, 0.1);
                }

                .role-item.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .role-info {
                    flex: 1;
                }

                .role-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .role-meta {
                    font-size: 12px;
                    opacity: 0.7;
                }

                .permissions-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--border-color);
                }

                .permissions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }

                .permission-module {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                    padding: 15px;
                }

                .permission-module h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 15px;
                    color: var(--primary-color);
                }

                .permission-checkbox {
                    display: flex;
                    align-items: start;
                    gap: 10px;
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .permission-checkbox:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .permission-info {
                    flex: 1;
                }

                .permission-name {
                    font-weight: 500;
                    margin-bottom: 4px;
                }

                .permission-desc {
                    font-size: 13px;
                    opacity: 0.7;
                    margin-bottom: 4px;
                }

                .permission-code {
                    font-size: 11px;
                    font-family: monospace;
                    color: var(--primary-color);
                }
            `}</style>
        </div>
    );
};

export default PermissionsManagement;
