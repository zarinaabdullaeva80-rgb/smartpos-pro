import React, { useState, useEffect } from 'react';
import { Gift, Star, TrendingUp, Award } from 'lucide-react';
import '../styles/Common.css';
import { loyaltyAPI } from '../services/api';
import { useI18n } from '../i18n';

const LoyaltyProgram = () => {
    const { t } = useI18n();
    const [customers, setCustomers] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadCustomers();
        loadTiers();
    }, []);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const response = await loyaltyAPI.getCards();
            setCustomers(response.data?.cards || response.data || []);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTiers = async () => {
        try {
            const response = await loyaltyAPI.getProgram();
            const data = response.data;
            // API может вернуть {tiers: [...]}, массив, или объект настроек
            const tiersData = Array.isArray(data?.tiers) ? data.tiers 
                            : Array.isArray(data) ? data 
                            : [];
            setTiers(tiersData);
        } catch (error) {
            console.error('Error loading tiers:', error);
            setTiers([]);
        }
    };

    const loadTransactions = async (customerId) => {
        try {
            const response = await loyaltyAPI.getCardById(customerId);
            setTransactions(response.data?.transactions || []);
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        loadTransactions(customer.customer_id || customer.id);
    };

    const getTierIcon = (tierName) => {
        const icons = {
            'Bronze': '🥉',
            'Silver': '🥈',
            'Gold': '🥇',
            'Platinum': '💎'
        };
        return icons[tierName] || '⭐';
    };

    const getTransactionTypeText = (type) => {
        const types = {
            'earned': 'Начислено',
            'spent': 'Списано',
            'expired': 'Истекло',
            'adjusted': 'Корректировка'
        };
        return types[type] || type;
    };

    const getTransactionTypeColor = (type) => {
        const colors = {
            'earned': '#28a745',
            'spent': '#dc3545',
            'expired': '#6c757d',
            'adjusted': '#ffc107'
        };
        return colors[type] || '#6c757d';
    };

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Gift size={32} /> {t('loyaltyprogram.programma_loyalnosti', 'Программа лояльности')}</h1>
                    <p>{t('loyaltyprogram.upravlenie_ballami_i_urovnyami_klientov', 'Управление баллами и уровнями клиентов')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#4472C4' }}>
                        <Star size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{customers.length}</div>
                        <div className="stat-label">{t('loyaltyprogram.uchastnikov_programmy', 'Участников программы')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#70AD47' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {customers.reduce((sum, c) => sum + parseFloat(c.total_points || 0), 0).toFixed(0)}
                        </div>
                        <div className="stat-label">{t('loyaltyprogram.vsego_ballov', 'Всего баллов')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#FFD700' }}>
                        <Award size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {customers.filter(c => c.tier_name === 'Gold' || c.tier_name === 'Platinum').length}
                        </div>
                        <div className="stat-label">{t('loyaltyprogram.klientov', 'VIP клиентов')}</div>
                    </div>
                </div>
            </div>

            {/* Уровни */}
            <div className="card">
                <h3>{t('loyaltyprogram.urovni_programmy', 'Уровни программы')}</h3>
                <div className="tiers-grid">
                    {tiers.map(tier => (
                        <div key={tier.id} className="tier-card" style={{ borderColor: tier.color }}>
                            <div className="tier-icon">{getTierIcon(tier.name)}</div>
                            <div className="tier-name">{tier.name}</div>
                            <div className="tier-details">
                                <div>{t('loyaltyprogram.skidka', 'Скидка:')} <strong>{tier.discount_percent}%</strong></div>
                                <div>{t('loyaltyprogram.mnozhitel', 'Множитель:')} <strong>{tier.points_multiplier}x</strong></div>
                                <div>{t('loyaltyprogram.ot', 'От:')} <strong>{parseFloat(tier.min_purchases_amount).toLocaleString()} ₽</strong></div>
                            </div>
                            <div className="tier-count">
                                {customers.filter(c => c.tier_id === tier.id).length} клиентов
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Таблица клиентов */}
            <div className="loyalty-layout">
                <div className="card customers-table">
                    <h3>{t('loyaltyprogram.klienty_programmy', 'Клиенты программы')}</h3>
                    {loading && <div>{t('loyaltyprogram.zagruzka', 'Загрузка...')}</div>}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('loyaltyprogram.klient', 'Клиент')}</th>
                                <th>{t('loyaltyprogram.uroven', 'Уровень')}</th>
                                <th>{t('loyaltyprogram.bally', 'Баллы')}</th>
                                <th>{t('loyaltyprogram.nachisleno', 'Начислено')}</th>
                                <th>{t('loyaltyprogram.spisano', 'Списано')}</th>
                                <th>{t('loyaltyprogram.skidka', 'Скидка')}</th>
                                <th>{t('loyaltyprogram.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => (
                                <tr
                                    key={customer.id}
                                    className={selectedCustomer?.id === customer.id ? 'selected' : ''}
                                    onClick={() => selectCustomer(customer)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td>
                                        <div><strong>{customer.customer_name}</strong></div>
                                        <div style={{ fontSize: '12px', opacity: 0.7 }}>{customer.customer_phone}</div>
                                    </td>
                                    <td>
                                        <span className="tier-badge" style={{ background: customer.tier_color }}>
                                            {getTierIcon(customer.tier_name)} {customer.tier_name}
                                        </span>
                                    </td>
                                    <td><strong>{parseFloat(customer.total_points).toFixed(0)}</strong></td>
                                    <td style={{ color: '#28a745' }}>{parseFloat(customer.earned_points).toFixed(0)}</td>
                                    <td style={{ color: '#dc3545' }}>{parseFloat(customer.spent_points).toFixed(0)}</td>
                                    <td><strong>{customer.tier_discount}%</strong></td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectCustomer(customer);
                                            }}
                                        >
                                            История
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* История транзакций */}
                {selectedCustomer && (
                    <div className="card transactions-panel">
                        <h3>История баллов: {selectedCustomer.customer_name}</h3>
                        <div className="balance-summary">
                            <div className="balance-item">
                                <div className="balance-label">{t('loyaltyprogram.tekuschiy_balans', 'Текущий баланс')}</div>
                                <div className="balance-value">{parseFloat(selectedCustomer.total_points).toFixed(0)} баллов</div>
                            </div>
                            <div className="balance-item">
                                <div className="balance-label">{t('loyaltyprogram.uroven', 'Уровень')}</div>
                                <div className="balance-value">
                                    {getTierIcon(selectedCustomer.tier_name)} {selectedCustomer.tier_name}
                                </div>
                            </div>
                        </div>

                        <div className="transactions-list">
                            {transactions.map(tx => (
                                <div key={tx.id} className="transaction-item">
                                    <div className="transaction-icon" style={{ background: getTransactionTypeColor(tx.transaction_type) }}>
                                        {tx.transaction_type === 'earned' ? '+' : '-'}
                                    </div>
                                    <div className="transaction-details">
                                        <div className="transaction-type">
                                            {getTransactionTypeText(tx.transaction_type)}
                                        </div>
                                        <div className="transaction-description">{tx.description}</div>
                                        <div className="transaction-date">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="transaction-amount" style={{ color: getTransactionTypeColor(tx.transaction_type) }}>
                                        {tx.transaction_type === 'earned' ? '+' : ''}{parseFloat(tx.points).toFixed(0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .tiers-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-top: 16px;
                }

                .tier-card {
                    border: 2px solid;
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    transition: transform 0.2s;
                }

                .tier-card:hover {
                    transform: translateY(-4px);
                }

                .tier-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .tier-name {
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 12px;
                }

                .tier-details {
                    font-size: 13px;
                    margin-bottom: 12px;
                }

                .tier-details div {
                    margin: 4px 0;
                }

                .tier-count {
                    font-size: 12px;
                    opacity: 0.7;
                }

                .tier-badge {
                    padding: 4px 12px;
                    border-radius: 12px;
                    color: white;
                    font-size: 13px;
                    font-weight: 600;
                    display: inline-block;
                }

                .loyalty-layout {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    gap: 20px;
                    margin-top: 20px;
                }

                .transactions-panel {
                    max-height: 600px;
                    overflow-y: auto;
                }

                .balance-summary {
                    background: var(--input-bg);
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .balance-item {
                    margin-bottom: 12px;
                }

                .balance-label {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-bottom: 4px;
                }

                .balance-value {
                    font-size: 20px;
                    font-weight: 700;
                }

                .transactions-list {
                    max-height: 400px;
                    overflow-y: auto;
                }

                .transaction-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-bottom: 1px solid var(--border-color);
                }

                .transaction-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 18px;
                }

                .transaction-details {
                    flex: 1;
                }

                .transaction-type {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .transaction-description {
                    font-size: 12px;
                    opacity: 0.7;
                    margin-bottom: 2px;
                }

                .transaction-date {
                    font-size: 11px;
                    opacity: 0.5;
                }

                .transaction-amount {
                    font-size: 18px;
                    font-weight: 700;
                }

                tr.selected {
                    background: rgba(68, 114, 196, 0.1);
                }
            `}</style>
        </div>
    );
};

export default LoyaltyProgram;
