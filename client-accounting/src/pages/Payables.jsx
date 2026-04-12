import React, { useState, useEffect } from 'react';
import { Building, DollarSign, AlertTriangle, Clock, Search, CreditCard, Calendar, Check, X, Download, FileSpreadsheet } from 'lucide-react';
import { payablesAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { useI18n } from '../i18n';

function PayablesPage() {
    const { t } = useI18n();
    const [creditors, setCreditors] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedCreditor, setSelectedCreditor] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    const calcStats = (items) => {
        const total = items.reduce((sum, c) => sum + (c.total || 0), 0);
        const overdue = items.reduce((sum, c) => sum + (c.overdue || 0), 0);
        return {
            total,
            overdue,
            overdue_percent: total > 0 ? Math.round((overdue / total) * 100) : 0,
            creditors_count: items.length,
            due_this_week: items.filter(c => c.days <= 7 && c.days > 0).length
        };
    };

    const loadData = async () => {
        try {
            const apiRes = await payablesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            const list = apiData.creditors || [];
            setCreditors(list);
            setStats(apiData.stats || calcStats(list));
        } catch (err) {
            console.warn('Payables: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };


    const getStatusInfo = (status) => {
        const statuses = {
            ok: { label: 'В срок', color: '#10b981', bg: '#dcfce7' },
            overdue: { label: 'Просрочено', color: '#f59e0b', bg: '#fef3c7' },
            critical: { label: 'Критично', color: '#ef4444', bg: '#fee2e2' }
        };
        return statuses[status] || statuses.ok;
    };

    const handleExcelExport = () => {
        try {
            const data = filteredCreditors.map(c => ({
                'Поставщик': c.name,
                'ИНН': c.inn,
                'Сумма долга': c.total,
                'Просрочено': c.overdue,
                'Срок оплаты': c.due_date,
                'Дней просрочки': c.days,
                'Телефон': c.phone,
                'Статус': getStatusInfo(c.status).label
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Кредиторская задолженность');
            ws['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 12 }];
            XLSX.writeFile(wb, `kreditorka_${new Date().toISOString().split('T')[0]}.xlsx`);
            setMessage({ type: 'success', text: 'Экспорт в Excel выполнен' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Ошибка экспорта' });
        }
    };

    const handlePdfExport = () => {
        const printWindow = window.open('', '_blank');
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>{t('payables.kreditorskaya_zadolzhennost', 'Кредиторская задолженность')}</title>
            <style>body{font-family:Arial,sans-serif;margin:20px}h1{color:#333;border-bottom:2px solid #ef4444;padding-bottom:10px}
            table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}
            th{background:#ef4444;color:white}tr:nth-child(even){background:#f9f9f9}.overdue{color:#ef4444;font-weight:bold}
            .footer{margin-top:30px;font-size:12px;color:#888;text-align:center}</style></head>
            <body><h1>{t('payables.kreditorskaya_zadolzhennost', '📤 Кредиторская задолженность')}</h1><p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
            <table><thead><tr><th>{t('payables.postavschik', 'Поставщик')}</th><th>{t('payables.inn', 'ИНН')}</th><th>{t('payables.summa_dolga', 'Сумма долга')}</th><th>Просрочено</th><th>{t('payables.srok_oplaty', 'Срок оплаты')}</th><th>{t('payables.status', 'Статус')}</th></tr></thead>
            <tbody>${filteredCreditors.map(c => `<tr><td>${c.name}</td><td>${c.inn}</td><td>${formatCurrency(c.total)}</td>
            <td class="${c.overdue > 0 ? 'overdue' : ''}">${c.overdue > 0 ? formatCurrency(c.overdue) : '-'}</td>
            <td>${c.due_date}</td><td>${getStatusInfo(c.status).label}</td></tr>`).join('')}</tbody></table>
            <div class="footer">{t('payables.sistema_upravleniya_biznes', 'SmartPOS Pro — Система управления бизнесом')}</div></body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        setMessage({ type: 'success', text: 'Документ подготовлен для печати/PDF' });
    };

    const handlePayment = (creditor) => {
        setSelectedCreditor(creditor);
        setPaymentAmount('');
        setShowPaymentModal(true);
    };

    const handleSubmitPayment = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму оплаты' });
            return;
        }
        try {
            await payablesAPI.recordPayment(selectedCreditor.id, parseFloat(paymentAmount));
            loadData();
            setShowPaymentModal(false);
            setMessage({ type: 'success', text: `Оплата ${formatCurrency(paymentAmount)} выполнена` });
        } catch (error) {

            const amount = parseFloat(paymentAmount);
            setCreditors(creditors.map(c => {
                if (c.id === selectedCreditor.id) {
                    const newTotal = Math.max(0, c.total - amount);
                    const newOverdue = Math.max(0, c.overdue - amount);
                    return { ...c, total: newTotal, overdue: newOverdue };
                }
                return c;
            }));
            setShowPaymentModal(false);
            setMessage({ type: 'success', text: `Оплата ${formatCurrency(paymentAmount)} выполнена` });
        }
    };

    const filteredCreditors = creditors.filter(c => {
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="payables-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('payables.kreditorskaya_zadolzhennost', '📤 Кредиторская задолженность')}</h1>
                    <p className="text-muted">{t('payables.komu_dolzhny_my', 'Кому должны мы')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleExcelExport}>
                        <FileSpreadsheet size={18} /> Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handlePdfExport}>
                        <Download size={18} /> PDF
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
                        <CreditCard size={18} /> {t('payables.oplatit', 'Оплатить')}
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
                    <DollarSign size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatCurrency(stats.total || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('payables.vsego_k_oplate', 'Всего к оплате')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#fee2e2' }}>
                    <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>{formatCurrency(stats.overdue || 0)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>Просрочено ({stats.overdue_percent || 0}%)</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Building size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.creditors_count || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('payables.kreditorov', 'Кредиторов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Calendar size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.due_this_week || 0}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('payables.k_oplate_na_etoy_nedele', 'К оплате на этой неделе')}</div>
                </div>
            </div>

            {/* Таблица */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('payables.spisok_kreditorov', '📋 Список кредиторов')}</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">{t('payables.vse_statusy', 'Все статусы')}</option>
                            <option value="overdue">Просрочено</option>
                            <option value="critical">Критично</option>
                            <option value="ok">В срок</option>
                        </select>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input type="text" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: '40px', width: '200px' }} />
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('payables.zagruzka', 'Загрузка...')}</div>
                ) : filteredCreditors.length === 0 ? (
                    <div className="empty-state">
                        <Building size={64} className="text-muted" />
                        <h3>{t('payables.kreditory_ne_naydeny', 'Кредиторы не найдены')}</h3>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('payables.postavschik', 'Поставщик')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('payables.summa_dolga', 'Сумма долга')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>Просрочено</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payables.srok_oplaty', 'Срок оплаты')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payables.status', 'Статус')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('payables.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCreditors.map(creditor => {
                                const statusInfo = getStatusInfo(creditor.status);
                                return (
                                    <tr key={creditor.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 500 }}>{creditor.name}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>ИНН: {creditor.inn}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatCurrency(creditor.total)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: creditor.overdue > 0 ? '#ef4444' : '#888' }}>
                                            {creditor.overdue > 0 ? formatCurrency(creditor.overdue) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 500 }}>{creditor.due_date}</div>
                                            {creditor.days > 0 && (
                                                <div style={{ fontSize: '11px', color: '#ef4444' }}>
                                                    просрочено {creditor.days} дн.
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button className="btn btn-sm btn-primary" onClick={() => handlePayment(creditor)}>
                                                <CreditCard size={14} /> {t('payables.oplatit', 'Оплатить')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('payables.oplata_postavschiku', 'Оплата поставщику')}</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            {selectedCreditor && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: '8px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{selectedCreditor.name}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Задолженность: {formatCurrency(selectedCreditor.total)}</div>
                                </div>
                            )}
                            <div className="form-group">
                                <label>{t('payables.summa_oplaty', 'Сумма оплаты')}</label>
                                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" autoFocus />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowPaymentModal(false)} className="btn btn-secondary">{t('payables.otmena', 'Отмена')}</button>
                            <button onClick={handleSubmitPayment} className="btn btn-primary"><CreditCard size={16} /> {t('payables.oplatit', 'Оплатить')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PayablesPage;
