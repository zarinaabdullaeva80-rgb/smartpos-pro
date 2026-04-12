import React from 'react';
import { Globe, ShoppingCart, CreditCard, Smartphone, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useI18n } from '../i18n';

function Integrations() {
    const { t } = useI18n();
    const integrations = [
        {
            category: 'Интеграция с сайтом',
            icon: <Globe size={24} />,
            color: '#3b82f6',
            items: [
                'Синхронизация товаров и цен',
                'Обмен заказами',
                'Обновление остатков',
                'Выгрузка прайс-листов',
                'API для сайта'
            ]
        },
        {
            category: 'Интеграция с интернет-магазином',
            icon: <ShoppingCart size={24} />,
            color: '#10b981',
            items: [
                'WooCommerce',
                'Shopify',
                'Битрикс24',
                '1С-Битрикс: Управление сайтом',
                'OpenCart'
            ]
        },
        {
            category: 'Интеграция с банками',
            icon: <CreditCard size={24} />,
            color: '#f59e0b',
            items: [
                'Банк-клиент',
                'Выгрузка платёжных поручений',
                'Загрузка выписок',
                'Электронная подпись',
                'Сверка платежей'
            ]
        },
        {
            category: 'Интеграция с кассами и терминалами',
            icon: <Smartphone size={24} />,
            color: '#ef4444',
            items: [
                'Онлайн-кассы (54-ФЗ)',
                'Эквайринг',
                'Терминалы сбора данных',
                'Весы и сканеры',
                'Печать этикеток'
            ]
        },
        {
            category: 'Интеграция с CRM',
            icon: <LinkIcon size={24} />,
            color: '#8b5cf6',
            items: [
                'amoCRM',
                'Битрикс24 CRM',
                'Microsoft Dynamics',
                'Мегаплан',
                'Salesforce'
            ]
        },
        {
            category: 'Обмен между базами программ',
            icon: <RefreshCw size={24} />,
            color: '#ec4899',
            items: [
                'Обмен с филиалами',
                'Распределённые базы',
                'Репликация данных',
                'Синхронизация номенклатуры',
                'Обмен документами'
            ]
        }
    ];

    return (
        <div className="integrations-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('integrations.integratsii', 'Интеграции')}</h1>
                    <p className="text-muted">{t('integrations.podklyuchenie_vneshnih_sistem_i_servisov', 'Подключение внешних систем и сервисов')}</p>
                </div>
            </div>

            <div className="grid grid-2">
                {integrations.map((integration, index) => (
                    <div key={index} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            <div style={{
                                background: integration.color,
                                color: 'white',
                                padding: '15px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {integration.icon}
                            </div>
                            <h2 style={{ margin: 0 }}>{integration.category}</h2>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {integration.items.map((item, itemIndex) => (
                                <li key={itemIndex} style={{
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: 'var(--surface-color)',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <span>{item}</span>
                                    <span className="badge badge-success">{t('integrations.dostupno', 'Доступно')}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Integrations;
