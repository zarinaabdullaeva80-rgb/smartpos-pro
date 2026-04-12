import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Printer, Download, Send, Eye, Check, Clock, X, Trash2 } from 'lucide-react';
import { invoicesAPI } from '../services/api';
import useActionHandler from '../hooks/useActionHandler';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function InvoicesPage() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [viewingInvoice, setViewingInvoice] = useState(null);
    const [newInvoice, setNewInvoice] = useState({
        customer: '',
        items: [],
        dueDate: ''
    });

    const { handleSuccess, handleError, handlePrint, handleExport } = useActionHandler();

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await invoicesAPI.getAll();
            const data = response.data;
            const invoicesList = data.invoices || data || [];
            setInvoices(invoicesList.map(inv => ({
                id: inv.invoice_number || inv.id,
                dbId: inv.id,
                date: inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '',
                customer: inv.counterparty_name || 'Контрагент не указан',
                items: inv.items_count || 0,
                subtotal: parseFloat(inv.total_amount) || 0,
                nds: parseFloat(inv.vat_amount) || 0,
                total: parseFloat(inv.final_amount || inv.total_amount) || 0,
                status: inv.status || 'draft',
                due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : null
            })));

            // Calculate stats from data
            const paid = invoicesList.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.final_amount || i.total_amount || 0), 0);
            const overdue = invoicesList.filter(i => i.status === 'overdue').reduce((s, i) => s + parseFloat(i.final_amount || i.total_amount || 0), 0);
            const total = invoicesList.reduce((s, i) => s + parseFloat(i.final_amount || i.total_amount || 0), 0);
            setStats({ total, paid, pending: total - paid - overdue, overdue, count: invoicesList.length });
        } catch (error) {
            console.warn('Invoices: не удалось загрузить данные', error.message);
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            draft: { label: 'Черновик', color: '#888', bg: '#f3f4f6', icon: FileText },
            sent: { label: 'Отправлен', color: '#3b82f6', bg: '#dbeafe', icon: Send },
            paid: { label: 'Оплачен', color: '#10b981', bg: '#dcfce7', icon: Check },
            overdue: { label: 'Просрочен', color: '#ef4444', bg: '#fee2e2', icon: Clock }
        };
        return statuses[status] || statuses.draft;
    };

    // Action handlers
    const handleViewInvoice = (invoice) => {
        setViewingInvoice(invoice);
    };

    const handlePrintInvoice = (invoice) => {
        const printContent = `
            <div style="font-family: Arial; padding: 20px;">
                <h1>Счёт-фактура ${invoice.id}</h1>
                <p><strong>{t('invoices.data', 'Дата:')}</strong> ${invoice.date}</p>
                <p><strong>{t('invoices.kontragent', 'Контрагент:')}</strong> ${invoice.customer}</p>
                <p><strong>{t('invoices.summa', 'Сумма:')}</strong> ${formatCurrency(invoice.subtotal)}</p>
                <p><strong>{t('invoices.nds', 'НДС:')}</strong> ${formatCurrency(invoice.nds)}</p>
                <p><strong>{t('invoices.itogo', 'Итого:')}</strong> ${formatCurrency(invoice.total)}</p>
            </div>
        `;
        handlePrint(printContent, { title: `Счёт ${invoice.id}` });
    };

    const handleDownloadInvoice = (invoice) => {
        handleExport(invoice, `invoice_${invoice.id}.json`);
        handleSuccess(`Счёт ${invoice.id} скачан`);
    };

    const handleDeleteInvoice = async (invoice) => {
        if (!(await confirm({ variant: 'danger', message: `Удалить счёт ${invoice.id}?` }))) return;
        try {
            if (invoice.dbId) {
                await invoicesAPI.delete(invoice.dbId);
            }
            setInvoices(invoices.filter(i => i.id !== invoice.id));
            handleSuccess(`Счёт ${invoice.id} удалён`);
        } catch (error) {
            setInvoices(invoices.filter(i => i.id !== invoice.id));
            handleSuccess(`Счёт ${invoice.id} удалён локально`);
        }
    };

    const handleCreateInvoice = () => {
        setShowModal(true);
    };

    const handleSaveInvoice = async () => {
        if (!newInvoice.customer) {
            handleError('Укажите контрагента');
            return;
        }
        try {
            const invoiceData = {
                invoice_number: `СФ-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
                invoice_date: new Date().toISOString().split('T')[0],
                counterparty_id: null,
                items: newInvoice.items || [],
                total_amount: 0,
                vat_amount: 0,
                final_amount: 0
            };
            const response = await invoicesAPI.create(invoiceData);
            await loadData(); // Reload from server
            setShowModal(false);
            setNewInvoice({ customer: '', items: [], dueDate: '' });
            handleSuccess(`Счёт ${invoiceData.invoice_number} создан`);
        } catch (error) {
            console.warn('Invoices: не удалось загрузить данные', error.message);
        }
    };

    return (
        <div className="invoices-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('invoices.scheta_faktury', '🧾 Счета-фактуры')}</h1>
                    <p className="text-muted">{t('invoices.generatsiya_i_upravlenie_schetami', 'Генерация и управление счетами')}</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreateInvoice}>
                    <Plus size={18} /> Новый счёт
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(stats.total)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('invoices.vsego_vystavleno', 'Всего выставлено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dcfce7' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(stats.paid)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('invoices.oplacheno', 'Оплачено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#dbeafe' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(stats.pending)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('invoices.ozhidaet_oplaty', 'Ожидает оплаты')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#fee2e2' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>{formatCurrency(stats.overdue)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('invoices.prosrocheno', 'Просрочено')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('invoices.spisok_schetov_faktur', '📋 Список счетов-фактур')}</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select>
                            <option>{t('invoices.vse_statusy', 'Все статусы')}</option>
                            <option>{t('invoices.chernoviki', 'Черновики')}</option>
                            <option>{t('invoices.otpravleny', 'Отправлены')}</option>
                            <option>{t('invoices.oplacheny', 'Оплачены')}</option>
                            <option>{t('invoices.prosrocheny', 'Просрочены')}</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск..." style={{ paddingLeft: '40px', width: '200px' }} />
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('invoices.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('invoices.num_schyota', '№ Счёта')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('invoices.data', 'Дата')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('invoices.kontragent', 'Контрагент')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('invoices.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('invoices.nds', 'НДС')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('invoices.itogo', 'Итого')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('invoices.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('invoices.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(inv => {
                                const statusInfo = getStatusInfo(inv.status);
                                const StatusIcon = statusInfo.icon;

                                return (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                fontWeight: 500,
                                                color: 'var(--primary)'
                                            }}>
                                                {inv.id}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>{inv.date}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{inv.customer}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{inv.items} позиций</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(inv.subtotal)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#888' }}>{formatCurrency(inv.nds)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(inv.total)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
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
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" title={t('invoices.prosmotr', 'Просмотр')} onClick={() => handleViewInvoice(inv)}>
                                                    <Eye size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('invoices.pechat', 'Печать')} onClick={() => handlePrintInvoice(inv)}>
                                                    <Printer size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" title={t('invoices.skachat', 'Скачать PDF')} onClick={() => handleDownloadInvoice(inv)}>
                                                    <Download size={14} />
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

            {/* Modal для нового счёта */}
            {showModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--bg-primary)', borderRadius: '12px',
                        padding: '24px', width: '500px', maxWidth: '90vw'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>{t('invoices.novyy_schyot_faktura', 'Новый счёт-фактура')}</h2>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('invoices.kontragent', 'Контрагент')}</label>
                                <input
                                    type="text"
                                    value={newInvoice.customer}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, customer: e.target.value })}
                                    placeholder="Введите название контрагента"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>{t('invoices.srok_oplaty', 'Срок оплаты')}</label>
                                <input
                                    type="date"
                                    value={newInvoice.dueDate}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('invoices.otmena', 'Отмена')}</button>
                                <button className="btn btn-primary" onClick={handleSaveInvoice}>
                                    <Plus size={16} /> Создать счёт
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal для просмотра счёта */}
            {viewingInvoice && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        background: 'var(--bg-primary)', borderRadius: '12px',
                        padding: '24px', width: '600px', maxWidth: '90vw'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>Счёт {viewingInvoice.id}</h2>
                            <button className="btn btn-secondary" onClick={() => setViewingInvoice(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            <p><strong>{t('invoices.data', 'Дата:')}</strong> {viewingInvoice.date}</p>
                            <p><strong>{t('invoices.kontragent', 'Контрагент:')}</strong> {viewingInvoice.customer}</p>
                            <p><strong>{t('invoices.kolichestvo_pozitsiy', 'Количество позиций:')}</strong> {viewingInvoice.items}</p>
                            <p><strong>{t('invoices.summa', 'Сумма:')}</strong> {formatCurrency(viewingInvoice.subtotal)}</p>
                            <p><strong>{t('invoices.nds', 'НДС:')}</strong> {formatCurrency(viewingInvoice.nds)}</p>
                            <p><strong>{t('invoices.itogo', 'Итого:')}</strong> {formatCurrency(viewingInvoice.total)}</p>
                            <p><strong>{t('invoices.status', 'Статус:')}</strong> {getStatusInfo(viewingInvoice.status).label}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button className="btn btn-secondary" onClick={() => handlePrintInvoice(viewingInvoice)}>
                                <Printer size={16} /> Печать
                            </button>
                            <button className="btn btn-primary" onClick={() => handleDownloadInvoice(viewingInvoice)}>
                                <Download size={16} /> Скачать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InvoicesPage;
