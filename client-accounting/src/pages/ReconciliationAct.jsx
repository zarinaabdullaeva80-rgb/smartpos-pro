import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, Check, X, Calendar, Building, DollarSign, ArrowUpDown } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function ReconciliationAct() {
    const { t } = useI18n();
    const toast = useToast();
    const [acts, setActs] = useState([]);
    const [selectedAct, setSelectedAct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAccounts();
            const apiData = apiRes.data || apiRes;
            setActs(apiData.acts || []);
            setSelectedAct(apiData.selectedAct || {});
        } catch (err) {
            console.warn('ReconciliationAct: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getStatusInfo = (status) => {
        const statuses = {
            confirmed: { label: 'Подтверждён', color: '#10b981', bg: '#dcfce7', icon: Check },
            pending: { label: 'Ожидает', color: '#f59e0b', bg: '#fef3c7', icon: Calendar },
            disputed: { label: 'Расхождение', color: '#ef4444', bg: '#fee2e2', icon: X }
        };
        return statuses[status] || statuses.pending;
    };

    return (
        <div className="reconciliation-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('reconciliationact.akt_sverki', '📋 Акт сверки')}</h1>
                    <p className="text-muted">{t('reconciliationact.sverka_vzaimoraschyotov_s_kontragentami', 'Сверка взаиморасчётов с контрагентами')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => toast.success('Создание нового акта...')}>
                        <Plus size={18} /> Создать акт
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список актов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('reconciliationact.akty_sverki', '📄 Акты сверки')}</h3>
                    </div>
                    <div>
                        {acts.map(act => {
                            const statusInfo = getStatusInfo(act.status);
                            const StatusIcon = statusInfo.icon;

                            return (
                                <div
                                    key={act.id}
                                    onClick={() => setSelectedAct(act)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedAct?.id === act.id ? 'var(--primary-light)' : 'transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{act.counterparty}</div>
                                            <div style={{ fontSize: '12px', color: '#888' }}>{act.period}</div>
                                        </div>
                                        <span style={{
                                            background: statusInfo.bg,
                                            color: statusInfo.color,
                                            padding: '2px 8px',
                                            borderRadius: '8px',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <StatusIcon size={12} /> {statusInfo.label}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                                        Сальдо: <strong>{formatCurrency(Math.abs(act.our_balance))}</strong>
                                        {act.difference !== 0 && (
                                            <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                                                (разница: {formatCurrency(act.difference)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Детали акта */}
                {selectedAct && (
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ margin: '0 0 8px' }}>{t('reconciliationact.akt_sverki_vzaimoraschyotov', 'Акт сверки взаиморасчётов')}</h2>
                                <div style={{ color: '#888' }}>
                                    с {selectedAct.counterparty} за {selectedAct.period}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => toast.info('Печать акта...')}>
                                    <Printer size={16} /> Печать
                                </button>
                                <button className="btn btn-secondary" onClick={() => toast.info('Скачивание PDF...')}>
                                    <Download size={16} /> PDF
                                </button>
                            </div>
                        </div>

                        {/* Сводка */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ padding: '20px', background: '#dcfce7', borderRadius: '12px' }}>
                                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{t('reconciliationact.po_nashim_dannym', 'По нашим данным')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                    {formatCurrency(selectedAct.our_data?.closing)}
                                </div>
                            </div>
                            <div style={{ padding: '20px', background: '#dbeafe', borderRadius: '12px' }}>
                                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{t('reconciliationact.po_dannym_kontragenta', 'По данным контрагента')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                                    {formatCurrency(selectedAct.their_data?.closing)}
                                </div>
                            </div>
                        </div>

                        {/* Операции */}
                        <h4 style={{ margin: '0 0 12px' }}>{t('reconciliationact.operatsii_za_period', '📝 Операции за период')}</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>{t('reconciliationact.data', 'Дата')}</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>{t('reconciliationact.dokument', 'Документ')}</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>{t('reconciliationact.opisanie', 'Описание')}</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>{t('reconciliationact.debet', 'Дебет')}</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>{t('reconciliationact.kredit', 'Кредит')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedAct.operations?.map((op, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px' }}>{op.date}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                background: 'var(--primary-light)',
                                                color: 'var(--primary)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                {op.doc}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>{op.description}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: op.debit > 0 ? '#10b981' : '#888' }}>
                                            {op.debit > 0 ? formatCurrency(op.debit) : '-'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: op.credit > 0 ? '#ef4444' : '#888' }}>
                                            {op.credit > 0 ? formatCurrency(op.credit) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                                    <td colSpan="3" style={{ padding: '10px' }}>{t('reconciliationact.itogo', 'Итого:')}</td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: '#10b981' }}>
                                        {formatCurrency(selectedAct.our_data?.debit)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444' }}>
                                        {formatCurrency(selectedAct.our_data?.credit)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Plus({ size }) {
    return <span style={{ fontSize: size }}>+</span>;
}

export default ReconciliationAct;
