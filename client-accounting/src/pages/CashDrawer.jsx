import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Minus, Clock, User, FileText, RefreshCw, Lock, Unlock, Check, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { useI18n } from '../i18n';

function CashDrawer() {
    const { t } = useI18n();
    const [drawer, setDrawer] = useState({});
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentShift, setCurrentShift] = useState(null);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load current shift
            const shiftRes = await api.get('/shifts/current');
            if (shiftRes.data.shift) {
                setCurrentShift(shiftRes.data.shift);

                // Load shift stats
                const statsRes = await api.get(`/shifts/${shiftRes.data.shift.id}/stats`);
                setDrawer({
                    status: 'open',
                    opened_at: shiftRes.data.shift.opened_at || shiftRes.data.shift.started_at,
                    opened_by: shiftRes.data.shift.username || 'Текущий пользователь',
                    starting_cash: shiftRes.data.shift.initial_cash || shiftRes.data.shift.opening_cash || 0,
                    current_cash: (shiftRes.data.shift.initial_cash || 0) + (statsRes.data.stats.totalSales || 0),
                    expected_cash: (shiftRes.data.shift.initial_cash || 0) + (statsRes.data.stats.totalSales || 0),
                    difference: 0,
                    sales_count: statsRes.data.stats.salesCount || 0,
                    cash_sales: statsRes.data.stats.totalSales || 0,
                    card_sales: 0,
                    total_sales: statsRes.data.stats.totalSales || 0
                });
            } else {
                setDrawer({ status: 'closed' });
            }
        } catch (error) {
            console.error('Error loading shift data:', error);
            // Пустое состояние при ошибке сервера
            setDrawer({ status: 'error' });
            setMessage({ type: 'warning', text: 'Не удалось загрузить данные. Проверьте подключение.' });
        }

        // Load recent operations
        try {
            const opsRes = await api.get('/cash-operations/recent');
            setOperations(opsRes.data.operations || []);
        } catch (error) {
            console.warn('CashDrawer: не удалось загрузить данные', error.message);
        }

        setLoading(false);
    };

    const handleDeposit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму' });
            return;
        }
        try {
            await api.post('/cash-operations/deposit', {
                amount: parseFloat(amount),
                description: description || 'Внесение наличных'
            });
            setMessage({ type: 'success', text: `Внесено ${formatCurrency(amount)}` });
            setShowDepositModal(false);
            setAmount('');
            setDescription('');
            loadData();
        } catch (error) {
            console.warn('CashDrawer: не удалось загрузить данные', error.message);
        }
    };

    const handleWithdraw = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setMessage({ type: 'error', text: 'Введите сумму' });
            return;
        }
        if (parseFloat(amount) > drawer.current_cash) {
            setMessage({ type: 'error', text: 'Недостаточно средств в кассе' });
            return;
        }
        try {
            await api.post('/cash-operations/withdraw', {
                amount: parseFloat(amount),
                description: description || 'Выемка'
            });
            setMessage({ type: 'success', text: `Выемка ${formatCurrency(amount)} выполнена` });
            setShowWithdrawModal(false);
            setAmount('');
            setDescription('');
            loadData();
        } catch (error) {
            console.warn('CashDrawer: не удалось загрузить данные', error.message);
        }
    };

    const handleCloseShift = async () => {
        if (!currentShift || !currentShift.id) {
            setMessage({ type: 'error', text: 'Нет открытой смены' });
            return;
        }
        if (!amount || parseFloat(amount) < 0) {
            setMessage({ type: 'error', text: 'Введите фактическую сумму в кассе' });
            return;
        }
        try {
            await api.post(`/shifts/${currentShift.id}/close`, {
                closing_cash: parseFloat(amount)
            });
            setMessage({ type: 'success', text: 'Смена закрыта. Z-отчёт сформирован.' });
            setShowCloseModal(false);
            setAmount('');
            setCurrentShift(null);
            setDrawer({ status: 'closed' });
        } catch (error) {
            console.error('Error closing shift:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Ошибка закрытия смены' });
        }
    };

    const openModal = (type) => {
        setAmount('');
        setDescription('');
        if (type === 'deposit') setShowDepositModal(true);
        else if (type === 'withdraw') setShowWithdrawModal(true);
        else if (type === 'close') setShowCloseModal(true);
    };

    const getOperationStyle = (type) => {
        const styles = {
            sale: { color: '#10b981', icon: Plus, bg: '#dcfce7' },
            in: { color: '#3b82f6', icon: Plus, bg: '#dbeafe' },
            out: { color: '#ef4444', icon: Minus, bg: '#fee2e2' }
        };
        return styles[type] || styles.sale;
    };

    return (
        <div className="cash-drawer-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('cashdrawer.denezhnyy_yaschik', '💵 Денежный ящик')}</h1>
                    <p className="text-muted">{t('cashdrawer.upravlenie_nalichnymi_sredstvami', 'Управление наличными средствами')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => openModal('deposit')} disabled={drawer.status !== 'open'}>
                        <Plus size={18} /> Внесение
                    </button>
                    <button className="btn btn-secondary" onClick={() => openModal('withdraw')} disabled={drawer.status !== 'open'}>
                        <Minus size={18} /> Выемка
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal('close')} disabled={drawer.status !== 'open'}>
                        <Lock size={18} /> {t('cashdrawer.zakryt_smenu', 'Закрыть смену')}
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

            {/* Статус кассы */}
            <div className="card" style={{
                marginBottom: '20px',
                padding: '24px',
                background: drawer.status === 'open'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #888 0%, #666 100%)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            {drawer.status === 'open' ? <Unlock size={24} /> : <Lock size={24} />}
                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                Касса {drawer.status === 'open' ? 'открыта' : 'закрыта'}
                            </span>
                        </div>
                        <div style={{ opacity: 0.8, fontSize: '13px' }}>
                            {drawer.status === 'open' && `Открыта: ${drawer.opened_at} • ${drawer.opened_by}`}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', opacity: 0.8 }}>{t('cashdrawer.v_kasse', 'В кассе')}</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold' }}>
                            {formatCurrency(drawer.current_cash || 0)}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Статистика смены */}
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('cashdrawer.statistika_smeny', '📊 Статистика смены')}</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '20px' }}>
                            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{drawer.sales_count || 0}</div>
                                <div style={{ color: '#888', fontSize: '13px' }}>{t('cashdrawer.prodazh', 'Продаж')}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(drawer.cash_sales || 0)}</div>
                                <div style={{ color: '#888', fontSize: '13px' }}>{t('cashdrawer.nalichnymi', 'Наличными')}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>{formatCurrency(drawer.card_sales || 0)}</div>
                                <div style={{ color: '#888', fontSize: '13px' }}>{t('cashdrawer.kartoy', 'Картой')}</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '16px' }}>{t('cashdrawer.itogo_prodazh', 'Итого продаж:')}</span>
                                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(drawer.total_sales || 0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Баланс */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('cashdrawer.balans_kassy', '💰 Баланс кассы')}</h3>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t('cashdrawer.nachalnyy_ostatok', 'Начальный остаток:')}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(drawer.starting_cash || 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t('cashdrawer.prodazhi_nalichnymi', 'Продажи наличными:')}</span>
                                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>+{formatCurrency(drawer.cash_sales || 0)}</span>
                                </div>
                                <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold' }}>{t('cashdrawer.ozhidaetsya_v_kasse', 'Ожидается в кассе:')}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(drawer.expected_cash || 0)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 'bold' }}>{t('cashdrawer.fakticheski', 'Фактически:')}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(drawer.current_cash || 0)}</span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    background: drawer.difference === 0 ? '#dcfce7' : '#fee2e2',
                                    borderRadius: '8px'
                                }}>
                                    <span>{t('cashdrawer.rashozhdenie', 'Расхождение:')}</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: drawer.difference === 0 ? '#10b981' : '#ef4444',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        {drawer.difference === 0 ? <Check size={16} /> : null}
                                        {formatCurrency(drawer.difference || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Операции */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('cashdrawer.operatsii', '📋 Операции')}</h3>
                    </div>
                    <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                        {operations.map(op => {
                            const style = getOperationStyle(op.type);
                            const OpIcon = style.icon;

                            return (
                                <div key={op.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)'
                                }}>
                                    <div style={{
                                        width: '32px', height: '32px',
                                        borderRadius: '50%',
                                        background: style.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <OpIcon size={16} color={style.color} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{op.description}</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>{op.time} • {op.user}</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: style.color }}>
                                        {op.amount > 0 ? '+' : ''}{formatCurrency(op.amount)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Deposit Modal */}
            {showDepositModal && (
                <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('cashdrawer.vnesenie_nalichnyh', '💵 Внесение наличных')}</h2>
                            <button onClick={() => setShowDepositModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t('cashdrawer.summa', 'Сумма')}</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
                            </div>
                            <div className="form-group">
                                <label>{t('cashdrawer.opisanie', 'Описание')}</label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Комментарий (необязательно)" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDepositModal(false)} className="btn btn-secondary">{t('cashdrawer.otmena', 'Отмена')}</button>
                            <button onClick={handleDeposit} className="btn btn-primary"><Plus size={16} /> {t('cashdrawer.vnesti', 'Внести')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('cashdrawer.vyemka_nalichnyh', '🏧 Выемка наличных')}</h2>
                            <button onClick={() => setShowWithdrawModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-bg-tertiary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('cashdrawer.dostupno_v_kasse', 'Доступно в кассе:')}</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(drawer.current_cash || 0)}</div>
                            </div>
                            <div className="form-group">
                                <label>{t('cashdrawer.summa_vyemki', 'Сумма выемки')}</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
                            </div>
                            <div className="form-group">
                                <label>{t('cashdrawer.opisanie', 'Описание')}</label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Например: Инкассация" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowWithdrawModal(false)} className="btn btn-secondary">{t('cashdrawer.otmena', 'Отмена')}</button>
                            <button onClick={handleWithdraw} className="btn btn-danger"><Minus size={16} /> {t('cashdrawer.izyat', 'Изъять')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseModal && (
                <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('cashdrawer.zakrytie_smeny', '🔒 Закрытие смены')}</h2>
                            <button onClick={() => setShowCloseModal(false)} className="btn-close">×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--color-bg-tertiary)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span>{t('cashdrawer.vyruchka_za_smenu', 'Выручка за смену:')}</span>
                                    <strong>{formatCurrency(drawer.total_sales || 0)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span>{t('cashdrawer.ozhidaetsya_v_kasse', 'Ожидается в кассе:')}</span>
                                    <strong>{formatCurrency(drawer.expected_cash || 0)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t('cashdrawer.kolichestvo_prodazh', 'Количество продаж:')}</span>
                                    <strong>{drawer.sales_count || 0}</strong>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t('cashdrawer.fakticheskaya_summa_v_kasse_podschitayte_n', 'Фактическая сумма в кассе (подсчитайте наличные)')}</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={drawer.expected_cash || '0'} autoFocus />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCloseModal(false)} className="btn btn-secondary">{t('cashdrawer.otmena', 'Отмена')}</button>
                            <button onClick={handleCloseShift} className="btn btn-danger"><Lock size={16} /> {t('cashdrawer.zakryt_smenu', 'Закрыть смену')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CashDrawer;
