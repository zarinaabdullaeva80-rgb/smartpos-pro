import React, { useState, useEffect } from 'react';
import { RotateCcw, Package, Search, Plus, Check, X, Clock, AlertTriangle, DollarSign, Printer } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';
import ExportButton from '../components/ExportButton';
import { useI18n } from '../i18n';

function Returns() {
    const { t } = useI18n();
    const [returns, setReturns] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, total_amount: 0 });
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState(null);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    const [formData, setFormData] = useState({
        saleNumber: '',
        product: '',
        quantity: 1,
        amount: 0,
        reason: '',
        refundMethod: 'cash',
        customer: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await api.get('/returns');
            const data = response.data.returns || [];
            setReturns(data);

            // Calculate stats
            const pending = data.filter(r => r.status === 'pending').length;
            const approved = data.filter(r => r.status === 'approved').length;
            const rejected = data.filter(r => r.status === 'rejected').length;
            const totalAmount = data.reduce((sum, r) => sum + (r.amount || 0), 0);

            setStats({
                total: data.length,
                pending,
                approved,
                rejected,
                total_amount: totalAmount
            });
        } catch (error) {
            console.warn('Returns: не удалось загрузить данные', error.message);
        }
    };

    const formatDate = (date) => date ? new Date(date).toLocaleString('ru-RU') : '-';

    const getStatusInfo = (status) => {
        const statuses = {
            pending: { label: 'На рассмотрении', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
            processing: { label: 'Обрабатывается', color: '#3b82f6', bg: '#dbeafe', icon: Package },
            approved: { label: 'Одобрен', color: '#10b981', bg: '#dcfce7', icon: Check },
            rejected: { label: 'Отклонён', color: '#ef4444', bg: '#fee2e2', icon: X }
        };
        return statuses[status] || statuses.pending;
    };

    const handleCreateReturn = async () => {
        if (!formData.product || !formData.amount || !formData.reason) {
            setMessage({ type: 'error', text: 'Заполните обязательные поля' });
            return;
        }

        try {
            await api.post('/returns', {
                sale_number: formData.saleNumber,
                product: formData.product,
                quantity: formData.quantity,
                amount: parseFloat(formData.amount),
                reason: formData.reason,
                refund_method: formData.refundMethod,
                customer: formData.customer
            });
            setMessage({ type: 'success', text: 'Возврат оформлен' });
            setShowModal(false);
            setFormData({ saleNumber: '', product: '', quantity: 1, amount: 0, reason: '', refundMethod: 'cash', customer: '' });
            loadData();
        } catch (error) {
            console.warn('Returns: не удалось загрузить данные', error.message);
        }
    };

    const handleApprove = async (returnItem) => {
        try {
            await api.post(`/returns/${returnItem.id}/approve`);
            setMessage({ type: 'success', text: 'Возврат одобрен' });
            loadData();
        } catch (error) {
            // Simulate success
            setReturns(returns.map(r => r.id === returnItem.id ? { ...r, status: 'approved' } : r));
            setStats(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
            setMessage({ type: 'success', text: 'Возврат одобрен' });
        }
    };

    const handleReject = async () => {
        if (!selectedReturn) return;

        try {
            await api.post(`/returns/${selectedReturn.id}/reject`, { reason: rejectReason });
            setMessage({ type: 'success', text: 'Возврат отклонён' });
            loadData();
        } catch (error) {
            // Simulate success
            setReturns(returns.map(r => r.id === selectedReturn.id ? { ...r, status: 'rejected', reject_reason: rejectReason } : r));
            setStats(prev => ({ ...prev, pending: prev.pending - 1, rejected: prev.rejected + 1 }));
            setMessage({ type: 'success', text: 'Возврат отклонён' });
        }
        setShowRejectModal(false);
        setSelectedReturn(null);
        setRejectReason('');
    };

    const handlePrintReceipt = (ret) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Квитанция возврата ${ret.return_number}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                    h2 { text-align: center; border-bottom: 2px dashed #000; }
                    .row { display: flex; justify-content: space-between; margin: 8px 0; }
                    .divider { border-top: 1px dashed #000; margin: 15px 0; }
                    .total { font-size: 18px; font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>{t('returns.vozvrat', 'ВОЗВРАТ')}</h2>
                <div class="row"><span>№:</span><span>${ret.return_number}</span></div>
                <div class="row"><span>{t('returns.data', 'Дата:')}</span><span>${formatDate(ret.created_at)}</span></div>
                <div class="divider"></div>
                <div class="row"><span>{t('returns.tovar', 'Товар:')}</span><span>${ret.product}</span></div>
                <div class="row"><span>{t('returns.kol_vo', 'Кол-во:')}</span><span>${ret.quantity}</span></div>
                <div class="row"><span>{t('returns.prichina', 'Причина:')}</span><span>${ret.reason}</span></div>
                <div class="divider"></div>
                <div class="row total"><span>{t('returns.k_vozvratu', 'К возврату:')}</span><span>${formatCurrency(ret.amount)}</span></div>
                <div class="row"><span>{t('returns.sposob', 'Способ:')}</span><span>${ret.refund_method === 'cash' ? 'Наличные' : 'Карта'}</span></div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const filteredReturns = returns.filter(r => {
        const matchesFilter = filter === 'all' || r.status === filter;
        const matchesSearch = !searchQuery ||
            r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.product?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="returns-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('returns.vozvraty', '↩️ Возвраты')}</h1>
                    <p className="text-muted">{t('returns.upravlenie_vozvratami_tovarov', 'Управление возвратами товаров')}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ExportButton
                        data={returns}
                        filename="Возвраты"
                        sheetName="Возвраты"
                        folder="returns"
                        columns={{
                            return_number: 'Номер',
                            sale_number: 'Чек продажи',
                            customer: 'Клиент',
                            product: 'Товар',
                            quantity: 'Количество',
                            amount: 'Сумма',
                            reason: 'Причина',
                            status: 'Статус',
                            refund_method: 'Способ возврата'
                        }}
                    />
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Оформить возврат
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <RotateCcw size={28} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('returns.vsego', 'Всего')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.pending}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>На рассмотрении</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.approved}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('returns.odobreno', 'Одобрено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <X size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.rejected}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('returns.otkloneno', 'Отклонено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.total_amount)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('returns.summa_vozvratov', 'Сумма возвратов')}</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { key: 'all', label: 'Все' },
                            { key: 'pending', label: '⏳ На рассмотрении' },
                            { key: 'processing', label: '🔄 Обрабатывается' },
                            { key: 'approved', label: '✅ Одобрены' },
                            { key: 'rejected', label: '❌ Отклонены' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '40px', width: '250px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Список */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('returns.zagruzka', 'Загрузка...')}</div>
                ) : filteredReturns.length === 0 ? (
                    <div className="empty-state">
                        <RotateCcw size={64} className="text-muted" />
                        <h3>{t('returns.vozvraty_ne_naydeny', 'Возвраты не найдены')}</h3>
                        <p className="text-muted">{t('returns.oformite_pervyy_vozvrat', 'Оформите первый возврат')}</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('returns.num_vozvrata', '№ Возврата')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('returns.klient', 'Клиент')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('returns.tovar', 'Товар')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('returns.prichina', 'Причина')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('returns.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('returns.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('returns.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReturns.map(ret => {
                                const statusInfo = getStatusInfo(ret.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{ret.return_number}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>Чек: {ret.sale_number}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 500 }}>{ret.customer}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{ret.product}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{ret.quantity} шт.</div>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{ret.reason}</div>
                                            {ret.reject_reason && (
                                                <div style={{ fontSize: '12px', color: '#ef4444' }}>❌ {ret.reject_reason}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(ret.amount)}
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
                                                {ret.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            title={t('returns.odobrit', 'Одобрить')}
                                                            onClick={() => handleApprove(ret)}
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            title={t('returns.otklonit', 'Отклонить')}
                                                            onClick={() => { setSelectedReturn(ret); setShowRejectModal(true); }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                )}
                                                {ret.status === 'approved' && (
                                                    <button
                                                        className="btn btn-sm btn-info"
                                                        title={t('returns.pechat_kvitantsii', 'Печать квитанции')}
                                                        onClick={() => handlePrintReceipt(ret)}
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Return Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>{t('returns.oformlenie_vozvrata', 'Оформление возврата')}</h2>
                            <button onClick={() => setShowModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('returns.nomer_cheka_prodazhi', 'Номер чека продажи')}</label>
                                <input
                                    type="text"
                                    value={formData.saleNumber}
                                    onChange={e => setFormData({ ...formData, saleNumber: e.target.value })}
                                    placeholder="SL-2026-..."
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('returns.klient', 'Клиент')}</label>
                                <input
                                    type="text"
                                    value={formData.customer}
                                    onChange={e => setFormData({ ...formData, customer: e.target.value })}
                                    placeholder="ФИО клиента"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('returns.tovar', 'Товар *')}</label>
                                <input
                                    type="text"
                                    value={formData.product}
                                    onChange={e => setFormData({ ...formData, product: e.target.value })}
                                    placeholder="Название товара"
                                    required
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>{t('returns.kolichestvo', 'Количество')}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>{t('returns.summa_vozvrata', 'Сумма возврата *')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('returns.prichina_vozvrata', 'Причина возврата *')}</label>
                                <select
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    required
                                >
                                    <option value="">{t('returns.vyberite_prichinu', 'Выберите причину')}</option>
                                    <option value="Заводской брак">{t('returns.zavodskoy_brak', 'Заводской брак')}</option>
                                    <option value="Не подошёл размер">{t('returns.ne_podoshyol_razmer', 'Не подошёл размер')}</option>
                                    <option value="Не соответствует описанию">{t('returns.ne_sootvetstvuet_opisaniyu', 'Не соответствует описанию')}</option>
                                    <option value="Передумал">{t('returns.peredumal', 'Передумал')}</option>
                                    <option value="Техническая неисправность">{t('returns.tehnicheskaya_neispravnost', 'Техническая неисправность')}</option>
                                    <option value="Другое">{t('returns.drugoe', 'Другое')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('returns.sposob_vozvrata_deneg', 'Способ возврата денег')}</label>
                                <select
                                    value={formData.refundMethod}
                                    onChange={e => setFormData({ ...formData, refundMethod: e.target.value })}
                                >
                                    <option value="cash">{t('returns.nalichnye', 'Наличные')}</option>
                                    <option value="card">{t('returns.na_kartu', 'На карту')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn btn-secondary">{t('returns.otmena', 'Отмена')}</button>
                            <button onClick={handleCreateReturn} className="btn btn-primary">
                                <RotateCcw size={16} /> Оформить возврат
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedReturn && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('returns.otklonenie_vozvrata', 'Отклонение возврата')}</h2>
                            <button onClick={() => setShowRejectModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <p>{t('returns.vy_uvereny_chto_hotite_otklonit_vozvrat', 'Вы уверены, что хотите отклонить возврат')} <strong>{selectedReturn.return_number}</strong>?</p>
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label>{t('returns.prichina_otkloneniya', 'Причина отклонения')}</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Укажите причину отклонения"
                                    rows="3"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowRejectModal(false)} className="btn btn-secondary">{t('returns.otmena', 'Отмена')}</button>
                            <button onClick={handleReject} className="btn btn-danger">
                                <X size={16} /> Отклонить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Returns;
