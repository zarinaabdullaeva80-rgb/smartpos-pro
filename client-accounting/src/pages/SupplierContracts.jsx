import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Calendar, AlertTriangle, Check, Clock, Download, Edit, Eye, DollarSign } from 'lucide-react';
import { contractsAPI } from '../services/api';
import { useI18n } from '../i18n';

function SupplierContracts() {
    const { t } = useI18n();
    const [contracts, setContracts] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await contractsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setContracts(apiData.contracts || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('SupplierContracts: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Активный', color: '#10b981', bg: '#dcfce7', icon: Check },
            expiring: { label: 'Истекает', color: '#f59e0b', bg: '#fef3c7', icon: AlertTriangle },
            expired: { label: 'Истёк', color: '#ef4444', bg: '#fee2e2', icon: Clock },
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6', icon: FileText }
        };
        return statuses[status] || statuses.draft;
    };

    const getUsagePercent = (used, total) => Math.round((used / total) * 100);

    const [message, setMessage] = useState(null);
    const handleNewContract = () => setMessage({ type: 'info', text: 'Создание нового контракта...' });
    const handleView = (c) => setMessage({ type: 'info', text: `Просмотр контракта ${c.number}` });
    const handleEdit = (c) => setMessage({ type: 'info', text: `Редактирование ${c.number}` });
    const handleDownload = (c) => setMessage({ type: 'success', text: `Скачан ${c.number}` });

    return (
        <div className="supplier-contracts-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('suppliercontracts.kontrakty_s_postavschikami', '📄 Контракты с поставщиками')}</h1>
                    <p className="text-muted">{t('suppliercontracts.upravlenie_dogovorami_i_usloviyami_sotrud', 'Управление договорами и условиями сотрудничества')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleNewContract}>
                    <Plus size={18} /> Новый контракт
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <FileText size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active}</div>
                    <div style={{ color: '#666' }}>{t('suppliercontracts.aktivnyh', 'Активных')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.expiring}</div>
                    <div style={{ color: '#666' }}>{t('suppliercontracts.istekaet_skoro', 'Истекает скоро')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.total_value)}</div>
                    <div style={{ color: '#666' }}>{t('suppliercontracts.obschiy_obyom', 'Общий объём')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{formatCurrency(stats.used_value)}</div>
                    <div style={{ color: '#666' }}>{t('suppliercontracts.ispolzovano', 'Использовано')}</div>
                </div>
            </div>

            {/* Поиск */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск по номеру или поставщику..." style={{ paddingLeft: '40px', width: '100%' }} />
                    </div>
                    <select style={{ width: '200px' }}>
                        <option value="all">{t('suppliercontracts.vse_statusy', 'Все статусы')}</option>
                        <option value="active">{t('suppliercontracts.aktivnye', 'Активные')}</option>
                        <option value="expiring">{t('suppliercontracts.istekayuschie', 'Истекающие')}</option>
                        <option value="expired">{t('suppliercontracts.istyokshie', 'Истёкшие')}</option>
                    </select>
                </div>
            </div>

            {/* Список контрактов */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('suppliercontracts.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('suppliercontracts.num_kontrakta', '№ Контракта')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('suppliercontracts.postavschik', 'Поставщик')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('suppliercontracts.period', 'Период')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('suppliercontracts.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('suppliercontracts.ispolzovano', 'Использовано')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('suppliercontracts.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('suppliercontracts.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map(contract => {
                                const statusInfo = getStatusInfo(contract.status);
                                const StatusIcon = statusInfo.icon;
                                const usagePercent = getUsagePercent(contract.used_value, contract.total_value);

                                return (
                                    <tr key={contract.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{contract.number}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>Оплата: {contract.payment_terms}</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{contract.supplier}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>ИНН: {contract.supplier_inn}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Calendar size={14} color="#888" />
                                                <span>{formatDate(contract.start_date)} — {formatDate(contract.end_date)}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(contract.total_value)}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${usagePercent}%`,
                                                        height: '100%',
                                                        background: usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#10b981'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '40px' }}>{usagePercent}%</span>
                                            </div>
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
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleView(contract)} title={t('suppliercontracts.prosmotr', 'Просмотр')}><Eye size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(contract)} title={t('suppliercontracts.redaktirovat', 'Редактировать')}><Edit size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleDownload(contract)} title={t('suppliercontracts.skachat', 'Скачать')}><Download size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default SupplierContracts;
