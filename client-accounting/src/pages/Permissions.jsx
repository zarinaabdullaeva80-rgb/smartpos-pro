import React, { useState, useEffect } from 'react';
import { Shield, Users, Lock, Unlock, Check, X, Plus, Edit, Trash2, Search, Eye } from 'lucide-react';
import { permissionsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Permissions() {
    const { t } = useI18n();
    const toast = useToast();
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await permissionsAPI.getRoles();
            const apiData = apiRes.data || apiRes;
            console.log('Permissions.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('Permissions: не удалось загрузить данные', err.message);
        }


        setSelectedRole(1);
        setLoading(false);
    };

    const roleMap = { 1: 'admin', 2: 'manager', 3: 'cashier', 4: 'accountant', 5: 'warehouse' };

    const togglePermission = (moduleIdx, permIdx) => {
        const roleKey = roleMap[selectedRole];
        setPermissions(prev => {
            const updated = [...prev];
            updated[moduleIdx] = {
                ...updated[moduleIdx],
                items: updated[moduleIdx].items.map((item, idx) =>
                    idx === permIdx ? { ...item, [roleKey]: !item[roleKey] } : item
                )
            };
            return updated;
        });
    };

    const [message, setMessage] = useState(null);
    const handleNewRole = () => setMessage({ type: 'info', text: 'Создание новой роли...' });

    return (
        <div className="permissions-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('permissions.prava_dostupa', '🔐 Права доступа')}</h1>
                    <p className="text-muted">{t('permissions.upravlenie_rolyami_i_razresheniyami', 'Управление ролями и разрешениями')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewRole}>
                    <Plus size={18} /> Новая роль
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                {/* Список ролей */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('permissions.roli', '👥 Роли')}</h3>
                    </div>
                    {roles.map(role => (
                        <div
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                background: selectedRole === role.id ? 'var(--primary-light)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <div style={{
                                width: '36px', height: '36px',
                                borderRadius: '50%',
                                background: `${role.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Shield size={18} color={role.color} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{role.name}</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>{role.users} пользователей</div>
                            </div>
                            <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Редактирование роли: ${role.name}`)}><Edit size={12} /></button>
                        </div>
                    ))}
                </div>

                {/* Матрица прав */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>📋 Разрешения для роли: {roles.find(r => r.id === selectedRole)?.name}</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => toast.info('Предпросмотр прав...')}>
                            <Eye size={14} /> Предпросмотр
                        </button>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('permissions.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {permissions.map((group, idx) => (
                                <div key={idx}>
                                    <div style={{
                                        padding: '12px 16px',
                                        background: 'var(--bg-secondary)',
                                        fontWeight: 'bold',
                                        position: 'sticky',
                                        top: 0
                                    }}>
                                        {group.module}
                                    </div>
                                    {group.items.map((perm, pIdx) => {
                                        const roleKey = roleMap[selectedRole];
                                        const hasPermission = perm[roleKey];

                                        return (
                                            <div key={pIdx} style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid var(--border-color)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    {hasPermission ? (
                                                        <div style={{
                                                            width: '24px', height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#dcfce7',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Check size={14} color="#10b981" />
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            width: '24px', height: '24px',
                                                            borderRadius: '50%',
                                                            background: '#fee2e2',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <X size={14} color="#ef4444" />
                                                        </div>
                                                    )}
                                                    <span>{perm.name}</span>
                                                </div>
                                                <label className="switch" style={{ position: 'relative', width: '44px', height: '24px' }}>
                                                    <input type="checkbox" checked={hasPermission} onChange={() => togglePermission(idx, pIdx)} style={{ opacity: 0 }} />
                                                    <span style={{
                                                        position: 'absolute',
                                                        top: 0, left: 0, right: 0, bottom: 0,
                                                        background: hasPermission ? '#10b981' : '#ccc',
                                                        borderRadius: '24px',
                                                        cursor: 'pointer',
                                                        transition: '0.3s'
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute',
                                                            left: hasPermission ? '22px' : '2px',
                                                            top: '2px',
                                                            width: '20px',
                                                            height: '20px',
                                                            background: 'white',
                                                            borderRadius: '50%',
                                                            transition: '0.3s'
                                                        }} />
                                                    </span>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Permissions;
