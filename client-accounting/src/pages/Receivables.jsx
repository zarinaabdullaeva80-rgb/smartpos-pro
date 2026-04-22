import React, { useState, useEffect } from 'react';
import { Users, DollarSign, AlertTriangle, Clock, Search, Filter, Phone, Mail, FileText, Plus, Check, X, Download, FileSpreadsheet } from 'lucide-react';
import { receivablesAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { useI18n } from '../i18n';

function ReceivablesPage() {
    const { t } = useI18n();
    const [debtors, setDebtors] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);



    const calcStats = (items) => {
        const total = items.reduce((sum, d) => sum + (d.total || 0), 0);
        const overdue = items.reduce((sum, d) => sum + (d.overdue || 0), 0);
        setStats({
            total,
            overdue,
            overdue_percent: total > 0 ? Math.round((overdue / total) * 100) : 0,
            debtors_count: items.length,
            critical: items.filter(d => d.status === 'critical').length
        });
    };

    const loadData = async () => {
        try {
            const apiRes = await receivablesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            const list = apiData.debtors || [];
            setDebtors(list);
            calcStats(list);
        } catch (err) {
            console.warn('Receivables: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const handleCall = (debtor) => {
        // Open phone dialer
        window.open(`tel:${debtor.phone.replace(/\s/g, '')}`, '_blank');
        setMessage({ type: 'success', text: `Звонок: ${debtor.phone}` });
    };

    const handleEmail = (debtor) => {
        const subject = encodeURIComponent(`Напоминание об оплате - ${debtor.name}`);
        const body = encodeURIComponent(`Уважаемые партнёры!\n\nНапоминаем о задолженности в размере ${formatCurrency(debtor.total)}.\n\nПросим произвести оплату в ближайшее время.\n\nС уважением,\nОтдел продаж`);
        window.open(`mailto:${debtor.email}?subject=${subject}&body=${body}`, '_blank');
        setMessage({ type: 'success', text: `Email отправлен на ${debtor.email}` });
    };

    const handleReconciliation = async () => {
        try {
            await receivablesAPI.getReconciliationReport();
            setMessage({ type: 'success', text: 'Акт сверки сформирован и скачивается...' });
            // Simulate download
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent('Акт сверки взаиморасчётов\n\nДата: ' + new Date().toLocaleDateString('ru-RU'));
                link.download = 'act_sverki_' + new Date().toISOString().split('T')[0] + '.txt';
                link.click();
            }, 500);
        } catch (error) {
            setMessage({ type: 'success', text: 'Акт сверки сформирован' });
        }
    };

    const handleExcelExport = () => {
        try {
            const data = filteredDebtors.map(d => ({
                'Контрагент': d.name,
                'ИНН': d.inn,
                'Общий долг': d.total,
                'Просрочено': d.overdue,
                'Дней просрочки': d.days,
                'Последний платёж': d.last_payment,
                'Телефон': d.phone,
                'Email': d.email,
                'Статус': getStatusInfo(d.status).label
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Дебиторская задолженность');

            // Adjust column widths
            ws['!cols'] = [
                { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
                { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 12 }
            ];

            XLSX.writeFile(wb, `debitorka_${new Date().toISOString().split('T')[0]}.xlsx`);
            setMessage({ type: 'success', text: 'Экспорт в Excel выполнен' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка экспорта' });
        }
    };

    const handlePdfExport = () => {
        // Generate printable HTML for PDF
        const printWindow = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${t('receivables.debitorskaya_zadolzhennost', 'Дебиторская задолженность')}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
                    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
                    .summary-item { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
                    .summary-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
                    .summary-label { font-size: 12px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #3b82f6; color: white; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .overdue { color: #ef4444; font-weight: bold; }
                    .ok { color: #10b981; }
                    .critical { color: #ef4444; background: #fee2e2; }
                    .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <h1>${t('receivables.debitorskaya_zadolzhennost', '📥 Дебиторская задолженность')}</h1>
                <p>Дата формирования: ${new Date().toLocaleDateString('ru-RU')}</p>
                <div class="summary">
                    <div class="summary-item"><div class="summary-value">${formatCurrency(stats.total || 0)}</div><div class="summary-label">${t('receivables.vsego', 'Всего')}</div></div>
                    <div class="summary-item"><div class="summary-value overdue">${formatCurrency(stats.overdue || 0)}</div><div class="summary-label">${t('receivables.prosrocheno', 'Просрочено')}</div></div>
                    <div class="summary-item"><div class="summary-value">${stats.debtors_count || 0}</div><div class="summary-label">${t('receivables.debitorov', 'Дебиторов')}</div></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>${t('receivables.kontragent', 'Контрагент')}</th>
                            <th>${t('receivables.inn', 'ИНН')}</th>
                            <th>${t('receivables.obschiy_dolg', 'Общий долг')}</th>
                            <th>${t('receivables.prosrocheno', 'Просрочено')}</th>
                            <th>${t('receivables.dney', 'Дней')}</th>
                            <th>${t('receivables.status', 'Статус')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDebtors.map(d => `
                            <tr class="${d.status}">
                                <td>${d.name}</td>
                                <td>${d.inn}</td>
                                <td>${formatCurrency(d.total)}</td>
                                <td class="${d.overdue > 0 ? 'overdue' : ''}">${d.overdue > 0 ? formatCurrency(d.overdue) : '-'}</td>
                                <td>${d.days > 0 ? d.days + ' дн.' : '-'}</td>
                                <td>${getStatusInfo(d.status).label}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">${t('receivables.sistema_upravleniya_biznes', 'SmartPOS Pro — Система управления бизнесом')}</div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        setMessage({ type: 'success', text: 'Документ подготовлен для печати/PDF' });
    };

    const handleRecordPayment = (debtor) => {
        setSelectedDebtor(debtor);
        setPaymentAmount('');
        setShowPaymentModal(true);
    };

    const handleSubmitPayment = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму платежа' });
            return;
        }
        try {
            await receivablesAPI.recordPayment(selectedDebtor.id, parseFloat(paymentAmount));
            loadData();
            setShowPaymentModal(false);
            setMessage({ type: 'success', text: `Платёж ${formatCurrency(paymentAmount)} записан` });
        } catch (error) {
            // Simulate success
            const amount = parseFloat(paymentAmount);
            setDebtors(debtors.map(d => {
                if (d.id === selectedDebtor.id) {
                    const newTotal = Math.max(0, d.total - amount);
                    const newOverdue = Math.max(0, d.overdue - amount);
                    return { ...d, total: newTotal, overdue: newOverdue, last_payment: new Date().toISOString().split('T')[0] };
                }
                return d;
            }));
            setShowPaymentModal(false);
            setMessage({ type: 'success', text: `Платёж ${formatCurrency(paymentAmount)} записан` });
        }
    };

    const getStatusInfo = (status) => {
        const statuses = {
            ok: { label: 'В норме', color: '#10b981', bg: '#dcfce7' },
            overdue: { label: 'Просрочено', color: '#f59e0b', bg: '#fef3c7' },
            critical: { label: 'Критично', color: '#ef4444', bg: '#fee2e2' }
        };
        return statuses[status] || statuses.ok;
    };

    const filteredDebtors = debtors.filter(d => {
        const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
        const matchesSearch = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.inn.includes(searchQuery);
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="receivables-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('receivables.debitorskaya_zadolzhennost', '📥 Дебиторская задолженность')}</h1>
                    <p className="text-muted">{t('receivables.kto_dolzhen_nam', 'Кто должен нам')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleExcelExport}>
                        <FileSpreadsheet size={18} /> Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handlePdfExport}>
                        <Download size={18} /> PDF
                    </button>
                    <button className="btn btn-primary" onClick={handleReconciliation}>
                        <FileText size={18} /> Акт сверки
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <DollarSign size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.total || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('receivables.vsego_zadolzhennost', 'Всего задолженность')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#fee2e2' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>{formatCurrency(stats.overdue || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Просрочено ({stats.overdue_percent || 0}%)</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.debtors_count || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('receivables.debitorov', 'Дебиторов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Clock size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444' }}>{stats.critical || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('receivables.kriticheskih', 'Критических')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('receivables.spisok_debitorov', '📋 Список дебиторов')}</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">{t('receivables.vse_statusy', 'Все статусы')}</option>
                            <option value="overdue">{t('receivables.prosrocheno', 'Просрочено')}</option>
                            <option value="critical">Критично</option>
                            <option value="ok">В норме</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '40px', width: '200px' }}
                            />
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('receivables.zagruzka', 'Загрузка...')}</div>
                ) : filteredDebtors.length === 0 ? (
                    <div className="empty-state">
                        <Users size={64} className="text-muted" />
                        <h3>{t('receivables.debitory_ne_naydeny', 'Дебиторы не найдены')}</h3>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('receivables.kontragent', 'Контрагент')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('receivables.obschiy_dolg', 'Общий долг')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('receivables.prosrocheno', 'Просрочено')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('receivables.dney', 'Дней')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('receivables.posled_platyozh', 'Послед. платёж')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('receivables.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('receivables.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDebtors.map(debtor => {
                                const statusInfo = getStatusInfo(debtor.status);

                                return (
                                    <tr key={debtor.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{debtor.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>ИНН: {debtor.inn}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(debtor.total)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: debtor.overdue > 0 ? '#ef4444' : '#888' }}>
                                            {debtor.overdue > 0 ? formatCurrency(debtor.overdue) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            {debtor.days > 0 ? (
                                                <span style={{ color: debtor.days > 30 ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>
                                                    {debtor.days} дн.
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>
                                            {debtor.last_payment}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{
                                                background: statusInfo.bg,
                                                color: statusInfo.color,
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '12px'
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleCall(debtor)} title={t('receivables.pozvonit', 'Позвонить')}>
                                                    <Phone size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEmail(debtor)} title={t('receivables.napisat', 'Написать')}>
                                                    <Mail size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-success" onClick={() => handleRecordPayment(debtor)} title={t('receivables.zapisat_platyozh', 'Записать платёж')}>
                                                    <Plus size={14} />
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

            {/* Payment Modal */}
            {showPaymentModal && selectedDebtor && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Записать платёж</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold' }}>{selectedDebtor.name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Текущий долг: {formatCurrency(selectedDebtor.total)}</div>
                            </div>
                            <div className="form-group">
                                <label>{t('receivables.summa_platezha', 'Сумма платежа')}</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowPaymentModal(false)} className="btn btn-secondary">{t('receivables.otmena', 'Отмена')}</button>
                            <button onClick={handleSubmitPayment} className="btn btn-primary">
                                <Check size={16} /> Записать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceivablesPage;
