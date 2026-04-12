import React, { useState } from 'react';
import { Workflow, FileCheck, Calculator, Bell } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function Automation() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('approval');

    const automationFeatures = {
        approval: {
            title: 'Настройка маршрутов согласования',
            icon: <Workflow size={24} />,
            features: [
                'Многоуровневое согласование документов',
                'Гибкие маршруты утверждения',
                'Делегирование полномочий',
                'Параллельное и последовательное согласование',
                'История согласований'
            ]
        },
        workflow: {
            title: 'Электронный документооборот',
            icon: <FileCheck size={24} />,
            features: [
                'Создание и контроль задач',
                'Электронная подпись',
                'Версионность документов',
                'Архивирование',
                'Поиск и фильтрация'
            ]
        },
        calculations: {
            title: 'Автоматизация расчётов',
            icon: <Calculator size={24} />,
            features: [
                'Автоматический расчёт зарплаты',
                'Расчёт налогов и взносов',
                'Формирование себестоимости',
                'Расчёт бонусов и комиссий',
                'Автоматические уведомления'
            ]
        },
        notifications: {
            title: 'Настройка уведомлений и задач',
            icon: <Bell size={24} />,
            features: [
                'Email-уведомления',
                'Push-уведомления',
                'SMS-рассылка',
                'Напоминания о задачах',
                'Календарь событий'
            ]
        }
    };

    return (
        <div className="automation-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('automation.avtomatizatsiya_biznes_protsessov', 'Автоматизация бизнес-процессов')}</h1>
                    <p className="text-muted">{t('automation.nastroyka_avtomaticheskih_protsessov', 'Настройка автоматических процессов')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="card mb-3">
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {Object.entries(automationFeatures).map(([key, feature]) => (
                        <button
                            key={key}
                            className={`btn ${activeTab === key ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab(key)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {feature.icon}
                            <span>{feature.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-2">
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <div style={{
                            background: 'var(--primary-color)',
                            color: 'white',
                            padding: '15px',
                            borderRadius: '10px'
                        }}>
                            {automationFeatures[activeTab].icon}
                        </div>
                        <h2 style={{ margin: 0 }}>{automationFeatures[activeTab].title}</h2>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {automationFeatures[activeTab].features.map((feature, index) => (
                            <li key={index} style={{
                                padding: '12px',
                                marginBottom: '10px',
                                background: 'var(--surface-color)',
                                borderRadius: '8px',
                                borderLeft: '4px solid var(--primary-color)'
                            }}>
                                {feature}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: '20px' }}>{t('automation.aktivnye_protsessy', 'Активные процессы')}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{
                            padding: '15px',
                            background: 'var(--surface-color)',
                            borderRadius: '8px',
                            borderLeft: '4px solid var(--success-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong>{t('automation.avtomaticheskaya_rassylka_otchyotov', 'Автоматическая рассылка отчётов')}</strong>
                                <span className="badge badge-success">{t('automation.aktivno', 'Активно')}</span>
                            </div>
                            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Ежедневная отправка отчётов руководству в 09:00
                            </p>
                        </div>

                        <div style={{
                            padding: '15px',
                            background: 'var(--surface-color)',
                            borderRadius: '8px',
                            borderLeft: '4px solid var(--success-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong>{t('automation.avtomaticheskiy_raschyot_zarplaty', 'Автоматический расчёт зарплаты')}</strong>
                                <span className="badge badge-success">{t('automation.aktivno', 'Активно')}</span>
                            </div>
                            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Расчёт производится ежемесячно 25-го числа
                            </p>
                        </div>

                        <div style={{
                            padding: '15px',
                            background: 'var(--surface-color)',
                            borderRadius: '8px',
                            borderLeft: '4px solid var(--primary-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong>{t('automation.uvedomleniya_o_zadachah', 'Уведомления о задачах')}</strong>
                                <span className="badge badge-primary">{t('automation.nastroeno', 'Настроено')}</span>
                            </div>
                            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Email и push-уведомления для всех пользователей
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Automation;
