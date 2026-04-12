import React, { useState, useEffect } from 'react';
import { Crown, Star, Users, TrendingUp, Gift, Settings, Plus, Edit2 } from 'lucide-react';
import { loyaltyAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CustomerLevels() {
    const { t } = useI18n();
    const toast = useToast();
    const [levels, setLevels] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await loyaltyAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setLevels(apiData.levels || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('CustomerLevels: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => {
        if (value === null) return '∞';
        return new Intl.NumberFormat('ru-RU').format(value) + " so'm";
    };

    return (
        <div className="customer-levels-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('customerlevels.urovni_klientov', '👑 Уровни клиентов')}</h1>
                    <p className="text-muted">{t('customerlevels.sistema_urovney_loyalnosti', 'Система уровней лояльности')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Добавление уровня...')}>
                    <Plus size={18} /> Добавить уровень
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {levels.map(level => (
                    <div key={level.id} className="card" style={{
                        padding: '20px',
                        textAlign: 'center',
                        borderTop: `4px solid ${level.color}`
                    }}>
                        <div style={{
                            width: '50px', height: '50px',
                            borderRadius: '50%',
                            background: level.color,
                            margin: '0 auto 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Crown size={24} color="white" />
                        </div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{level.name}</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{level.customers_count}</div>
                        <div style={{ color: '#888', fontSize: '13px' }}>{t('customerlevels.klientov', 'клиентов')}</div>
                    </div>
                ))}
            </div>

            {/* Таблица уровней */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('customerlevels.nastroyki_urovney', '⚙️ Настройки уровней')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('customerlevels.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('customerlevels.uroven', 'Уровень')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('customerlevels.porog_vhoda', 'Порог входа')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('customerlevels.skidka', 'Скидка')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('customerlevels.mnozhitel', 'Множитель')}</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{t('customerlevels.privilegii', 'Привилегии')}</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>{t('customerlevels.deystviya', 'Действия')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {levels.map(level => (
                                <tr key={level.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px', height: '36px',
                                                borderRadius: '50%',
                                                background: level.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Crown size={18} color="white" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{level.name}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>
                                                    {level.customers_count} клиентов
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div>от {formatCurrency(level.min_spent)}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            до {formatCurrency(level.max_spent)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            background: '#dcfce7',
                                            color: '#16a34a',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            {level.discount}%
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{
                                            background: '#dbeafe',
                                            color: '#1d4ed8',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            x{level.bonus_multiplier}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {level.benefits.slice(0, 2).map((b, i) => (
                                                <span key={i} style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px'
                                                }}>
                                                    {b}
                                                </span>
                                            ))}
                                            {level.benefits.length > 2 && (
                                                <span style={{ fontSize: '12px', color: '#888' }}>
                                                    +{level.benefits.length - 2} ещё
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => toast.info(`Редактирование: ${level.name}`)}>
                                            <Edit2 size={14} />
                                        </button>
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

export default CustomerLevels;
