import React, { useState, useEffect } from 'react';
import { Building2, CreditCard, ArrowUpRight, ArrowDownRight, RefreshCw, Plus, Check, X, Clock, Link, Settings } from 'lucide-react';
import { financeAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function BankIntegration() {
    const { t } = useI18n();
    const toast = useToast();
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await financeAPI.getAccounts();
            const apiData = apiRes.data || apiRes;
            setAccounts(apiData.accounts || []);
            setTransactions(apiData.transactions || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('BankIntegration: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value, currency = 'UZS') => {
        if (currency === 'USD') {
            return '$' + new Intl.NumberFormat('en-US').format(value);
        }
        return new Intl.NumberFormat('ru-RU').format(value) + " so'm";
    };

    const formatDate = (date) => new Date(date).toLocaleString('ru-RU');

    const syncAccount = (id) => {
        console.log('Syncing account', id);
    };

    return (
        <div className="bank-integration-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('bankintegration.bankovskaya_integratsiya', '🏦 Банковская интеграция')}</h1>
                    <p className="text-muted">{t('bankintegration.sinhronizatsiya_s_bankami_i_sverka_operatsi', 'Синхронизация с банками и сверка операций')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => toast.info('Синхронизация всех счетов...')}>
                        <RefreshCw size={18} /> Синхронизировать всё
                    </button>
                    <button className="btn btn-primary" onClick={() => toast.info('Подключение нового банка...')}>
                        <Plus size={18} /> Подключить банк
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('bankintegration.obschiy_balans', 'Общий баланс')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(stats.total_balance)}</div>
                        </div>
                        <Building2 size={28} color="#3b82f6" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('bankintegration.postupleniya_segodnya', 'Поступления сегодня')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981' }}>+{formatCurrency(stats.income_today)}</div>
                        </div>
                        <ArrowDownRight size={28} color="#10b981" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('bankintegration.rashody_segodnya', 'Расходы сегодня')}</div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ef4444' }}>-{formatCurrency(stats.expense_today)}</div>
                        </div>
                        <ArrowUpRight size={28} color="#ef4444" />
                    </div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('bankintegration.nesopostavleno', 'Несопоставлено')}</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: stats.unmatched > 0 ? '#f59e0b' : '#10b981' }}>{stats.unmatched}</div>
                        </div>
                        <Clock size={28} color="#f59e0b" />
                    </div>
                </div>
            </div>

            {/* Счета */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('bankintegration.podklyuchyonnye_scheta', '💳 Подключённые счета')}</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '16px' }}>
                    {accounts.map(account => (
                        <div key={account.id} style={{
                            padding: '20px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            background: account.status === 'connected' ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' : 'var(--bg-secondary)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Building2 size={24} color={account.status === 'connected' ? '#10b981' : '#888'} />
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{account.bank}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{account.name}</div>
                                    </div>
                                </div>
                                {account.status === 'connected' ? (
                                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Check size={10} /> Подключён
                                    </span>
                                ) : (
                                    <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={10} /> Ожидание
                                    </span>
                                )}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                                {account.account}
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
                                {formatCurrency(account.balance, account.currency)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#888' }}>
                                    {account.last_sync ? `Обновлено: ${formatDate(account.last_sync)}` : 'Не синхронизирован'}
                                </span>
                                <button onClick={() => syncAccount(account.id)} className="btn btn-sm btn-secondary">
                                    <RefreshCw size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Транзакции */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('bankintegration.poslednie_operatsii', '📜 Последние операции')}</h3>
                    <button className="btn btn-sm btn-secondary" onClick={() => toast.info('Переход ко всем операциям...')}>
                        Все операции
                    </button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('bankintegration.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('bankintegration.operatsiya', 'Операция')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('bankintegration.schyot', 'Счёт')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('bankintegration.data', 'Дата')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('bankintegration.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('bankintegration.sverka', 'Сверка')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '32px', height: '32px',
                                                borderRadius: '50%',
                                                background: tx.type === 'income' ? '#dcfce7' : '#fee2e2',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {tx.type === 'income' ?
                                                    <ArrowDownRight size={16} color="#10b981" /> :
                                                    <ArrowUpRight size={16} color="#ef4444" />
                                                }
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{tx.description}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', color: '#888' }}>{tx.account}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px' }}>{formatDate(tx.date)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: tx.type === 'income' ? '#10b981' : '#ef4444' }}>
                                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {tx.matched ? (
                                            <span style={{ color: '#10b981' }}><Check size={18} /></span>
                                        ) : (
                                            <button className="btn btn-sm btn-primary" onClick={() => toast.info(`Сопоставление операции: ${tx.description}`)}>
                                                <Link size={12} /> Сопоставить
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default BankIntegration;
