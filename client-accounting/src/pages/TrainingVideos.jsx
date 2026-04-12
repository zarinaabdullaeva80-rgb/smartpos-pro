import React, { useState, useEffect } from 'react';
import { Video, Play, Clock, Users, Search, BookOpen, CheckCircle, PlayCircle } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function TrainingVideos() {
    const { t } = useI18n();
    const [videos, setVideos] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('TrainingVideos.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('TrainingVideos: не удалось загрузить данные', err.message);
        }


        setLoading(false);
    };

    const filteredVideos = selectedCategory === 'all'
        ? videos
        : videos.filter(v => v.category === selectedCategory);

    const completedCount = videos.filter(v => v.completed).length;
    const progress = Math.round((completedCount / videos.length) * 100);

    return (
        <div className="training-videos-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('trainingvideos.obuchayuschie_video', '🎬 Обучающие видео')}</h1>
                    <p className="text-muted">{t('trainingvideos.videouroki_po_rabote_s_sistemoy', 'Видеоуроки по работе с системой')}</p>
                </div>
            </div>

            {/* Прогресс */}
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        width: '80px', height: '80px',
                        borderRadius: '50%',
                        background: `conic-gradient(#10b981 ${progress * 3.6}deg, #e5e7eb 0deg)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '60px', height: '60px',
                            borderRadius: '50%',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>
                            {progress}%
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 8px' }}>{t('trainingvideos.vash_progress_obucheniya', 'Ваш прогресс обучения')}</h3>
                        <p style={{ margin: 0, color: '#888' }}>
                            Просмотрено {completedCount} из {videos.length} видео.
                            {progress < 100 ? ' Продолжайте обучение!' : ' Отлично! Вы прошли все уроки!'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{videos.length}</div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('trainingvideos.vsego_video', 'Всего видео')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{completedCount}</div>
                            <div style={{ color: '#888', fontSize: '13px' }}>{t('trainingvideos.prosmotreno', 'Просмотрено')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Категории */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '8px',
                                background: selectedCategory === cat.id ? 'var(--primary)' : 'var(--bg-secondary)',
                                color: selectedCategory === cat.id ? 'white' : 'inherit',
                                cursor: 'pointer'
                            }}
                        >
                            {cat.name} ({cat.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* Список видео */}
            {loading ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>{t('trainingvideos.zagruzka', 'Загрузка...')}</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {filteredVideos.map(video => (
                        <div key={video.id} className="card" style={{ overflow: 'hidden', cursor: 'pointer' }}>
                            <div style={{
                                height: '160px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                <span style={{ fontSize: '64px' }}>{video.thumbnail}</span>
                                <div style={{
                                    position: 'absolute',
                                    bottom: '12px',
                                    right: '12px',
                                    background: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }}>
                                    {video.duration}
                                </div>
                                {video.completed && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '12px',
                                        background: '#10b981',
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <CheckCircle size={14} /> {t('trainingvideos.prosmotreno', 'Просмотрено')}
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute',
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.9)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <PlayCircle size={40} color="#667eea" />
                                </div>
                            </div>
                            <div style={{ padding: '16px' }}>
                                <h4 style={{ margin: '0 0 8px' }}>{video.title}</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '13px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} /> {video.duration}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Users size={14} /> {video.views} просмотров
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TrainingVideos;
