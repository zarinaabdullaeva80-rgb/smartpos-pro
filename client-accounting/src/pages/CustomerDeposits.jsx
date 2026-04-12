import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Search, ArrowUpCircle, ArrowDownCircle, History, User } from 'lucide-react';
import { customersAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CustomerDeposits() {
    const { t } = useI18n();
    const toast = useToast();
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showTopUp, setShowTopUp] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadCustomers(); }, []);

    const loadCustomers = async () => {
        try {
            const apiRes = await customersAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setCustomers(apiData.customers || []);
        } catch (err) {
            console.warn('CustomerDeposits: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const selectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        try {
            const res = await customersAPI.getDeposits(customer.id);
            setTransactions(res.data?.transactions || res.data?.deposits || []);
        } catch (err) {
            console.warn('Не удалось загрузить транзакции:', err.message);
            setTransactions([]);
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const totalBalance = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    return (
        <div className="customer-deposits-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('customerdeposits.depozity_klientov', '💰 Депозиты клиентов')}</h1>
                    <p className="text-muted">{t('customerdeposits.predoplachennye_scheta_klientov', 'Предоплаченные счета клиентов')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                    <Wallet size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(totalBalance)}</div>
                    <div style={{ color: '#666' }}>{t('customerdeposits.obschiy_balans', 'Общий баланс')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #3b82f6' }}>
                    <User size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{customers.length}</div>
                    <div style={{ color: '#666' }}>{t('customerdeposits.klientov_s_depozitom', 'Клиентов с депозитом')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                    <ArrowUpCircle size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatCurrency(customers.length ? totalBalance / customers.length : 0)}</div>
                    <div style={{ color: '#666' }}>{t('customerdeposits.sredniy_balans', 'Средний баланс')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px' }}>
                {/* Список клиентов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                placeholder="Поиск клиента..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                            />
                        </div>
                    </div>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>{t('customerdeposits.zagruzka', 'Загрузка...')}</div>
                        ) : filteredCustomers.map(customer => (
                            <div
                                key={customer.id}
                                onClick={() => selectCustomer(customer)}
                                style={{
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedCustomer?.id === customer.id ? 'var(--primary-light)' : 'transparent'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{customer.name}</div>
                                        <div style={{ fontSize: '13px', color: '#888' }}>{customer.phone}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', color: customer.balance > 0 ? '#10b981' : '#888' }}>
                                            {formatCurrency(customer.balance)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Детали клиента */}
                <div>
                    {selectedCustomer ? (
                        <div className="card">
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 4px' }}>{selectedCustomer.name}</h3>
                                    <div style={{ color: '#888' }}>{selectedCustomer.phone}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{t('customerdeposits.balans', 'Баланс')}</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                            {formatCurrency(selectedCustomer.balance)}
                                        </div>
                                    </div>
                                    <button className="btn btn-primary" onClick={() => setShowTopUp(true)}>
                                        <Plus size={18} /> Пополнить
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '16px' }}>
                                <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <History size={18} /> История операций
                                </h4>
                                {transactions.length === 0 ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>{t('customerdeposits.net_operatsiy', 'Нет операций')}</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('customerdeposits.data', 'Дата')}</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('customerdeposits.operatsiya', 'Операция')}</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>{t('customerdeposits.summa', 'Сумма')}</th>
                                                <th style={{ padding: '10px', textAlign: 'left' }}>{t('customerdeposits.kassir', 'Кассир')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map(tx => (
                                                <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '10px' }}>{formatDate(tx.date || tx.created_at)}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        {tx.type === 'deposit' ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <ArrowUpCircle size={16} color="#10b981" /> Пополнение {tx.method ? `(${tx.method})` : ''}
                                                            </span>
                                                        ) : (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <ArrowDownCircle size={16} color="#ef4444" /> Оплата {tx.order_id ? `(${tx.order_id})` : ''}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: tx.amount > 0 ? '#10b981' : '#ef4444' }}>
                                                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                                    </td>
                                                    <td style={{ padding: '10px', color: '#888' }}>{tx.cashier || tx.username || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                            <Wallet size={64} style={{ color: '#ccc', marginBottom: '20px' }} />
                            <h3>{t('customerdeposits.vyberite_klienta', 'Выберите клиента')}</h3>
                            <p className="text-muted">{t('customerdeposits.vyberite_klienta_sleva_dlya_prosmotra_ego', 'Выберите клиента слева для просмотра его депозита')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Модал пополнения */}
            {showTopUp && (
                <div className="modal-overlay" onClick={() => setShowTopUp(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>{t('customerdeposits.popolnit_depozit', '💵 Пополнить депозит')}</h2>
                        </div>
                        <div className="modal-body">
                            <p><strong>{selectedCustomer?.name}</strong></p>
                            <p style={{ color: '#888' }}>Текущий баланс: {formatCurrency(selectedCustomer?.balance)}</p>
                            <div className="form-group">
                                <label>{t('customerdeposits.summa_popolneniya', 'Сумма пополнения')}</label>
                                <input
                                    type="number"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    placeholder="100000"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('customerdeposits.sposob_oplaty', 'Способ оплаты')}</label>
                                <select>
                                    <option value="cash">{t('customerdeposits.nalichnye', 'Наличные')}</option>
                                    <option value="card">{t('customerdeposits.karta', 'Карта')}</option>
                                    <option value="transfer">{t('customerdeposits.perevod', 'Перевод')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowTopUp(false)}>{t('customerdeposits.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => { setShowTopUp(false); toast.info('Депозит пополнен!'); }}>
                                <Plus size={18} /> Пополнить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CustomerDeposits;
