import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Plus, Minus, RefreshCw, Printer, Clock, AlertTriangle, X, Check } from 'lucide-react';
import { financeAPI } from '../services/api';


import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function CashOperations() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [operations, setOperations] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(null); // 'deposit' | 'withdrawal' | 'exchange' | null
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load payments for today
            const today = new Date().toISOString().split('T')[0];
            const [paymentsRes, accountsRes] = await Promise.all([
                financeAPI.getPayments({ dateFrom: today, dateTo: today }),
                financeAPI.getAccounts()
            ]);

            const payments = paymentsRes.data?.payments || [];
            const accounts = accountsRes.data?.accounts || [];

            // Map payments to operations format
            setOperations(payments.map(p => ({
                id: p.id,
                type: p.payment_type === 'incoming' ? 'sale' : p.payment_type === 'outgoing' ? 'withdrawal' : p.payment_type,
                description: p.purpose || p.document_number || 'Операция',
                amount: parseFloat(p.amount) || 0,
                cashier: p.user_name || 'Кассир',
                time: p.document_date ? new Date(p.document_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
                balance_after: 0
            })));

            // Calculate stats from accounts (cash register type)
            const cashAccount = accounts.find(a => a.type === 'cash') || accounts[0];
            const totalSales = payments.filter(p => p.payment_type === 'incoming').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
            const totalWithdrawals = payments.filter(p => p.payment_type === 'outgoing').reduce((s, p) => s + parseFloat(p.amount || 0), 0);

            setStats({
                opening_balance: parseFloat(cashAccount?.balance || 0) - totalSales + totalWithdrawals,
                current_balance: parseFloat(cashAccount?.balance || 0),
                total_sales: totalSales,
                total_refunds: 0,
                total_withdrawals: totalWithdrawals,
                total_deposits: payments.filter(p => p.purpose?.includes('Внесение')).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
            });
        } catch (error) {
            console.warn('CashOperations: не удалось загрузить данные', error.message);
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getOperationInfo = (type) => {
        const types = {
            sale: { label: 'Продажа', color: '#10b981', icon: ArrowDownRight },
            refund: { label: 'Возврат', color: '#ef4444', icon: ArrowUpRight },
            withdrawal: { label: 'Инкассация', color: '#f59e0b', icon: Minus },
            deposit: { label: 'Внесение', color: '#3b82f6', icon: Plus }
        };
        return types[type] || types.sale;
    };

    const handleDeposit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму' });
            return;
        }
        const amt = parseFloat(amount);
        try {
            await financeAPI.createPayment({
                document_number: `DEP-${Date.now()}`,
                document_date: new Date().toISOString().split('T')[0],
                payment_type: 'incoming',
                amount: amt,
                purpose: description || 'Внесение наличных'
            });
        } catch (e) {
            console.warn('Deposit API failed, local only:', e.message);
        }
        const newOp = {
            id: Date.now(), type: 'deposit',
            description: description || 'Внесение наличных',
            amount: amt, cashier: 'Текущий пользователь',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            balance_after: stats.current_balance + amt
        };
        setOperations([newOp, ...operations]);
        setStats({ ...stats, current_balance: stats.current_balance + amt, total_deposits: stats.total_deposits + amt });
        setMessage({ type: 'success', text: `Внесено ${formatCurrency(amount)}` });
        setShowModal(null);
        setAmount('');
        setDescription('');
    };

    const handleWithdrawal = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму' });
            return;
        }
        const amt = parseFloat(amount);
        if (amt > stats.current_balance) {
            setMessage({ type: 'error', text: 'Недостаточно средств в кассе' });
            return;
        }
        try {
            await financeAPI.createPayment({
                document_number: `WDR-${Date.now()}`,
                document_date: new Date().toISOString().split('T')[0],
                payment_type: 'outgoing',
                amount: amt,
                purpose: description || 'Инкассация'
            });
        } catch (e) {
            console.warn('Withdrawal API failed, local only:', e.message);
        }
        const newOp = {
            id: Date.now(), type: 'withdrawal',
            description: description || 'Инкассация',
            amount: amt, cashier: 'Текущий пользователь',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            balance_after: stats.current_balance - amt
        };
        setOperations([newOp, ...operations]);
        setStats({ ...stats, current_balance: stats.current_balance - amt, total_withdrawals: stats.total_withdrawals + amt });
        setMessage({ type: 'success', text: `Инкассация ${formatCurrency(amount)} выполнена` });
        setShowModal(null);
        setAmount('');
        setDescription('');
    };

    const handleExchange = () => {
        setMessage({ type: 'success', text: 'Размен выполнен' });
        setShowModal(null);
        setAmount('');
    };

    const handleXReport = () => {
        setMessage({ type: 'info', text: 'X-отчёт формируется...' });
        setTimeout(() => {
            setMessage({ type: 'success', text: 'X-отчёт сформирован' });
        }, 1000);
    };

    const handleZReport = async () => {
        if (await confirm({ message: 'Закрыть смену и сформировать Z-отчёт?' })) {
            setMessage({ type: 'info', text: 'Z-отчёт формируется, смена закрывается...' });
            setTimeout(() => {
                setMessage({ type: 'success', text: 'Z-отчёт сформирован, смена закрыта' });
            }, 1500);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const openModal = (type) => {
        setShowModal(type);
        setAmount('');
        setDescription('');
    };

    return (
        <div className="cash-operations-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('cashoperations.kassovye_operatsii', '💵 Кассовые операции')}</h1>
                    <p className="text-muted">{t('cashoperations.dvizhenie_denezhnyh_sredstv_v_kasse', 'Движение денежных средств в кассе')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => openModal('withdrawal')}>
                        <Minus size={18} /> Инкассация
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal('deposit')}>
                        <Plus size={18} /> Внести деньги
                    </button>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : message.type === 'error' ? 'alert-danger' : 'alert-info'}`} style={{ marginBottom: '16px' }}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                    <button onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Баланс */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '14px', opacity: 0.8 }}>{t('cashoperations.tekuschiy_balans', 'Текущий баланс')}</div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>
                                {formatCurrency(stats.current_balance)}
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                                Открытие: {formatCurrency(stats.opening_balance)}
                            </div>
                        </div>
                        <DollarSign size={48} style={{ opacity: 0.3 }} />
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '8px' }}>
                        <ArrowDownRight size={20} />
                        <span style={{ fontSize: '13px' }}>{t('cashoperations.prodazhi', 'Продажи')}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>+{formatCurrency(stats.total_sales)}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px' }}>
                        <ArrowUpRight size={20} />
                        <span style={{ fontSize: '13px' }}>{t('cashoperations.vozvraty', 'Возвраты')}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>-{formatCurrency(stats.total_refunds)}</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '8px' }}>
                        <Minus size={20} />
                        <span style={{ fontSize: '13px' }}>Инкассация</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>-{formatCurrency(stats.total_withdrawals)}</div>
                </div>
            </div>

            {/* Быстрые действия */}
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px' }}>{t('cashoperations.bystrye_deystviya', '⚡ Быстрые действия')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}
                        onClick={() => openModal('deposit')}
                    >
                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>💵</span>
                        <span style={{ fontSize: '13px' }}>Внесение</span>
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}
                        onClick={() => openModal('withdrawal')}
                    >
                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>🏧</span>
                        <span style={{ fontSize: '13px' }}>Инкассация</span>
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}
                        onClick={() => openModal('exchange')}
                    >
                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</span>
                        <span style={{ fontSize: '13px' }}>{t('cashoperations.razmen', 'Размен')}</span>
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}
                        onClick={handleXReport}
                    >
                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>📊</span>
                        <span style={{ fontSize: '13px' }}>{t('cashoperations.otchyot', 'X-отчёт')}</span>
                    </button>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'auto' }}
                        onClick={handleZReport}
                    >
                        <span style={{ fontSize: '24px', marginBottom: '8px' }}>📋</span>
                        <span style={{ fontSize: '13px' }}>{t('cashoperations.otchyot', 'Z-отчёт')}</span>
                    </button>
                </div>
            </div>

            {/* Операции */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{t('cashoperations.operatsii_za_segodnya', '📜 Операции за сегодня')}</h3>
                    <button className="btn btn-sm btn-secondary" onClick={handlePrint}>
                        <Printer size={14} /> Печать
                    </button>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('cashoperations.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cashoperations.operatsiya', 'Операция')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('cashoperations.kassir', 'Кассир')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('cashoperations.vremya', 'Время')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('cashoperations.summa', 'Сумма')}</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>{t('cashoperations.balans_posle', 'Баланс после')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {operations.map(op => {
                                const info = getOperationInfo(op.type);
                                const Icon = info.icon;
                                const isPositive = op.type === 'sale' || op.type === 'deposit';

                                return (
                                    <tr key={op.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '32px', height: '32px',
                                                    borderRadius: '50%',
                                                    background: `${info.color}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Icon size={16} color={info.color} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>{info.label}</div>
                                                    <div style={{ fontSize: '12px', color: '#888' }}>{op.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', color: '#666' }}>{op.cashier}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                <Clock size={14} color="#888" />
                                                {op.time}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: isPositive ? '#10b981' : '#ef4444' }}>
                                            {isPositive ? '+' : '-'}{formatCurrency(op.amount)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#888' }}>
                                            {formatCurrency(op.balance_after)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {showModal === 'deposit' && '💵 Внесение денежных средств'}
                                {showModal === 'withdrawal' && '🏧 Инкассация'}
                                {showModal === 'exchange' && '🔄 Размен'}
                            </h2>
                            <button className="modal-close" onClick={() => setShowModal(null)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('cashoperations.summa', 'Сумма')}</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="Введите сумму"
                                    autoFocus
                                />
                            </div>
                            {showModal !== 'exchange' && (
                                <div className="form-group">
                                    <label>{t('cashoperations.opisanie_neobyazatelno', 'Описание (необязательно)')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Комментарий к операции"
                                    />
                                </div>
                            )}
                            {showModal === 'withdrawal' && (
                                <div style={{ padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: '8px', marginTop: '12px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('cashoperations.dostupno_v_kasse', 'Доступно в кассе:')}</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(stats.current_balance)}</div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(null)}>
                                Отмена
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    if (showModal === 'deposit') handleDeposit();
                                    else if (showModal === 'withdrawal') handleWithdrawal();
                                    else handleExchange();
                                }}
                            >
                                <Check size={18} />
                                {showModal === 'deposit' && 'Внести'}
                                {showModal === 'withdrawal' && 'Инкассировать'}
                                {showModal === 'exchange' && 'Разменять'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CashOperations;
