import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Search, Filter, Reply } from 'lucide-react';
import { customersAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function CustomerReviews() {
    const { t } = useI18n();
    const toast = useToast();
    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState({ avg: 0, total: 0, nps: 0 });
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadReviews(); }, []);

    const loadReviews = async () => {
        try {
            const apiRes = await customersAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setReviews(apiData.reviews || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('CustomerReviews: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('ru-RU') : '-';

    const renderStars = (rating) => {
        return [...Array(5)].map((_, i) => (
            <Star
                key={i}
                size={16}
                fill={i < rating ? '#fbbf24' : 'none'}
                color={i < rating ? '#fbbf24' : '#d1d5db'}
            />
        ));
    };

    const filteredReviews = reviews.filter(r => {
        if (filter === 'all') return true;
        if (filter === 'positive') return r.rating >= 4;
        if (filter === 'negative') return r.rating <= 2;
        if (filter === 'unanswered') return !r.admin_response;
        return true;
    });

    return (
        <div className="customer-reviews-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('customerreviews.otzyvy_klientov', '⭐ Отзывы клиентов')}</h1>
                    <p className="text-muted">{t('customerreviews.upravlenie_otzyvami_i_reytingami', 'Управление отзывами и рейтингами')}</p>
                </div>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Общий рейтинг */}
                <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '56px', fontWeight: 'bold', color: '#fbbf24' }}>{stats.avg}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '12px 0' }}>
                        {renderStars(Math.round(stats.avg))}
                    </div>
                    <div style={{ color: '#666' }}>На основе {stats.total} отзывов</div>

                    <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: stats.nps >= 50 ? '#10b981' : stats.nps >= 0 ? '#f59e0b' : '#ef4444' }}>
                            {stats.nps}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>NPS Score</div>
                    </div>
                </div>

                {/* Распределение */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginTop: 0 }}>{t('customerreviews.raspredelenie_otsenok', 'Распределение оценок')}</h3>
                    {[5, 4, 3, 2, 1].map(star => {
                        const count = stats.distribution?.[star - 1] || 0;
                        const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                        return (
                            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <span style={{ width: '20px', fontWeight: 'bold' }}>{star}</span>
                                <Star size={16} fill="#fbbf24" color="#fbbf24" />
                                <div style={{ flex: 1, height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${percent}%`,
                                        height: '100%',
                                        background: star >= 4 ? '#10b981' : star >= 3 ? '#f59e0b' : '#ef4444',
                                        borderRadius: '6px'
                                    }} />
                                </div>
                                <span style={{ width: '50px', textAlign: 'right', color: '#666' }}>{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Фильтры */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'all', label: 'Все отзывы' },
                        { key: 'positive', label: '👍 Положительные' },
                        { key: 'negative', label: '👎 Отрицательные' },
                        { key: 'unanswered', label: '💬 Без ответа' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: filter === f.key ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: filter === f.key ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Список отзывов */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('customerreviews.zagruzka', 'Загрузка...')}</div>
                ) : filteredReviews.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <MessageSquare size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
                        <p>{t('customerreviews.otzyvy_ne_naydeny', 'Отзывы не найдены')}</p>
                    </div>
                ) : (
                    filteredReviews.map(review => (
                        <div key={review.id} style={{
                            padding: '20px',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 'bold'
                                        }}>
                                            {review.customer_name[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {review.customer_name}
                                                {review.is_verified && (
                                                    <span style={{ fontSize: '12px', color: '#10b981' }}>{t('customerreviews.pokupatel', '✓ Покупатель')}</span>
                                                )}
                                                {review.is_featured && (
                                                    <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                                        ⭐ Избранный
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <div style={{ display: 'flex', gap: '2px' }}>{renderStars(review.rating)}</div>
                                                <span style={{ color: '#888', fontSize: '13px' }}>• {formatDate(review.created_at)}</span>
                                                {review.product_name && (
                                                    <span style={{ color: '#888', fontSize: '13px' }}>• {review.product_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {!review.admin_response && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => toast.info(`Ответ на отзыв: ${review.customer_name}`)}>
                                        <Reply size={14} /> Ответить
                                    </button>
                                )}
                            </div>

                            {review.title && <h4 style={{ margin: '0 0 8px' }}>{review.title}</h4>}
                            <p style={{ margin: 0, color: '#444' }}>{review.comment}</p>

                            {(review.pros || review.cons) && (
                                <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                                    {review.pros && (
                                        <div style={{ color: '#10b981', fontSize: '14px' }}>
                                            <ThumbsUp size={14} style={{ marginRight: '4px' }} />
                                            {review.pros}
                                        </div>
                                    )}
                                    {review.cons && (
                                        <div style={{ color: '#ef4444', fontSize: '14px' }}>
                                            <ThumbsDown size={14} style={{ marginRight: '4px' }} />
                                            {review.cons}
                                        </div>
                                    )}
                                </div>
                            )}

                            {review.admin_response && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid var(--primary)'
                                }}>
                                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                                        Ответ компании • {formatDate(review.admin_response_at)}
                                    </div>
                                    <p style={{ margin: 0, color: '#555' }}>{review.admin_response}</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default CustomerReviews;
