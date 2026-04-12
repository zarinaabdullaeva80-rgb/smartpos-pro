import React, { useState, useEffect } from 'react';
import { Users2, Phone, Mail, TrendingUp, DollarSign, Target } from 'lucide-react';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import { crmAPI } from '../services/api';
import ExportButton from '../components/ExportButton';
import { useI18n } from '../i18n';

const CRM = () => {
    const { t } = useI18n();
    const [leads, setLeads] = useState([]);
    const [pipeline, setPipeline] = useState({});
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        loadLeads();
        loadPipeline();
    }, [filterStatus]);

    const loadLeads = async () => {
        setLoading(true);
        try {
            const params = filterStatus ? { status: filterStatus } : {};
            const response = await crmAPI.getCustomers(params);
            setLeads(response.data?.customers || response.data?.leads || []);
        } catch (error) {
            console.error('Ошибка загрузки лидов:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadPipeline = async () => {
        try {
            const response = await crmAPI.getSalesPipeline();
            setPipeline(response.data?.pipeline || response.data || {});
        } catch (error) {
            console.error('Ошибка загрузки воронки:', error);
        }
    };

    const formatCurrency = (value) => {
        return formatCurrencyUZS(value);
    };

    const getStatusLabel = (status) => {
        const labels = {
            new: 'Новый',
            contacted: 'Контакт установлен',
            qualified: 'Квалифицирован',
            proposal: 'Коммерческое',
            won: 'Выигран',
            lost: 'Проигран'
        };
        return labels[status] || status;
    };

    const getStatusColor = (status) => {
        const colors = {
            new: 'badge-primary',
            contacted: 'badge-info',
            qualified: 'badge-warning',
            proposal: 'badge-purple',
            won: 'badge-success',
            lost: 'badge-danger'
        };
        return colors[status] || 'badge-secondary';
    };

    const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users2 className="page-icon" />
                        CRM - Управление продажами
                    </h1>
                    <p className="page-subtitle">{t('crm.voronka_prodazh_i_rabota_s_lidami', 'Воронка продаж и работа с лидами')}</p>
                </div>
                <ExportButton
                    data={leads}
                    filename="Лиды_CRM"
                    sheetName="Лиды"
                    columns={{
                        name: 'Имя',
                        company: 'Компания',
                        email: 'Email',
                        phone: 'Телефон',
                        status: 'Статус',
                        value: 'Потенциал',
                        assigned_user_name: 'Ответственный'
                    }}
                />
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('crm.vsego_lidov', 'Всего лидов')}</span>
                        <Target className="stat-icon text-blue-500" size={24} />
                    </div>
                    <div className="stat-value">{leads.length}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('crm.potentsial', 'Потенциал')}</span>
                        <DollarSign className="stat-icon text-green-500" size={24} />
                    </div>
                    <div className="stat-value text-lg">{formatCurrency(totalValue)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">{t('crm.vyigrano', 'Выиграно')}</span>
                        <TrendingUp className="stat-icon text-purple-500" size={24} />
                    </div>
                    <div className="stat-value">{pipeline.won?.count || 0}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(pipeline.won?.value || 0)}</div>
                </div>

                <div className="stat-card glass">
                    <div className="stat-header">
                        <span className="stat-label">Conversion Rate</span>
                        <Target className="stat-icon text-orange-500" size={24} />
                    </div>
                    <div className="stat-value">
                        {pipeline.won && pipeline.lost
                            ? Math.round((pipeline.won.count / (pipeline.won.count + pipeline.lost.count)) * 100)
                            : 0}%
                    </div>
                </div>
            </div>

            {/* Воронка продаж */}
            <div className="content-section">
                <h2 className="section-title">{t('crm.voronka_prodazh', 'Воронка продаж')}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                    {Object.entries(pipeline).map(([status, data]) => (
                        <div key={status} className="card glass cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => setFilterStatus(status)}>
                            <div className="text-center">
                                <div className={`badge ${getStatusColor(status)} mb-2`}>
                                    {getStatusLabel(status)}
                                </div>
                                <div className="text-2xl font-bold">{data.count}</div>
                                <div className="text-sm text-gray-500">{formatCurrency(data.value)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Список лидов */}
            <div className="content-section">
                <div className="section-header">
                    <h2 className="section-title">{t('crm.lidy', 'Лиды')}</h2>
                    <div className="flex gap-2">
                        <select
                            className="input"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">{t('crm.vse_statusy', 'Все статусы')}</option>
                            <option value="new">{t('crm.novye', 'Новые')}</option>
                            <option value="contacted">{t('crm.kontakt_ustanovlen', 'Контакт установлен')}</option>
                            <option value="qualified">{t('crm.kvalifitsirovany', 'Квалифицированы')}</option>
                            <option value="proposal">{t('crm.kommercheskoe', 'Коммерческое')}</option>
                            <option value="won">{t('crm.vyigrany', 'Выиграны')}</option>
                            <option value="lost">{t('crm.proigrany', 'Проиграны')}</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {leads.map(lead => (
                        <div key={lead.id} className="card glass">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-semibold text-lg">{lead.name}</h3>
                                    <p className="text-sm text-gray-500">{lead.company}</p>
                                </div>
                                <span className={`badge ${getStatusColor(lead.status)}`}>
                                    {getStatusLabel(lead.status)}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                {lead.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Mail size={16} className="text-gray-400" />
                                        <span>{lead.email}</span>
                                    </div>
                                )}
                                {lead.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone size={16} className="text-gray-400" />
                                        <span>{lead.phone}</span>
                                    </div>
                                )}
                                {lead.value && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <DollarSign size={16} className="text-gray-400" />
                                        <span className="font-semibold text-green-600">{formatCurrency(lead.value)}</span>
                                    </div>
                                )}
                            </div>

                            {lead.notes && (
                                <div className="text-sm text-gray-600 border-t pt-2">
                                    {lead.notes}
                                </div>
                            )}

                            <div className="text-xs text-gray-400 mt-2">
                                Ответственный: {lead.assigned_user_name || 'Не назначен'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CRM;
