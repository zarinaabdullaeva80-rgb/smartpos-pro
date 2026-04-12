import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { configurationsAPI } from '../services/api';
import '../styles/ConfigurationSelector.css';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function ConfigurationSelector() {
    const { t } = useI18n();
    const toast = useToast();
    const navigate = useNavigate();
    const [configurations, setConfigurations] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadConfigurations();
    }, []);

    const loadConfigurations = async () => {
        try {
            setLoading(true);
            const response = await configurationsAPI.getByCategory();
            setConfigurations(response.data);
        } catch (error) {
            console.error('Error loading configurations:', error);
            toast.error('Ошибка при загрузке конфигураций');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectConfiguration = async (configId) => {
        try {
            await configurationsAPI.selectConfiguration(configId);
            navigate('/');
        } catch (error) {
            console.error('Error selecting configuration:', error);
            toast.error('Ошибка при выборе конфигурации');
        }
    };

    const getCategoryIcon = (category) => {
        const icons = {
            'Бухгалтерия и финансы': '📊',
            'Зарплата и кадры': '👥',
            'Торговля и розница': '🛒',
            'ERP и производство': '⚙️',
            'Документооборот': '📄',
            'Управление данными': '💾'
        };
        return icons[category] || '📦';
    };

    const filteredConfigurations = () => {
        if (!searchTerm) return configurations;

        const filtered = {};
        Object.entries(configurations).forEach(([category, configs]) => {
            const matchedConfigs = configs.filter(config =>
                config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                config.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (matchedConfigs.length > 0) {
                filtered[category] = matchedConfigs;
            }
        });
        return filtered;
    };

    if (loading) {
        return (
            <div className="config-selector-loading">
                <div className="spinner"></div>
                <p>{t('configurationselector.zagruzka_konfiguratsiy', 'Загрузка конфигураций...')}</p>
            </div>
        );
    }

    const displayConfigs = filteredConfigurations();

    return (
        <div className="config-selector">
            <div className="config-selector-header">
                <div className="logo-section">
                    <div className="logo-icon-large">{t('configurationselector.s', '1С')}</div>
                    <h1>{t('configurationselector.vyberite_konfiguratsiyu_s', 'Выберите конфигурацию 1С')}</h1>
                    <p className="subtitle">{t('configurationselector.vyberite_podhodyaschuyu_konfiguratsiyu_dlya_vash', 'Выберите подходящую конфигурацию для вашего бизнеса')}</p>
                </div>

                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Поиск конфигурации..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="config-categories">
                {Object.entries(displayConfigs).map(([category, configs]) => (
                    <div key={category} className="config-category">
                        <div className="category-header">
                            <span className="category-icon">{getCategoryIcon(category)}</span>
                            <h2>{category}</h2>
                            <span className="category-count">{configs.length}</span>
                        </div>

                        <div className="config-grid">
                            {configs.map((config) => (
                                <div
                                    key={config.id}
                                    className={`config-card ${selectedConfig === config.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedConfig(config.id)}
                                >
                                    <div className="config-card-icon">{config.icon}</div>
                                    <h3 className="config-card-title">{config.name}</h3>
                                    <p className="config-card-description">{config.description}</p>
                                    <div className="config-card-footer">
                                        <span className="modules-count">
                                            {config.modules_count} модулей
                                        </span>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-select"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectConfiguration(config.id);
                                        }}
                                    >
                                        Выбрать
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {Object.keys(displayConfigs).length === 0 && (
                <div className="no-results">
                    <p>{t('configurationselector.konfiguratsii_ne_naydeny', 'Конфигурации не найдены')}</p>
                    <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>
                        Сбросить поиск
                    </button>
                </div>
            )}
        </div>
    );
}

export default ConfigurationSelector;
