import React from 'react';
import { HeadphonesIcon, Bug, RefreshCw, HelpCircle } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function Support() {
    const { t } = useI18n();
    const supportCategories = [
        {
            title: 'Консультации пользователей',
            icon: <HelpCircle size={32} />,
            color: '#3b82f6',
            services: [
                'Обучение работе с системой',
                'Консультации по функционалу',
                'Помощь в настройке отчётов',
                'Ответы на вопросы пользователей',
                'Удалённая поддержка'
            ]
        },
        {
            title: 'Исправление ошибок',
            icon: <Bug size={32} />,
            color: '#ef4444',
            services: [
                'Диагностика проблем',
                'Исправление ошибок конфигурации',
                'Восстановление работоспособности',
                'Исправление проведения документов',
                'Устранение блокировок'
            ]
        },
        {
            title: 'Обновление конфигураций',
            icon: <RefreshCw size={32} />,
            color: '#10b981',
            services: [
                'Установка обновлений платформы',
                'Обновление типовых конфигураций',
                'Обновление пользовательских доработок',
                'Тестирование после обновления',
                'Откат обновлений при необходимости'
            ]
        },
        {
            title: 'Техническая поддержка',
            icon: <HeadphonesIcon size={32} />,
            color: '#8b5cf6',
            services: [
                'Круглосуточная поддержка',
                'Удалённое подключение',
                'Мониторинг работы системы',
                'Профилактические работы',
                'Экстренное реагирование'
            ]
        }
    ];

    return (
        <div className="support-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('support.soprovozhdenie_i_podderzhka', 'Сопровождение и поддержка')}</h1>
                    <p className="text-muted">{t('support.tehnicheskaya_podderzhka_i_konsultatsii', 'Техническая поддержка и консультации')}</p>
                </div>
            </div>

            {/* Support Stats */}
            <div className="grid grid-4 mb-3">
                <div className="card">
                    <div className="stat-label">{t('support.srednee_vremya_otveta', 'Среднее время ответа')}</div>
                    <div className="stat-value text-success">{t('support.min', '15 мин')}</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('support.resheno_obrascheniy', 'Решено обращений')}</div>
                    <div className="stat-value">98%</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('support.aktivnyh_zayavok', 'Активных заявок')}</div>
                    <div className="stat-value text-warning">0</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('support.dostupnost', 'Доступность')}</div>
                    <div className="stat-value text-success">24/7</div>
                </div>
            </div>

            {/* Support Categories */}
            <div className="grid grid-2">
                {supportCategories.map((category, index) => (
                    <div key={index} className="card">
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '20px',
                            background: `${category.color}15`,
                            borderRadius: '10px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                background: category.color,
                                color: 'white',
                                padding: '15px',
                                borderRadius: '10px'
                            }}>
                                {category.icon}
                            </div>
                            <h2 style={{ margin: 0 }}>{category.title}</h2>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {category.services.map((service, sIndex) => (
                                <li key={sIndex} style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: 'var(--surface-color)',
                                    borderRadius: '6px',
                                    borderLeft: `3px solid ${category.color}`
                                }}>
                                    {service}
                                </li>
                            ))}
                        </ul>

                        <button
                            className="btn btn-primary"
                            style={{ marginTop: '15px', width: '100%', background: category.color, border: 'none' }}
                        >
                            Оформить заявку
                        </button>
                    </div>
                ))}
            </div>

            {/* Contact Info */}
            <div className="card" style={{ marginTop: '20px' }}>
                <h2>{t('support.kontaktnaya_informatsiya', 'Контактная информация')}</h2>
                <div className="grid grid-3" style={{ marginTop: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📞</div>
                        <div className="text-muted">{t('support.telefon', 'Телефон')}</div>
                        <div style={{ fontWeight: 'bold', marginTop: '5px' }}>+998 (90) 123-45-67</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✉️</div>
                        <div className="text-muted">Email</div>
                        <div style={{ fontWeight: 'bold', marginTop: '5px' }}>support@1c.uz</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💬</div>
                        <div className="text-muted">Telegram</div>
                        <div style={{ fontWeight: 'bold', marginTop: '5px' }}>@1c_support</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Support;
