import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Download, Eye, Edit, Check, Clock, AlertTriangle, Calendar, X, RefreshCw, Trash2 } from 'lucide-react';
import ExportButton from '../components/ExportButton';
import { contractsAPI } from '../services/api';
import { useI18n } from '../i18n';


function ContractsPage() {
    const { t } = useI18n();
    const [contracts, setContracts] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        counterparty_name: '',
        type: 'supply',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        amount: '',
        currency: 'UZS',
        auto_renew: false,
        terms: '',
        notes: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await contractsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setContracts(apiData.contracts || []);
            setStats(apiData.stats || { active: 2, expiring: 1, expired: 0, total_amount: 5360000000 });
        } catch (err) {
            console.warn('Contracts: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleCreateContract = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.end_date) {
            setMessage({ type: 'error', text: 'Заполните обязательные поля' });
            return;
        }

        try {
            const response = await contractsAPI.create(formData);
            const newContract = response.data || response;
            setContracts([newContract, ...contracts]);
            setShowModal(false);
            resetForm();
            setMessage({ type: 'success', text: 'Договор создан!' });
        } catch (error) {
            console.warn('Contracts: не удалось загрузить данные', error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', counterparty_name: '', type: 'supply',
            start_date: new Date().toISOString().split('T')[0], end_date: '',
            amount: '', currency: 'UZS', auto_renew: false, terms: '', notes: ''
        });
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            active: { label: 'Действует', color: '#10b981', bg: '#dcfce7', icon: Check },
            expiring: { label: 'Истекает', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            expired: { label: 'Истёк', color: '#ef4444', bg: '#fee2e2', icon: AlertTriangle },
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6', icon: Edit },
            terminated: { label: 'Расторгнут', color: '#6b7280', bg: '#f3f4f6', icon: X }
        };
        return statuses[status] || statuses.draft;
    };

    const getTypeLabel = (type) => {
        const types = { supply: 'Поставка', rent: 'Аренда', service: 'Услуги', sale: 'Продажа' };
        return types[type] || type;
    };

    const filteredContracts = contracts.filter(c => {
        const matchesSearch =
            c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.counterparty_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchesType = filterType === 'all' || c.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    return (
        <div className="contracts-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('contracts.dogovory', '📑 Договоры')}</h1>
                    <p className="text-muted">Шаблоны и хранение договоров ({contracts.length})</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <ExportButton
                        data={contracts}
                        filename="Договоры"
                        sheetName="Договоры"
                        columns={{
                            contract_number: '№ Договора', name: 'Название', counterparty_name: 'Контрагент',
                            type: 'Тип', start_date: 'Начало', end_date: 'Окончание', amount: 'Сумма', status: 'Статус'
                        }}
                    />
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Новый договор
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: message.type === 'success' ? '#dcfce7' : '#fee2e2' }}>
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{stats.active || filteredContracts.filter(c => c.status === 'active').length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('contracts.deystvuyuschih', 'Действующих')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.expiring || filteredContracts.filter(c => c.status === 'expiring').length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('contracts.istekaet_skoro', 'Истекает скоро')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{stats.expired || filteredContracts.filter(c => c.status === 'expired').length}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('contracts.istyokshih', 'Истёкших')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(stats.total_amount || contracts.reduce((s, c) => s + parseFloat(c.amount || 0), 0))}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('contracts.obschaya_summa', 'Общая сумма')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('contracts.spisok_dogovorov', '📋 Список договоров')}</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="all">{t('contracts.vse_tipy', 'Все типы')}</option>
                            <option value="supply">{t('contracts.postavka', 'Поставка')}</option>
                            <option value="rent">{t('contracts.arenda', 'Аренда')}</option>
                            <option value="service">{t('contracts.uslugi', 'Услуги')}</option>
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">{t('contracts.vse_statusy', 'Все статусы')}</option>
                            <option value="active">{t('contracts.deystvuyuschie', 'Действующие')}</option>
                            <option value="expiring">{t('contracts.istekayuschie', 'Истекающие')}</option>
                            <option value="expired">{t('contracts.istyokshie', 'Истёкшие')}</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '40px', width: '200px' }} />
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('contracts.zagruzka', 'Загрузка...')}</div>
                ) : filteredContracts.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
                        <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <div>{t('contracts.dogovory_ne_naydeny', 'Договоры не найдены')}</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('contracts.num_dogovora', '№ Договора')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Контрагент</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('contracts.tip', 'Тип')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('contracts.period', 'Период')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('contracts.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('contracts.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('contracts.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContracts.map(contract => {
                                const statusInfo = getStatusInfo(contract.status);
                                const StatusIcon = statusInfo.icon;
                                return (
                                    <tr key={contract.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--primary)' }}>{contract.contract_number || contract.id}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{contract.name}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{contract.counterparty_name || '-'}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>
                                                {getTypeLabel(contract.type)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '13px' }}>{formatDate(contract.start_date)} — {formatDate(contract.end_date)}</div>
                                            {contract.auto_renew && <div style={{ fontSize: '11px', color: '#10b981' }}>{t('contracts.avtoprodlenie', '🔄 Автопродление')}</div>}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(contract.amount)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <StatusIcon size={12} /> {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('contracts.prosmotr', 'Просмотр')}><Eye size={14} /></button>
                                                <button className="btn btn-sm btn-secondary" title={t('contracts.skachat', 'Скачать')}><Download size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Модальное окно создания договора */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{t('contracts.novyy_dogovor', '📑 Новый договор')}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>×</button>
                        </div>
                        <form onSubmit={handleCreateContract}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>{t('contracts.nazvanie_dogovora', 'Название договора *')}</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Например: Договор поставки №123" required />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Контрагент</label>
                                        <input type="text" value={formData.counterparty_name} onChange={e => setFormData({ ...formData, counterparty_name: e.target.value })} placeholder="Название организации" />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('contracts.tip_dogovora', 'Тип договора')}</label>
                                        <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                            <option value="supply">{t('contracts.postavka', 'Поставка')}</option>
                                            <option value="rent">{t('contracts.arenda', 'Аренда')}</option>
                                            <option value="service">{t('contracts.uslugi', 'Услуги')}</option>
                                            <option value="sale">{t('contracts.prodazha', 'Продажа')}</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>{t('contracts.summa_dogovora', 'Сумма договора')}</label>
                                        <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0" />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('contracts.data_nachala', 'Дата начала *')}</label>
                                        <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />
                                    </div>

                                    <div className="form-group">
                                        <label>{t('contracts.data_okonchaniya', 'Дата окончания *')}</label>
                                        <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} required />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={formData.auto_renew} onChange={e => setFormData({ ...formData, auto_renew: e.target.checked })} />
                                            🔄 Автоматическое продление
                                        </label>
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>{t('contracts.usloviya_dogovora', 'Условия договора')}</label>
                                        <textarea value={formData.terms} onChange={e => setFormData({ ...formData, terms: e.target.value })} rows={3} placeholder="Основные условия..." />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>{t('contracts.primechaniya', 'Примечания')}</label>
                                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} placeholder="Дополнительная информация..." />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('contracts.otmena', 'Отмена')}</button>
                                <button type="submit" className="btn btn-primary">
                                    <Plus size={16} /> Создать договор
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContractsPage;

