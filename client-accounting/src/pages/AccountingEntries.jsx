import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Calendar, DollarSign, ArrowRight, Book, Filter, Download } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function AccountingEntries() {
    const { t } = useI18n();
    const toast = useToast();
    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setEntries(txns.map(t => ({
                id: t.id,
                date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
                doc: t.document_number || t.description || '',
                description: t.description || t.purpose || '',
                debit_account: t.debit_account || t.type === 'income' ? '5010' : '9110',
                debit_name: t.debit_name || (t.type === 'income' ? 'Касса' : 'Себестоимость'),
                credit_account: t.credit_account || t.type === 'income' ? '9010' : '4110',
                credit_name: t.credit_name || (t.type === 'income' ? 'Выручка' : 'Товары'),
                amount: parseFloat(t.amount) || 0,
                user: t.user_name || t.counterparty || ''
            })));
            setStats(apiData.stats || {});
            setEntries(apiData.entries || []);
            setStats(apiData.stats || { total_entries: 156, today_entries: 12, total_debit: 1250000000, total_credit: 1250000000 });
        } catch (err) {
            console.warn('AccountingEntries: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    return (
        <div className="accounting-entries-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('accountingentries.buhgalterskie_provodki', '📒 Бухгалтерские проводки')}</h1>
                    <p className="text-muted">{t('accountingentries.zhurnal_hozyaystvennyh_operatsiy', 'Журнал хозяйственных операций')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => toast.info('План счетов...')}>
                        <Book size={18} /> План счетов
                    </button>
                    <button className="btn btn-primary" onClick={() => toast.success('Создание новой проводки...')}>
                        <Plus size={18} /> Новая проводка
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <FileText size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total_entries}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('accountingentries.vsego_provodok', 'Всего проводок')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Calendar size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.today_entries}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('accountingentries.za_segodnya', 'За сегодня')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(stats.total_debit)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('accountingentries.debet', 'Дебет')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>{formatCurrency(stats.total_credit)}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('accountingentries.kredit', 'Кредит')}</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                        <input type="text" placeholder="Поиск по описанию..." style={{ paddingLeft: '40px', width: '100%' }} />
                    </div>
                    <input type="date" defaultValue="2026-01-01" />
                    <input type="date" defaultValue="2026-01-16" />
                    <select>
                        <option>{t('accountingentries.vse_scheta', 'Все счета')}</option>
                        <option>{t('accountingentries.tovary', '4110 - Товары')}</option>
                        <option>{t('accountingentries.kassa', '5010 - Касса')}</option>
                        <option>{t('accountingentries.raschyotnyy_schyot', '5110 - Расчётный счёт')}</option>
                    </select>
                    <button className="btn btn-secondary" onClick={() => toast.info('Экспорт проводок...')}><Download size={16} /> Экспорт</button>
                </div>
            </div>

            {/* Таблица проводок */}
            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('accountingentries.data', 'Дата')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('accountingentries.dokument', 'Документ')}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('accountingentries.opisanie', 'Описание')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('accountingentries.debet', 'Дебет')}</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}></th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('accountingentries.kredit', 'Кредит')}</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>{t('accountingentries.summa', 'Сумма')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px' }}>{entry.date}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{
                                        background: 'var(--primary-light)',
                                        color: 'var(--primary)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: 500
                                    }}>
                                        {entry.doc}
                                    </span>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <div>{entry.description}</div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>{entry.user}</div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>{entry.debit_account}</div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>{entry.debit_name}</div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <ArrowRight size={16} color="#888" />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#ef4444' }}>{entry.credit_account}</div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>{entry.credit_name}</div>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {formatCurrency(entry.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AccountingEntries;
