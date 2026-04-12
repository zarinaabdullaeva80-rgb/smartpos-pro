import React, { useState, useEffect } from 'react';
import { Award, Trophy, Star, Users, Gift, Target, Zap, Crown } from 'lucide-react';
import { loyaltyAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Achievements() {
    const { t } = useI18n();
    const toast = useToast();
    const [achievements, setAchievements] = useState([]);
    const [customerStats, setCustomerStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await loyaltyAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('Achievements.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('Achievements: не удалось загрузить данные', err.message);
        }


        setLoading(false);
    };

    const totalUnlocks = achievements.reduce((sum, a) => sum + a.unlocked_count, 0);

    return (
        <div className="achievements-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('achievements.dostizheniya', '🏆 Достижения')}</h1>
                    <p className="text-muted">{t('achievements.geymifikatsiya_i_nagrady_dlya_klientov', 'Геймификация и награды для клиентов')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Создание нового достижения...')}>
                    <Award size={18} /> Создать достижение
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Trophy size={32} color="#fbbf24" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{achievements.length}</div>
                    <div style={{ color: '#666' }}>{t('achievements.dostizheniy', 'Достижений')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Star size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{totalUnlocks}</div>
                    <div style={{ color: '#666' }}>{t('achievements.razblokirovano', 'Разблокировано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{customerStats.length}</div>
                    <div style={{ color: '#666' }}>{t('achievements.aktivnyh_igrokov', 'Активных игроков')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Zap size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {achievements.reduce((sum, a) => sum + a.xp, 0)} XP
                    </div>
                    <div style={{ color: '#666' }}>{t('achievements.vsego_dostupno', 'Всего доступно')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Список достижений */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('achievements.vse_dostizheniya', '🎖️ Все достижения')}</h3>
                    </div>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>{t('achievements.zagruzka', 'Загрузка...')}</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '16px' }}>
                            {achievements.map(ach => (
                                <div key={ach.id} style={{
                                    padding: '20px',
                                    border: '2px solid var(--border-color)',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, transparent 100%)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                        <div style={{
                                            fontSize: '40px',
                                            width: '60px', height: '60px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                            borderRadius: '12px'
                                        }}>
                                            {ach.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: '0 0 4px' }}>{ach.name}</h4>
                                            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#888' }}>
                                                {ach.description}
                                            </p>
                                            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                                                <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>+{ach.xp} XP</span>
                                                <span style={{ color: '#888' }}>👤 {ach.unlocked_count} получили</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Лидерборд */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('achievements.top_klientov', '👑 Топ клиентов')}</h3>
                    </div>
                    <div>
                        {customerStats.map((cust, idx) => (
                            <div key={cust.id} style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: idx === 0 ? 'linear-gradient(90deg, #fef3c720 0%, transparent 100%)' : 'transparent'
                            }}>
                                {idx === 0 ? (
                                    <Crown size={24} color="#fbbf24" />
                                ) : (
                                    <span style={{ width: '24px', textAlign: 'center', fontWeight: 'bold', color: '#888' }}>
                                        {idx + 1}
                                    </span>
                                )}
                                <div style={{
                                    width: '40px', height: '40px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    {cust.avatar}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{cust.name}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {cust.achievements} достижений
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}>
                                        LVL {cust.level}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#8b5cf6', marginTop: '4px' }}>
                                        {cust.xp} XP
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Achievements;
