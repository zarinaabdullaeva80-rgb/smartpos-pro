import React, { useState, useEffect } from 'react';
import { Printer, Monitor, CreditCard, Scan, Wifi, WifiOff, Settings, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, X, Check } from 'lucide-react';
import api from '../services/api';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function Equipment() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [equipment, setEquipment] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [selectedType, setSelectedType] = useState('all');
    const [message, setMessage] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'receipt_printer',
        model: '',
        serial: '',
        ip: '',
        location: ''
    });

    useEffect(() => { loadEquipment(); }, []);

    const loadEquipment = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setEquipment(apiData.equipment || []);
        } catch (err) {
            console.warn('Equipment: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleAddEquipment = async () => {
        if (!formData.name || !formData.type || !formData.serial) {
            setMessage({ type: 'error', text: 'Заполните обязательные поля' });
            return;
        }
        try {
            await api.post('/equipment', formData);
            setMessage({ type: 'success', text: 'Оборудование добавлено' });
            setShowAdd(false);
            resetForm();
            loadEquipment();
        } catch (error) {
            console.warn('Equipment: не удалось загрузить данные', error.message);
        }
    };

    const handleDeleteEquipment = async (id) => {
        if (!(await confirm({ variant: 'danger', message: 'Удалить это устройство?' }))) return;
        try {
            await api.delete(`/equipment/${id}`);
            loadEquipment();
            setMessage({ type: 'success', text: 'Устройство удалено' });
        } catch (error) {
            setEquipment(equipment.filter(e => e.id !== id));
            setMessage({ type: 'success', text: 'Устройство удалено' });
        }
    };

    const handleSettings = (eq) => {
        setFormData(eq);
        setShowAdd(true);
    };

    const resetForm = () => {
        setFormData({ name: '', type: 'receipt_printer', model: '', serial: '', ip: '', location: '' });
    };

    const getTypeIcon = (type) => {
        const icons = {
            'pos_terminal': Monitor,
            'receipt_printer': Printer,
            'barcode_scanner': Scan,
            'scale': Monitor,
            'card_terminal': CreditCard
        };
        return icons[type] || Monitor;
    };

    const getTypeName = (type) => {
        const names = {
            'pos_terminal': 'POS-терминал',
            'receipt_printer': 'Чековый принтер',
            'barcode_scanner': 'Сканер',
            'scale': 'Весы',
            'card_terminal': 'Терминал оплаты'
        };
        return names[type] || type;
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const filteredEquipment = selectedType === 'all'
        ? equipment
        : equipment.filter(e => e.type === selectedType);

    const onlineCount = equipment.filter(e => e.status === 'online').length;
    const offlineCount = equipment.filter(e => e.status === 'offline').length;

    return (
        <div className="equipment-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('equipment.oborudovanie', '🖨️ Оборудование')}</h1>
                    <p className="text-muted">{t('equipment.upravlenie_torgovym_oborudovaniem', 'Управление торговым оборудованием')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={loadEquipment}>
                        <RefreshCw size={18} /> Обновить
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                        <Plus size={18} /> Добавить
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Monitor size={24} color="#3b82f6" />
                    </div>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{equipment.length}</div>
                        <div style={{ color: '#666' }}>{t('equipment.vsego_ustroystv', 'Всего устройств')}</div>
                    </div>
                </div>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wifi size={24} color="#16a34a" />
                    </div>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>{onlineCount}</div>
                        <div style={{ color: '#666' }}>{t('equipment.v_seti', 'В сети')}</div>
                    </div>
                </div>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <WifiOff size={24} color="#dc2626" />
                    </div>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{offlineCount}</div>
                        <div style={{ color: '#666' }}>{t('equipment.ne_v_seti', 'Не в сети')}</div>
                    </div>
                </div>
            </div>

            {/* Фильтр */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: 'Все' },
                        { key: 'pos_terminal', label: 'POS' },
                        { key: 'receipt_printer', label: 'Принтеры' },
                        { key: 'barcode_scanner', label: 'Сканеры' },
                        { key: 'scale', label: 'Весы' },
                        { key: 'card_terminal', label: 'Терминалы' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setSelectedType(f.key)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: selectedType === f.key ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: selectedType === f.key ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Список */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('equipment.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('equipment.ustroystvo', 'Устройство')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('equipment.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('equipment.model_seriynyy', 'Модель / Серийный')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>IP</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('equipment.lokatsiya', 'Локация')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('equipment.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('equipment.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEquipment.map(eq => {
                                const Icon = getTypeIcon(eq.type);
                                return (
                                    <tr key={eq.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '40px', height: '40px', borderRadius: '10px',
                                                    background: eq.status === 'online' ? '#dcfce7' : '#fee2e2',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <Icon size={20} color={eq.status === 'online' ? '#16a34a' : '#dc2626'} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{eq.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                                        Последнее: {formatDate(eq.last_seen)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px' }}>{getTypeName(eq.type)}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{eq.model}</div>
                                            <div style={{ fontSize: '12px', color: '#888', fontFamily: 'monospace' }}>{eq.serial}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{eq.ip || '-'}</td>
                                        <td style={{ padding: '12px' }}>{eq.location}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {eq.status === 'online' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '12px', fontSize: '13px' }}>
                                                    <CheckCircle2 size={14} /> {t('equipment.v_seti', 'В сети')}
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#dc2626', padding: '4px 12px', borderRadius: '12px', fontSize: '13px' }}>
                                                    <AlertCircle size={14} /> Офлайн
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('equipment.nastroyki', 'Настройки')} onClick={() => handleSettings(eq)}>
                                                    <Settings size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-danger" title={t('equipment.udalit', 'Удалить')} onClick={() => handleDeleteEquipment(eq.id)}>
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

            {/* Модал добавления */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('equipment.dobavit_oborudovanie', '➕ Добавить оборудование')}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('equipment.nazvanie', 'Название *')}</label>
                                <input type="text" placeholder="Чековый принтер #3" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('equipment.tip_ustroystva', 'Тип устройства')}</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="receipt_printer">{t('equipment.chekovyy_printer', 'Чековый принтер')}</option>
                                    <option value="pos_terminal">{t('equipment.terminal', 'POS-терминал')}</option>
                                    <option value="barcode_scanner">{t('equipment.skaner_shtrihkodov', 'Сканер штрихкодов')}</option>
                                    <option value="scale">Весы</option>
                                    <option value="card_terminal">{t('equipment.terminal_oplaty', 'Терминал оплаты')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('equipment.model', 'Модель')}</label>
                                <input type="text" placeholder="Epson TM-T20III" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('equipment.seriynyy_nomer', 'Серийный номер *')}</label>
                                <input type="text" placeholder="EPS-2023-XXXXX" value={formData.serial} onChange={e => setFormData({ ...formData, serial: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('equipment.adres_esli_est', 'IP-адрес (если есть)')}</label>
                                <input type="text" placeholder="192.168.1.XXX" value={formData.ip} onChange={e => setFormData({ ...formData, ip: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t('equipment.lokatsiya', 'Локация')}</label>
                                <input type="text" placeholder="Касса 1" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>{t('equipment.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={handleAddEquipment}>
                                <Plus size={18} /> {formData.id ? 'Сохранить' : 'Добавить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Equipment;
