import React, { useState, useEffect } from 'react';
import { Code, FileText, Database, Cpu, Zap, Bug, Play, CheckCircle, AlertTriangle, Loader, RefreshCw, Trash2, Search, Clock, AlertCircle as AlertCircleIcon, Plus, Settings, FileCode, Table, Layers, FolderTree, Edit3, Download, Upload } from 'lucide-react';
import api from '../services/api';

import { useConfirm } from '../components/ConfirmDialog';
import { useI18n } from '../i18n';
function Development() {
    const { t } = useI18n();
    const confirm = useConfirm();
    const [activeCategory, setActiveCategory] = useState('improvements');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [errorLogs, setErrorLogs] = useState([]);
    const [dbStats, setDbStats] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [settingsModal, setSettingsModal] = useState(null);
    const [documentModal, setDocumentModal] = useState(null);
    const [mechanisms, setMechanisms] = useState({
        pricing: true,
        discounts: true,
        attributes: false,
        print_forms: true,
        approval_routes: false
    });

    const categories = {
        documents: {
            title: 'Создание новых документов',
            icon: <FileText size={24} />,
            description: 'Разработка пользовательских документов для специфичных бизнес-процессов',
            hasCustomContent: true
        },
        directories: {
            title: 'Создание справочников',
            icon: <Database size={24} />,
            description: 'Настройка пользовательских справочников и классификаторов',
            hasCustomContent: true
        },
        registers: {
            title: 'Создание регистров',
            icon: <Cpu size={24} />,
            description: 'Создание регистров накопления и сведений',
            hasCustomContent: true
        },
        improvements: {
            title: 'Доработка механизмов',
            icon: <Code size={24} />,
            description: 'Модификация типовых механизмов под задачи бизнеса',
            hasCustomContent: true
        },
        optimization: {
            title: 'Оптимизация',
            icon: <Zap size={24} />,
            description: 'Повышение производительности системы',
            hasCustomContent: true
        },
        bugfixes: {
            title: 'Исправление ошибок',
            icon: <Bug size={24} />,
            description: 'Устранение ошибок в работе системы',
            hasCustomContent: true
        }
    };

    // Шаблоны документов
    const documentTemplates = [
        { id: 'service_sale', name: 'Продажа услуг', desc: 'Документ для оформления продажи услуг', icon: <FileText size={20} />, status: 'ready' },
        { id: 'work_act', name: 'Акт выполненных работ', desc: 'Формирование актов для клиентов', icon: <FileCode size={20} />, status: 'ready' },
        { id: 'purchase_request', name: 'Заявка на закупку', desc: 'Внутренние заявки на закупку товаров', icon: <Download size={20} />, status: 'beta' },
        { id: 'internal_order', name: 'Внутренний заказ', desc: 'Заказы между подразделениями', icon: <Layers size={20} />, status: 'new' },
        { id: 'approval', name: 'Согласование документов', desc: 'Маршруты согласования', icon: <CheckCircle size={20} />, status: 'new' }
    ];

    // Шаблоны справочников
    const directoryTemplates = [
        { id: 'projects', name: 'Проекты и подразделения', desc: 'Иерархический справочник проектов', icon: <FolderTree size={20} />, status: 'ready' },
        { id: 'product_types', name: 'Виды номенклатуры', desc: 'Классификация товаров и услуг', icon: <Layers size={20} />, status: 'ready' },
        { id: 'client_categories', name: 'Категории клиентов', desc: 'Сегментация клиентской базы', icon: <Database size={20} />, status: 'ready' },
        { id: 'bonus_programs', name: 'Бонусные программы', desc: 'Настройка программ лояльности', icon: <Settings size={20} />, status: 'beta' },
        { id: 'classifiers', name: 'Классификаторы товаров', desc: 'ТН ВЭД, ОКПД и другие', icon: <Table size={20} />, status: 'new' }
    ];

    // Шаблоны регистров
    const registerTemplates = [
        { id: 'balance', name: 'Регистры остатков', desc: 'Учёт текущих остатков', icon: <Database size={20} />, status: 'ready', count: 12 },
        { id: 'turnover', name: 'Регистры оборотов', desc: 'Накопление оборотов за период', icon: <RefreshCw size={20} />, status: 'ready', count: 8 },
        { id: 'info', name: 'Регистры сведений', desc: 'Хранение периодических данных', icon: <FileText size={20} />, status: 'ready', count: 24 },
        { id: 'calculation', name: 'Регистры расчётов', desc: 'Взаиморасчёты с контрагентами', icon: <Cpu size={20} />, status: 'beta', count: 4 },
        { id: 'accounting', name: 'Регистры бухгалтерии', desc: 'Проводки и обороты по счетам', icon: <Table size={20} />, status: 'new', count: 0 }
    ];

    // Шаблоны доработок
    const improvementTemplates = [
        { id: 'pricing', name: 'Расширенное ценообразование', desc: 'Гибкие схемы ценообразования', icon: <Settings size={20} />, active: true },
        { id: 'discounts', name: 'Автоматические скидки', desc: 'Правила автоматических скидок', icon: <Zap size={20} />, active: true },
        { id: 'attributes', name: 'Дополнительные реквизиты', desc: 'Расширение карточек объектов', icon: <Edit3 size={20} />, active: false },
        { id: 'print_forms', name: 'Печатные формы', desc: 'Шаблоны документов для печати', icon: <FileText size={20} />, active: true },
        { id: 'approval_routes', name: 'Маршруты согласования', desc: 'Настройка бизнес-процессов', icon: <Layers size={20} />, active: false }
    ];

    // Загрузить статистику БД
    const loadDbStats = async () => {
        try {
            const response = await api.get('/database/stats');
            setDbStats(response.data);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    };

    // Загрузить логи ошибок  
    const loadErrorLogs = async () => {
        try {
            const response = await api.get('/errors/recent?limit=20');
            setErrorLogs(response.data?.errors || []);
        } catch (error) {
            console.error('Ошибка загрузки логов:', error);
            setErrorLogs([]);
        }
    };

    useEffect(() => {
        if (activeCategory === 'bugfixes') {
            loadErrorLogs();
        } else if (activeCategory === 'optimization') {
            loadDbStats();
        }
    }, [activeCategory]);

    // Функции оптимизации
    const runOptimization = async (type) => {
        setLoading(true);
        setResult(null);
        try {
            const response = await api.post('/database/optimize', { type });
            setResult({ success: true, message: response.data.message || 'Готово!' });
            if (type !== 'clear_cache') loadDbStats();
        } catch (error) {
            setResult({ success: false, message: error.response?.data?.error || error.message });
        } finally {
            setLoading(false);
        }
    };

    const cleanupOldData = async (days = 90) => {
        if (!(await confirm({ variant: 'danger', message: `Удалить данные старше ${days} дней? Это действие необратимо!` }))) return;
        setLoading(true);
        try {
            const response = await api.post('/database/cleanup', { older_than_days: days });
            setResult({ success: true, message: response.data.message });
        } catch (error) {
            setResult({ success: false, message: error.response?.data?.error || error.message });
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            ready: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', text: 'Готово' },
            beta: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', text: 'Бета' },
            new: { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', text: 'Новое' }
        };
        const s = styles[status] || styles.new;
        return (
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', backgroundColor: s.bg, color: s.color }}>
                {s.text}
            </span>
        );
    };

    // Рендер секции документов
    const renderDocuments = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('development.shablony_dokumentov', 'Шаблоны документов')}</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setDocumentModal({ mode: 'create', type: 'document' })}>
                    <Plus size={16} /> Создать документ
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {documentTemplates.map(template => (
                    <div key={template.id} style={{
                        padding: '1rem',
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: selectedTemplate === template.id ? '2px solid var(--color-primary)' : '1px solid transparent',
                        transition: 'all 0.2s'
                    }} onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ color: 'var(--color-primary)' }}>{template.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{template.name}</div>
                            </div>
                            {getStatusBadge(template.status)}
                        </div>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{template.desc}</p>
                    </div>
                ))}
            </div>
            {selectedTemplate && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={18} color="var(--color-primary)" />
                        <span>{t('development.vybran_shablon', 'Выбран шаблон:')} <strong>{documentTemplates.find(t => t.id === selectedTemplate)?.name}</strong></span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => setDocumentModal({ mode: 'edit', template: documentTemplates.find(t => t.id === selectedTemplate) })}>
                                <Edit3 size={14} /> {t('development.redaktirovat', 'Редактировать')}
                            </button>
                            <button className="btn btn-sm btn-primary" onClick={() => setDocumentModal({ mode: 'config', template: documentTemplates.find(t => t.id === selectedTemplate) })}>
                                <Settings size={14} /> Настроить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Modal */}
            {documentModal && (
                <div className="modal-overlay" onClick={() => setDocumentModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {documentModal.mode === 'create' ? '📄 Создание документа' :
                                    documentModal.mode === 'edit' ? `✏️ ${documentModal.template?.name}` :
                                        `⚙️ Настройка: ${documentModal.template?.name}`}
                            </h2>
                            <button className="modal-close" onClick={() => setDocumentModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {documentModal.mode === 'create' && (
                                <>
                                    <div className="form-group">
                                        <label>{t('development.nazvanie_dokumenta', 'Название документа *')}</label>
                                        <input type="text" className="form-input" placeholder="Например: Акт сверки" />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.tip_dokumenta', 'Тип документа')}</label>
                                        <select className="form-input">
                                            <option>{t('development.pervichnyy_dokument', 'Первичный документ')}</option>
                                            <option>{t('development.vnutrenniy_dokument', 'Внутренний документ')}</option>
                                            <option>{t('development.otchyotnyy_dokument', 'Отчётный документ')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.opisanie', 'Описание')}</label>
                                        <textarea className="form-input" rows={3} placeholder="Описание назначения документа..." />
                                    </div>
                                </>
                            )}
                            {documentModal.mode === 'config' && (
                                <>
                                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                                        {documentModal.template?.desc}
                                    </p>
                                    <div className="form-group">
                                        <label>{t('development.numeratsiya', 'Нумерация')}</label>
                                        <select className="form-input">
                                            <option>{t('development.avtomaticheskaya', 'Автоматическая')}</option>
                                            <option>{t('development.ruchnaya', 'Ручная')}</option>
                                            <option>{t('development.po_podrazdeleniyam', 'По подразделениям')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.pechatnaya_forma', 'Печатная форма')}</label>
                                        <select className="form-input">
                                            <option>{t('development.standartnaya', 'Стандартная')}</option>
                                            <option>{t('development.rasshirennaya', 'Расширенная')}</option>
                                            <option>{t('development.kratkaya', 'Краткая')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input type="checkbox" defaultChecked /> Требовать подпись
                                        </label>
                                    </div>
                                </>
                            )}
                            {documentModal.mode === 'edit' && (
                                <>
                                    <div className="form-group">
                                        <label>{t('development.nazvanie', 'Название')}</label>
                                        <input type="text" className="form-input" defaultValue={documentModal.template?.name} />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.opisanie', 'Описание')}</label>
                                        <textarea className="form-input" rows={3} defaultValue={documentModal.template?.desc} />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDocumentModal(null)}>{t('development.otmena', 'Отмена')}</button>
                            <button className="btn btn-primary" onClick={() => {
                                setResult({ success: true, message: documentModal.mode === 'create' ? 'Документ создан' : 'Изменения сохранены' });
                                setDocumentModal(null);
                                setTimeout(() => setResult(null), 3000);
                            }}>
                                {documentModal.mode === 'create' ? 'Создать' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Рендер секции справочников
    const [directoryModal, setDirectoryModal] = useState(null);
    const [selectedDirectory, setSelectedDirectory] = useState(null);

    const renderDirectories = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('development.spravochniki_sistemy', 'Справочники системы')}</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setDirectoryModal({ mode: 'create' })}>
                    <Plus size={16} /> Новый справочник
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {directoryTemplates.map(template => (
                    <div
                        key={template.id}
                        style={{
                            padding: '1rem',
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            border: selectedDirectory === template.id ? '2px solid var(--color-primary)' : '1px solid transparent',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => setSelectedDirectory(selectedDirectory === template.id ? null : template.id)}
                    >
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', color: 'var(--color-primary)' }}>
                            {template.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{template.name}</div>
                            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{template.desc}</p>
                        </div>
                        {getStatusBadge(template.status)}
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => { e.stopPropagation(); setDirectoryModal({ mode: 'view', template }); }}
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Directory Modal */}
            {directoryModal && (
                <div className="modal-overlay" onClick={() => setDirectoryModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {directoryModal.mode === 'create' ? '📚 Новый справочник' : `⚙️ ${directoryModal.template?.name}`}
                            </h2>
                            <button className="modal-close" onClick={() => setDirectoryModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {directoryModal.mode === 'create' ? (
                                <>
                                    <div className="form-group">
                                        <label>{t('development.nazvanie_spravochnika', 'Название справочника *')}</label>
                                        <input type="text" className="form-input" placeholder="Например: Склады" />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.tip_spravochnika', 'Тип справочника')}</label>
                                        <select className="form-input">
                                            <option>{t('development.prostoy_lineynyy', 'Простой (линейный)')}</option>
                                            <option>{t('development.ierarhicheskiy', 'Иерархический')}</option>
                                            <option>{t('development.s_podchineniem', 'С подчинением')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.osnovnye_rekvizity', 'Основные реквизиты')}</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {['Код', 'Наименование', 'Описание', 'Активность'].map(attr => (
                                                <label key={attr} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                                                    <input type="checkbox" defaultChecked={attr !== 'Описание'} /> {attr}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{directoryModal.template?.desc}</p>
                                    <div className="form-group">
                                        <label>{t('development.kolichestvo_elementov', 'Количество элементов')}</label>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                                            {Math.floor(Math.random() * 500) + 50}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.deystviya', 'Действия')}</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button className="btn btn-sm btn-secondary"><Download size={14} /> {t('development.eksport', 'Экспорт')}</button>
                                            <button className="btn btn-sm btn-secondary"><Upload size={14} /> {t('development.import', 'Импорт')}</button>
                                            <button className="btn btn-sm btn-secondary"><Edit3 size={14} /> {t('development.redaktirovat', 'Редактировать')}</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDirectoryModal(null)}>{t('development.zakryt', 'Закрыть')}</button>
                            {directoryModal.mode === 'create' && (
                                <button className="btn btn-primary" onClick={() => {
                                    setResult({ success: true, message: 'Справочник создан' });
                                    setDirectoryModal(null);
                                    setTimeout(() => setResult(null), 3000);
                                }}>{t('development.sozdat', 'Создать')}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Рендер секции регистров
    const [registerModal, setRegisterModal] = useState(null);
    const [selectedRegister, setSelectedRegister] = useState(null);

    const renderRegisters = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('development.registry_dannyh', 'Регистры данных')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Всего: {registerTemplates.reduce((sum, r) => sum + r.count, 0)} регистров
                    </span>
                    <button className="btn btn-primary btn-sm" onClick={() => setRegisterModal({ mode: 'create' })}>
                        <Plus size={16} /> Новый регистр
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {registerTemplates.map(template => (
                    <div
                        key={template.id}
                        style={{
                            padding: '1rem',
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            border: selectedRegister === template.id ? '2px solid var(--color-primary)' : '1px solid transparent',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => setSelectedRegister(selectedRegister === template.id ? null : template.id)}
                    >
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', color: 'var(--color-success)' }}>
                            {template.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{template.name}</div>
                            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{template.desc}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-primary)' }}>{template.count}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('development.registrov', 'регистров')}</div>
                        </div>
                        {getStatusBadge(template.status)}
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => { e.stopPropagation(); setRegisterModal({ mode: 'view', template }); }}
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Register Modal */}
            {registerModal && (
                <div className="modal-overlay" onClick={() => setRegisterModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {registerModal.mode === 'create' ? '📊 Новый регистр' : `⚙️ ${registerModal.template?.name}`}
                            </h2>
                            <button className="modal-close" onClick={() => setRegisterModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {registerModal.mode === 'create' ? (
                                <>
                                    <div className="form-group">
                                        <label>{t('development.nazvanie_registra', 'Название регистра *')}</label>
                                        <input type="text" className="form-input" placeholder="Например: Остатки на складах" />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.tip_registra', 'Тип регистра')}</label>
                                        <select className="form-input">
                                            <option>{t('development.registr_nakopleniya_ostatki', 'Регистр накопления (остатки)')}</option>
                                            <option>{t('development.registr_nakopleniya_oboroty', 'Регистр накопления (обороты)')}</option>
                                            <option>{t('development.registr_svedeniy', 'Регистр сведений')}</option>
                                            <option>{t('development.registr_buhgalterii', 'Регистр бухгалтерии')}</option>
                                            <option>{t('development.registr_raschyota', 'Регистр расчёта')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.izmereniya', 'Измерения')}</label>
                                        <input type="text" className="form-input" placeholder="Склад, Номенклатура, Партия" />
                                    </div>
                                    <div className="form-group">
                                        <label>{t('development.resursy', 'Ресурсы')}</label>
                                        <input type="text" className="form-input" placeholder="Количество, Сумма" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{registerModal.template?.desc}</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>{registerModal.template?.count}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('development.registrov_v_gruppe', 'Регистров в группе')}</div>
                                        </div>
                                        <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-primary)', borderRadius: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-success)' }}>{Math.floor(Math.random() * 1000000)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('development.zapisey', 'Записей')}</div>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>{t('development.deystviya', 'Действия')}</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                            <button className="btn btn-sm btn-secondary"><Search size={14} /> {t('development.prosmotr', 'Просмотр')}</button>
                                            <button className="btn btn-sm btn-secondary"><RefreshCw size={14} /> {t('development.pereschitat', 'Пересчитать')}</button>
                                            <button className="btn btn-sm btn-warning"><Trash2 size={14} /> {t('development.ochistit', 'Очистить')}</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setRegisterModal(null)}>{t('development.zakryt', 'Закрыть')}</button>
                            {registerModal.mode === 'create' && (
                                <button className="btn btn-primary" onClick={() => {
                                    setResult({ success: true, message: 'Регистр создан' });
                                    setRegisterModal(null);
                                    setTimeout(() => setResult(null), 3000);
                                }}>{t('development.sozdat', 'Создать')}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Рендер секции доработок
    const toggleMechanism = (id) => {
        setMechanisms(prev => ({ ...prev, [id]: !prev[id] }));
        setResult({
            success: true,
            message: `Механизм "${improvementTemplates.find(t => t.id === id)?.name}" ${!mechanisms[id] ? 'активирован' : 'отключен'}`
        });
        setTimeout(() => setResult(null), 3000);
    };

    const openSettings = (template) => {
        setSettingsModal(template);
    };

    const renderImprovements = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('development.mehanizmy_sistemy', 'Механизмы системы')}</h3>
                <span style={{ color: 'var(--color-success)', fontSize: '0.875rem' }}>
                    ✓ {Object.values(mechanisms).filter(Boolean).length} из {improvementTemplates.length} активны
                </span>
            </div>

            {result && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: result.success ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <CheckCircle size={18} /> {result.message}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {improvementTemplates.map(template => {
                    const isActive = mechanisms[template.id];
                    return (
                        <div key={template.id} style={{
                            padding: '1rem',
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            opacity: isActive ? 1 : 0.7,
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{
                                padding: '0.75rem',
                                backgroundColor: isActive ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-bg-primary)',
                                borderRadius: '8px',
                                color: isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
                                transition: 'all 0.3s ease'
                            }}>
                                {template.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{template.name}</div>
                                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{template.desc}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {/* Toggle Switch */}
                                <div
                                    onClick={() => toggleMechanism(template.id)}
                                    style={{
                                        width: '50px',
                                        height: '26px',
                                        borderRadius: '13px',
                                        backgroundColor: isActive ? 'var(--color-success)' : 'rgba(100, 100, 100, 0.3)',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'background-color 0.3s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        backgroundColor: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: isActive ? '26px' : '2px',
                                        transition: 'left 0.3s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => openSettings(template)}
                                    title={t('development.nastroyki', 'Настройки')}
                                >
                                    <Settings size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Settings Modal */}
            {settingsModal && (
                <div className="modal-overlay" onClick={() => setSettingsModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {settingsModal.icon}
                                {settingsModal.name}
                            </h2>
                            <button className="modal-close" onClick={() => setSettingsModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>{settingsModal.desc}</p>

                            <div className="form-group">
                                <label>{t('development.status_mehanizma', 'Статус механизма')}</label>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <button
                                        className={`btn ${mechanisms[settingsModal.id] ? 'btn-success' : 'btn-secondary'}`}
                                        onClick={() => { setMechanisms(prev => ({ ...prev, [settingsModal.id]: true })); }}
                                    >
                                        <CheckCircle size={16} /> Активен
                                    </button>
                                    <button
                                        className={`btn ${!mechanisms[settingsModal.id] ? 'btn-danger' : 'btn-secondary'}`}
                                        onClick={() => { setMechanisms(prev => ({ ...prev, [settingsModal.id]: false })); }}
                                    >
                                        <AlertTriangle size={16} /> Отключен
                                    </button>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>{t('development.prioritet_vypolneniya', 'Приоритет выполнения')}</label>
                                <select className="form-input">
                                    <option>{t('development.vysokiy', 'Высокий')}</option>
                                    <option>{t('development.sredniy', 'Средний')}</option>
                                    <option>{t('development.nizkiy', 'Низкий')}</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label>{t('development.opisanie', 'Описание')}</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    defaultValue={settingsModal.desc}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSettingsModal(null)}>
                                {t('development.otmena', 'Отмена')}
                            </button>
                            <button className="btn btn-primary" onClick={() => {
                                setResult({ success: true, message: `Настройки "${settingsModal.name}" сохранены` });
                                setSettingsModal(null);
                                setTimeout(() => setResult(null), 3000);
                            }}>
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Рендер секции оптимизации
    const renderOptimization = () => (
        <div>
            {/* Статистика БД */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px', textAlign: 'center' }}>
                    <Database size={24} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dbStats?.tables_count || '—'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('development.tablits', 'Таблиц')}</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px', textAlign: 'center' }}>
                    <Cpu size={24} color="var(--color-success)" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dbStats?.total_size || '—'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('development.razmer_bd', 'Размер БД')}</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px', textAlign: 'center' }}>
                    <Zap size={24} color="var(--color-warning)" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dbStats?.indexes_count || '—'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('development.indeksov', 'Индексов')}</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px', textAlign: 'center' }}>
                    <Clock size={24} color="var(--color-info)" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{dbStats?.uptime ? 'OK' : '—'}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('development.aptaym', 'Аптайм')}</div>
                </div>
            </div>

            {/* Результат операции */}
            {result && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    backgroundColor: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: result.success ? 'var(--color-success)' : 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    {result.success ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    {result.message}
                </div>
            )}

            {/* Кнопки оптимизации */}
            <h3 style={{ marginBottom: '1rem' }}>{t('development.deystviya_po_optimizatsii', 'Действия по оптимизации')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={18} /> Анализ запросов
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Найти медленные запросы и предложить индексы
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => runOptimization('analyze')} disabled={loading}>
                        {loading ? <Loader size={16} className="spinning" /> : <Play size={16} />}
                        Запустить анализ
                    </button>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={18} /> Оптимизация индексов
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Перестроить индексы и обновить статистику
                    </p>
                    <button className="btn btn-success btn-sm" onClick={() => runOptimization('reindex')} disabled={loading}>
                        {loading ? <Loader size={16} className="spinning" /> : <RefreshCw size={16} />}
                        Оптимизировать
                    </button>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={18} /> Очистка кэша
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Сбросить кэш запросов и освободить память
                    </p>
                    <button className="btn btn-warning btn-sm" onClick={() => runOptimization('clear_cache')} disabled={loading}>
                        {loading ? <Loader size={16} className="spinning" /> : <Trash2 size={16} />}
                        Очистить кэш
                    </button>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                    <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} /> Удаление старых данных
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Удалить логи, сессии и временные данные
                    </p>
                    <button className="btn btn-danger btn-sm" onClick={() => cleanupOldData(90)} disabled={loading}>
                        {loading ? <Loader size={16} className="spinning" /> : <Trash2 size={16} />}
                        Очистить (90 дней)
                    </button>
                </div>
            </div>
        </div>
    );

    // Рендер секции ошибок
    const renderBugfixes = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>{t('development.poslednie_oshibki_sistemy', 'Последние ошибки системы')}</h3>
                <button className="btn btn-sm btn-secondary" onClick={loadErrorLogs}>
                    <RefreshCw size={16} /> Обновить
                </button>
            </div>

            {errorLogs.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--color-text-muted)'
                }}>
                    <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '1rem' }} />
                    <h3>{t('development.oshibok_ne_obnaruzheno', 'Ошибок не обнаружено!')}</h3>
                    <p>{t('development.sistema_rabotaet_stabilno', 'Система работает стабильно')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {errorLogs.map((log, index) => (
                        <div key={index} style={{
                            padding: '1rem',
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${log.level === 'error' ? 'var(--color-danger)' : 'var(--color-warning)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <AlertCircleIcon size={16} color={log.level === 'error' ? 'var(--color-danger)' : 'var(--color-warning)'} />
                                    {log.source || 'Система'}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                    {new Date(log.created_at).toLocaleString('ru-RU')}
                                </span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                {log.message}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const currentCategory = categories[activeCategory];

    return (
        <div className="development-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('development.dorabotka_i_programmirovanie', 'Доработка и программирование')}</h1>
                    <p className="text-muted">{t('development.kastomizatsiya_i_rasshirenie_funktsionala_s', 'Кастомизация и расширение функционала 1С')}</p>
                </div>
            </div>

            {/* Category Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {Object.entries(categories).map(([key, category]) => (
                    <div
                        key={key}
                        className={`card hoverable ${activeCategory === key ? 'active' : ''}`}
                        onClick={() => { setActiveCategory(key); setSelectedTemplate(null); }}
                        style={{
                            cursor: 'pointer',
                            border: activeCategory === key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            padding: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{
                                background: activeCategory === key ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                color: activeCategory === key ? 'white' : 'var(--color-text)',
                                padding: '12px',
                                borderRadius: '8px'
                            }}>
                                {category.icon}
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{category.title}</h3>
                        </div>
                        <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>{category.description}</p>
                    </div>
                ))}
            </div>

            {/* Detailed View */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                    <div style={{
                        background: 'var(--color-primary)',
                        color: 'white',
                        padding: '15px',
                        borderRadius: '10px'
                    }}>
                        {currentCategory?.icon}
                    </div>
                    <div>
                        <h2 style={{ margin: 0 }}>{currentCategory?.title}</h2>
                        <p className="text-muted" style={{ margin: '5px 0 0 0' }}>{currentCategory?.description}</p>
                    </div>
                </div>

                {/* Контент секции */}
                {activeCategory === 'documents' && renderDocuments()}
                {activeCategory === 'directories' && renderDirectories()}
                {activeCategory === 'registers' && renderRegisters()}
                {activeCategory === 'improvements' && renderImprovements()}
                {activeCategory === 'optimization' && renderOptimization()}
                {activeCategory === 'bugfixes' && renderBugfixes()}
            </div>

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

export default Development;
