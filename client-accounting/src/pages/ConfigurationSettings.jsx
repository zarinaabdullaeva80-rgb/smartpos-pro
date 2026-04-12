import React, { useState } from 'react';
import { Settings, DollarSign, Users, Box, Lock, FileText, Check } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function Configuration() {
    const { t } = useI18n();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('accounting');

    const configSections = {
        accounting: {
            title: 'Настройка учёта',
            icon: <DollarSign size={20} />,
            items: [
                { name: 'НДС (Налог на добавленную стоимость)', status: 'active' },
                { name: 'УСН (Упрощённая система налогообложения)', status: 'active' },
                { name: 'ОСНО (Общая система налогообложения)', status: 'active' },
                { name: 'Учётная политика', status: 'active' },
                { name: 'План счетов', status: 'active' }
            ]
        },
        payroll: {
            title: 'Настройка зарплаты и кадров',
            icon: <Users size={20} />,
            items: [
                { name: 'Начисления и удержания', status: 'active' },
                { name: 'Налоги и взносы', status: 'active' },
                { name: 'Табели учёта рабочего времени', status: 'active' },
                { name: 'Кадровый учёт', status: 'active' },
                { name: 'Отпуска и больничные', status: 'active' }
            ]
        },
        warehouse: {
            title: 'Настройка складов и торговли',
            icon: <Box size={20} />,
            items: [
                { name: 'Склады и номенклатура', status: 'active' },
                { name: 'Цены и скидки', status: 'active' },
                { name: 'Движение товаров', status: 'active' },
                { name: 'Инвентаризация', status: 'active' },
                { name: 'Резервирование товаров', status: 'active' }
            ]
        },
        access: {
            title: 'Настройка прав доступа',
            icon: <Lock size={20} />,
            items: [
                { name: 'Роли пользователей', status: 'active' },
                { name: 'Профили доступа', status: 'active' },
                { name: 'Ограничения по документам', status: 'active' },
                { name: 'Ограничения по данным', status: 'active' },
                { name: 'Аудит действий пользователей', status: 'active' }
            ]
        },
        reports: {
            title: 'Настройка отчётов',
            icon: <FileText size={20} />,
            items: [
                { name: 'Стандартные отчёты', status: 'active' },
                { name: 'Управленческие отчёты', status: 'active' },
                { name: 'Налоговые отчёты', status: 'active' },
                { name: 'Пользовательские настройки отчётов', status: 'active' },
                { name: 'Автоматическая рассылка отчётов', status: 'active' }
            ]
        }
    };

    return (
        <div className="configuration-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('configurationsettings.nastroyka_s', 'Настройка 1С')}</h1>
                    <p className="text-muted">{t('configurationsettings.kompleksnaya_nastroyka_sistemy_uchyota', 'Комплексная настройка системы учёта')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="card mb-3">
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {Object.entries(configSections).map(([key, section]) => (
                        <button
                            key={key}
                            className={`btn ${activeTab === key ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab(key)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {section.icon}
                            <span>{section.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    {configSections[activeTab].icon}
                    <h2>{configSections[activeTab].title}</h2>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>{t('configurationsettings.parametr_nastroyki', 'Параметр настройки')}</th>
                            <th>{t('configurationsettings.status', 'Статус')}</th>
                            <th>{t('configurationsettings.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {configSections[activeTab].items.map((item, index) => (
                            <tr key={index}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                                        <strong>{item.name}</strong>
                                    </div>
                                </td>
                                <td>
                                    <span className="badge badge-success">
                                        <Check size={14} style={{ marginRight: '5px' }} />
                                        {t('configurationsettings.nastroeno', 'Настроено')}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => toast.info(`Настройка: ${item.name}`)}>
                                            Настроить
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => toast.info(`Подробнее: ${item.name}`)}>
                                            Подробнее
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-3" style={{ marginTop: '20px' }}>
                <div className="card">
                    <h3 className="text-muted mb-2">{t('configurationsettings.vsego_parametrov', 'Всего параметров')}</h3>
                    <div className="stat-value">{Object.values(configSections).reduce((sum, section) => sum + section.items.length, 0)}</div>
                </div>
                <div className="card">
                    <h3 className="text-muted mb-2">{t('configurationsettings.nastroeno', 'Настроено')}</h3>
                    <div className="stat-value text-success">{Object.values(configSections).reduce((sum, section) => sum + section.items.length, 0)}</div>
                </div>
                <div className="card">
                    <h3 className="text-muted mb-2">{t('configurationsettings.trebuet_vnimaniya', 'Требует внимания')}</h3>
                    <div className="stat-value text-warning">0</div>
                </div>
            </div>
        </div>
    );
}

export default Configuration;
