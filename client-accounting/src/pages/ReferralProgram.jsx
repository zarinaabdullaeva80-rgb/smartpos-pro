import React, { useState, useEffect } from 'react';
import { Users, Gift, Link, Copy, Share2, TrendingUp, Award } from 'lucide-react';
import { loyaltyAPI } from '../services/api';
import { useI18n } from '../i18n';


function ReferralProgram() {
    const { t } = useI18n();
    const [settings, setSettings] = useState({});
    const [referrals, setReferrals] = useState([]);
    const [topReferrers, setTopReferrers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await loyaltyAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSettings(apiData.settings || {});
            setReferrals(apiData.referrals || []);
            setTopReferrers(apiData.topReferrers || []);
        } catch (err) {
            console.warn('ReferralProgram: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const getStatusBadge = (status) => {
        const styles = {
            pending: { bg: '#fef3c7', color: '#d97706', text: 'Ожидает' },
            qualified: { bg: '#dbeafe', color: '#1d4ed8', text: 'Квалифицирован' },
            rewarded: { bg: '#dcfce7', color: '#16a34a', text: 'Награждён' }
        };
        const s = styles[status] || styles.pending;
        return <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>{s.text}</span>;
    };

    const stats = {
        totalReferrals: referrals.length,
        rewarded: referrals.filter(r => r.status === 'rewarded').length,
        totalBonuses: referrals.reduce((sum, r) => sum + (r.referrer_bonus || 0), 0),
        pending: referrals.filter(r => r.status === 'pending').length
    };

    return (
        <div className="referral-program-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('referralprogram.referalnaya_programma', '👥 Реферальная программа')}</h1>
                    <p className="text-muted">{t('referralprogram.privedi_druga_poluchi_bonusy', '"Приведи друга" - получи бонусы')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Users size={32} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.totalReferrals}</div>
                    <div style={{ color: '#666' }}>{t('referralprogram.vsego_priglasheniy', 'Всего приглашений')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Award size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.rewarded}</div>
                    <div style={{ color: '#666' }}>{t('referralprogram.nagrazhdeno', 'Награждено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Gift size={32} color="#8b5cf6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(stats.totalBonuses)}</div>
                    <div style={{ color: '#666' }}>{t('referralprogram.vyplacheno_bonusov', 'Выплачено бонусов')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <TrendingUp size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.pending}</div>
                    <div style={{ color: '#666' }}>{t('referralprogram.ozhidayut', 'Ожидают')}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                {/* Настройки программы */}
                <div>
                    <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                        <h3 style={{ marginTop: 0 }}>{t('referralprogram.nastroyki_programmy', '⚙️ Настройки программы')}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>{t('referralprogram.bonus_priglasivshemu', 'Бонус пригласившему')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                    {formatCurrency(settings.referrer_bonus_value)}
                                </div>
                            </div>
                            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>{t('referralprogram.bonus_priglashyonnomu', 'Бонус приглашённому')}</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                                    {formatCurrency(settings.referee_bonus_value)}
                                </div>
                            </div>
                        </div>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '16px', marginBottom: 0 }}>
                            💡 Бонусы начисляются после первой покупки приглашённого от {formatCurrency(settings.min_purchase_for_bonus)}
                        </p>
                    </div>

                    {/* История приглашений */}
                    <div className="card">
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0 }}>{t('referralprogram.istoriya_priglasheniy', '📋 История приглашений')}</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('referralprogram.priglasil', 'Пригласил')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('referralprogram.priglashyonnyy', 'Приглашённый')}</th>
                                    <th style={{ padding: '12px', textAlign: 'left' }}>{t('referralprogram.data', 'Дата')}</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>{t('referralprogram.status', 'Статус')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('referralprogram.bonus', 'Бонус')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {referrals.map(ref => (
                                    <tr key={ref.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>{ref.referrer_name}</td>
                                        <td style={{ padding: '12px' }}>{ref.referee_name}</td>
                                        <td style={{ padding: '12px' }}>{formatDate(ref.created_at)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(ref.status)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: ref.referrer_bonus > 0 ? '#10b981' : '#888' }}>
                                            {ref.referrer_bonus > 0 ? `+${formatCurrency(ref.referrer_bonus)}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Топ рефереров */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('referralprogram.top_refererov', '🏆 Топ рефереров')}</h3>
                    </div>
                    <div style={{ padding: '16px' }}>
                        {topReferrers.map((ref, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                background: idx === 0 ? '#fef3c7' : 'transparent',
                                borderRadius: '8px',
                                marginBottom: '8px'
                            }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#e5e7eb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', color: idx < 3 ? 'white' : '#666'
                                }}>
                                    {idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{ref.name}</div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {ref.referrals_count} приглашений
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>
                                    {formatCurrency(ref.total_earned)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReferralProgram;
