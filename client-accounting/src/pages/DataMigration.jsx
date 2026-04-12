import React from 'react';
import { Database, FileSpreadsheet, RefreshCcw, Trash2 } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DataMigration() {
    const { t } = useI18n();
    const toast = useToast();
    const migrationTypes = [
        {
            title: 'Перенос из старых версий',
            icon: <RefreshCcw size={32} />,
            color: '#3b82f6',
            description: 'Миграция из предыдущих версий 1С',
            features: [
                'Перенос из 1С:УПП',
                'Обновление с 1С 7.7',
                'Миграция с Управление Производственным Предприятием',
                'Конвертация данных старых конфигураций',
                'Сохранение истории'
            ]
        },
        {
            title: 'Перенос из Excel',
            icon: <FileSpreadsheet size={32} />,
            color: '#10b981',
            description: 'Импорт данных из таблиц Excel',
            features: [
                'Загрузка номенклатуры',
                'Импорт контрагентов',
                'Загрузка остатков',
                'Импорт цен',
                'Массовая загрузка документов'
            ]
        },
        {
            title: 'Перенос из других систем',
            icon: <Database size={32} />,
            color: '#f59e0b',
            description: 'Интеграция с внешними базами данных',
            features: [
                'SQL Server',
                '  Oracle',
                'PostgreSQL',
                'MySQL',
                'Пользовательские системы'
            ]
        },
        {
            title: 'Очистка и нормализация',
            icon: <Trash2 size={32} />,
            color: '#ef4444',
            description: 'Подготовка данных для переноса',
            features: [
                'Удаление дублей',
                'Проверка корректности',
                'Нормализация справочников',
                'Очистка устаревших данных',
                'Валидация перед загрузкой'
            ]
        }
    ];

    return (
        <div className="migration-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('datamigration.perenos_i_migratsiya_dannyh', 'Перенос и миграция данных')}</h1>
                    <p className="text-muted">{t('datamigration.import_i_perenos_dannyh_iz_razlichnyh_ist', 'Импорт и перенос данных из различных источников')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.info('Запуск миграции...')}>
                    <Database size={20} />
                    Запустить миграцию
                </button>
            </div>

            {/* Migration Stats */}
            <div className="grid grid-4 mb-3">
                <div className="card">
                    <div className="stat-label">{t('datamigration.vsego_zapisey', 'Всего записей')}</div>
                    <div className="stat-value">45,231</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('datamigration.uspeshno_pereneseno', 'Успешно перенесено')}</div>
                    <div className="stat-value text-success">45,125</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('datamigration.oshibok', 'Ошибок')}</div>
                    <div className="stat-value text-danger">106</div>
                </div>
                <div className="card">
                    <div className="stat-label">{t('datamigration.uspeshnost', 'Успешность')}</div>
                    <div className="stat-value text-success">99.8%</div>
                </div>
            </div>

            {/* Migration Types */}
            <div className="grid grid-2">
                {migrationTypes.map((type, index) => (
                    <div key={index} className="card">
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '20px',
                            background: `${type.color}15`,
                            borderRadius: '10px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                background: type.color,
                                color: 'white',
                                padding: '15px',
                                borderRadius: '10px'
                            }}>
                                {type.icon}
                            </div>
                            <div>
                                <h2 style={{ margin: 0, marginBottom: '5px' }}>{type.title}</h2>
                                <div className="text-muted" style={{ fontSize: '0.9rem' }}>{type.description}</div>
                            </div>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {type.features.map((feature, fIndex) => (
                                <li key={fIndex} style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: 'var(--surface-color)',
                                    borderRadius: '6px',
                                    borderLeft: `3px solid ${type.color}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: type.color,
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        flexShrink: 0
                                    }}>
                                        {fIndex + 1}
                                    </div>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            className="btn btn-secondary"
                            style={{ marginTop: '15px', width: '100%' }}
                            onClick={() => toast.info('Настройка миграции...')}
                        >
                            Настроить миграцию
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DataMigration;
