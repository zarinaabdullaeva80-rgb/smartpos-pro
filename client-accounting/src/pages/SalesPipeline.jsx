import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, TrendingUp, DollarSign, Users, Settings, X } from 'lucide-react';
import { crmAPI } from '../services/api';
import { formatCurrency as formatCurrencyUZS } from '../utils/formatters';
import { useConfirm } from '../components/ConfirmDialog';
import '../styles/Common.css';
import { useI18n } from '../i18n';

// Базовые этапы по умолчанию
const DEFAULT_STAGES = [
    { id: 1, name: 'Новая заявка', color: '#6366f1', success_probability: 10, is_final: false },
    { id: 2, name: 'Квалификация', color: '#8b5cf6', success_probability: 25, is_final: false },
    { id: 3, name: 'Предложение', color: '#f59e0b', success_probability: 50, is_final: false },
    { id: 4, name: 'Переговоры', color: '#3b82f6', success_probability: 75, is_final: false },
    { id: 5, name: 'Закрыта (успех)', color: '#10b981', success_probability: 100, is_final: true }
];


const SalesPipeline = () => {
    // Загрузка из localStorage или использование по умолчанию
    const { t } = useI18n();
    const confirm = useConfirm();
    const [stages, setStages] = useState(() => {
        const saved = localStorage.getItem('crm_stages');
        return saved ? JSON.parse(saved) : DEFAULT_STAGES;
    });
    const [deals, setDeals] = useState(() => {
        const saved = localStorage.getItem('crm_deals');
        return saved ? JSON.parse(saved) : [];
    });
    const [customers, setCustomers] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showStageModal, setShowStageModal] = useState(false);
    const [draggedDeal, setDraggedDeal] = useState(null);
    const [statusMsg, setStatusMsg] = useState(null);

    // Сохранение в localStorage при изменении
    useEffect(() => {
        localStorage.setItem('crm_stages', JSON.stringify(stages));
    }, [stages]);

    useEffect(() => {
        localStorage.setItem('crm_deals', JSON.stringify(deals));
    }, [deals]);

    useEffect(() => {
        syncWithServer();
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const res = await crmAPI.getCustomers({ limit: 500 });
            setCustomers(res.data?.customers || res.data || []);
        } catch (e) { console.log('Could not load customers'); }
    };

    const syncWithServer = async () => {
        setLoading(true);
        try {
            const [stagesRes, dealsRes] = await Promise.all([
                crmAPI.getStages(),
                crmAPI.getDeals({ status: 'active' })
            ]);

            const stagesData = stagesRes.data || stagesRes;
            if (Array.isArray(stagesData) && stagesData.length > 0) {
                setStages(stagesData);
            }

            const dealsData = dealsRes.data || dealsRes;
            if (Array.isArray(dealsData)) {
                setDeals(dealsData);
            }
        } catch (error) {
            console.log('Server sync skipped, using local data');
        } finally {
            setLoading(false);
        }
    };

    // Функция создания нового этапа
    const createStage = (name, color = '#6366f1', probability = 50) => {
        const newStage = {
            id: Date.now(),
            name,
            color,
            success_probability: probability,
            is_final: false
        };
        setStages([...stages, newStage]);
    };

    // Функция удаления этапа
    const deleteStage = (stageId) => {
        if (getDealsByStage(stageId).length > 0) {
            setStatusMsg({ type: 'error', text: 'Нельзя удалить этап с сделками. Сначала переместите сделки.' });
            return;
        }
        setStages(stages.filter(s => s.id !== stageId));
    };

    const createDeal = async (data) => {
        try {
            const res = await crmAPI.createDeal(data);
            const created = res.data || res;
            setStatusMsg({ type: 'success', text: 'Сделка создана' });
            setShowCreateModal(false);
            syncWithServer();
        } catch (error) {
            console.warn('SalesPipeline: не удалось загрузить данные', error.message);
        }
    };

    const moveDeal = async (dealId, newStageId) => {
        try {
            await crmAPI.updateDealStage(dealId, newStageId);
            syncWithServer();
        } catch (error) {
            console.error('Error moving deal:', error);
            // Обновляем локально
            setDeals(prev => prev.map(d =>
                d.id === dealId ? { ...d, stage_id: newStageId } : d
            ));
        }
    };

    const handleDragStart = (e, deal) => {
        setDraggedDeal(deal);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, stage) => {
        e.preventDefault();
        if (draggedDeal && draggedDeal.stage_id !== stage.id) {
            moveDeal(draggedDeal.id, stage.id);
        }
        setDraggedDeal(null);
    };

    const getDealsByStage = (stageId) => {
        return deals.filter(d => d.stage_id === stageId);
    };

    const formatCurrency = (amount) => formatCurrencyUZS(amount);

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Briefcase size={32} /> {t('salespipeline.voronka_prodazh', 'Воронка продаж')}</h1>
                    <p>{t('salespipeline.upravlenie_sdelkami_i_konversiya', 'Управление сделками и конверсия')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setShowStageModal(true)}>
                        <Settings size={18} /> Этапы
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={20} /> {t('salespipeline.novaya_sdelka', 'Новая сделка')}
                    </button>
                </div>
            </div>

            {/* Статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#4472C4' }}>
                        <Briefcase size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{deals.length}</div>
                        <div className="stat-label">{t('salespipeline.aktivnyh_sdelok', 'Активных сделок')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#70AD47' }}>
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {formatCurrency(deals.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0))}
                        </div>
                        <div className="stat-label">{t('salespipeline.obschaya_summa', 'Общая сумма')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#FFC000' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {analytics?.conversion_rate || 0}%
                        </div>
                        <div className="stat-label">{t('salespipeline.konversiya', 'Конверсия')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#9F2B68' }}>
                        <Users size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {new Set(deals.map(d => d.customer_id)).size}
                        </div>
                        <div className="stat-label">{t('salespipeline.klientov', 'Клиентов')}</div>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="kanban-board">
                {stages.filter(s => !s.is_final).map(stage => {
                    const stageDeals = getDealsByStage(stage.id);
                    const stageAmount = stageDeals.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);

                    return (
                        <div
                            key={stage.id}
                            className="kanban-column"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, stage)}
                        >
                            <div className="kanban-header" style={{ borderTop: `3px solid ${stage.color}` }}>
                                <div>
                                    <h3>{stage.name}</h3>
                                    <div className="kanban-stats">
                                        {stageDeals.length} • {formatCurrency(stageAmount)}
                                    </div>
                                </div>
                                <div className="probability-badge">
                                    {stage.success_probability}%
                                </div>
                            </div>

                            <div className="kanban-cards">
                                {stageDeals.map(deal => (
                                    <div
                                        key={deal.id}
                                        className="deal-card"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, deal)}
                                    >
                                        <div className="deal-title">{deal.title}</div>
                                        <div className="deal-customer">{deal.customer_name}</div>
                                        <div className="deal-amount">{formatCurrency(deal.amount)}</div>
                                        <div className="deal-meta">
                                            <span>{deal.assigned_name || 'Не назначено'}</span>
                                            {deal.expected_close_date && (
                                                <span>До {new Date(deal.expected_close_date).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Модальное окно создания */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{t('salespipeline.novaya_sdelka', 'Новая сделка')}</h2>
                        <form onSubmit={e => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            createDeal({
                                title: formData.get('title'),
                                customer_id: parseInt(formData.get('customer_id')),
                                stage_id: parseInt(formData.get('stage_id')),
                                amount: parseFloat(formData.get('amount')),
                                expected_close_date: formData.get('expected_close_date'),
                                source: formData.get('source'),
                                notes: formData.get('notes')
                            });
                        }}>
                            <div className="form-group">
                                <label>{t('salespipeline.nazvanie_sdelki', 'Название сделки *')}</label>
                                <input name="title" required />
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.klient', 'Клиент *')}</label>
                                <select name="customer_id" required>
                                    <option value="">{t('salespipeline.vyberite_klienta', 'Выберите клиента')}</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.etap', 'Этап *')}</label>
                                <select name="stage_id" required>
                                    {stages.filter(s => !s.is_final).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.summa', 'Сумма *')}</label>
                                <input name="amount" type="number" step="0.01" required />
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.ozhidaemaya_data_zakrytiya', 'Ожидаемая дата закрытия')}</label>
                                <input name="expected_close_date" type="date" />
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.istochnik', 'Источник')}</label>
                                <select name="source">
                                    <option value="">{t('salespipeline.vyberite', 'Выберите')}</option>
                                    <option value="website">{t('salespipeline.sayt', 'Сайт')}</option>
                                    <option value="advertising">{t('salespipeline.reklama', 'Реклама')}</option>
                                    <option value="referral">{t('salespipeline.rekomendatsiya', 'Рекомендация')}</option>
                                    <option value="cold_call">{t('salespipeline.holodnyy_zvonok', 'Холодный звонок')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('salespipeline.primechaniya', 'Примечания')}</label>
                                <textarea name="notes" rows={3} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                    Отмена
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Создать
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальное окно управления этапами */}
            {showStageModal && (
                <div className="modal-overlay" onClick={() => setShowStageModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{t('salespipeline.upravlenie_etapami', 'Управление этапами')}</h2>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowStageModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Список этапов */}
                        <div style={{ marginBottom: '20px' }}>
                            {stages.map((stage, idx) => (
                                <div key={stage.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: 'var(--card-bg)',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    borderLeft: `4px solid ${stage.color}`
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <strong>{stage.name}</strong>
                                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                            Вероятность: {stage.success_probability}% {stage.is_final && '(финальный)'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ color: '#666' }}>{getDealsByStage(stage.id).length} сделок</span>
                                        {!stage.is_final && (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => deleteStage(stage.id)}
                                                title={t('salespipeline.udalit_etap', 'Удалить этап')}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Форма добавления */}
                        <form onSubmit={e => {
                            e.preventDefault();
                            const name = e.target.stageName.value;
                            const color = e.target.stageColor.value;
                            const prob = parseInt(e.target.stageProbability.value);
                            if (name) {
                                createStage(name, color, prob);
                                e.target.reset();
                            }
                        }}>
                            <h4>{t('salespipeline.dobavit_etap', 'Добавить этап')}</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: '12px', alignItems: 'end' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('salespipeline.nazvanie', 'Название')}</label>
                                    <input name="stageName" placeholder="Название этапа" required />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>{t('salespipeline.tsvet', 'Цвет')}</label>
                                    <input name="stageColor" type="color" defaultValue="#6366f1" style={{ height: '40px', padding: '4px' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>%</label>
                                    <input name="stageProbability" type="number" min="0" max="100" defaultValue="50" style={{ width: '100%' }} />
                                </div>
                                <button type="submit" className="btn btn-primary">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </form>

                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={async () => {
                                    if (await confirm({ message: 'Сбросить этапы по умолчанию?' })) {
                                        setStages(DEFAULT_STAGES);
                                    }
                                }}
                            >
                                Сбросить по умолчанию
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .kanban-board {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                    overflow-x: auto;
                }

                .kanban-column {
                    background: var(--card-bg);
                    border-radius: 8px;
                    min-height: 500px;
                    display: flex;
                    flex-direction: column;
                }

                .kanban-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                }

                .kanban-header h3 {
                    margin: 0 0 8px 0;
                    font-size: 16px;
                }

                .kanban-stats {
                    font-size: 13px;
                    opacity: 0.7;
                }

                .probability-badge {
                    background: rgba(68, 114, 196, 0.1);
                    color: var(--primary-color);
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }

                .kanban-cards {
                    padding: 12px;
                    flex: 1;
                    overflow-y: auto;
                }

                .deal-card {
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 12px;
                    cursor: grab;
                    transition: all 0.2s;
                }

                .deal-card:active {
                    cursor: grabbing;
                    opacity: 0.7;
                }

                .deal-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }

                .deal-title {
                    font-weight: 600;
                    margin-bottom: 6px;
                }

                .deal-customer {
                    font-size: 13px;
                    opacity: 0.7;
                    margin-bottom: 8px;
                }

                .deal-amount {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 8px;
                }

                .deal-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    opacity: 0.6;
                }
            `}</style>
        </div>
    );
};

export default SalesPipeline;
