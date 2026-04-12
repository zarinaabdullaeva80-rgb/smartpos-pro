import React, { useState, useEffect } from 'react';
import { Zap, Package, Settings, Check, AlertTriangle, Bell, RefreshCw, Power, Plus } from 'lucide-react';
import { productsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function AutoOrder() {
    const { t } = useI18n();
    const toast = useToast();
    const [rules, setRules] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await productsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setRules(apiData.rules || []);
            setStats(apiData.stats || {});
        } catch (err) {
            console.warn('AutoOrder: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    return (
        <div className="auto-order-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('autoorder.avtozakaz', '⚡ Автозаказ')}</h1>
                    <p className="text-muted">{t('autoorder.avtomaticheskoe_popolnenie_zapasov', 'Автоматическое пополнение запасов')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Создание нового правила...')}>
                    <Plus size={18} /> Новое правило
                </button>
            </div>

            {/* Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Zap size={28} color="#f59e0b" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.active_rules}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('autoorder.aktivnyh_pravil', 'Активных правил')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Package size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.orders_created}</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('autoorder.zakazov_sozdano', 'Заказов создано')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <RefreshCw size={28} color="#3b82f6" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.saved_time}ч</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('autoorder.vremeni_sekonomleno', 'Времени сэкономлено')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <Check size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.avg_accuracy}%</div>
                    <div style={{ color: '#666', fontSize: '13px' }}>{t('autoorder.tochnost', 'Точность')}</div>
                </div>
            </div>

            {/* Правила */}
            <div className="card">
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('autoorder.pravila_avtozakaza', '📋 Правила автозаказа')}</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>{t('autoorder.zagruzka', 'Загрузка...')}</div>
                ) : (
                    <div style={{ display: 'grid', gap: '16px', padding: '16px' }}>
                        {rules.map(rule => (
                            <div key={rule.id} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '20px',
                                opacity: rule.active ? 1 : 0.6,
                                borderLeft: `4px solid ${rule.active ? '#10b981' : '#888'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px', height: '40px',
                                            borderRadius: '50%',
                                            background: rule.active ? '#dcfce7' : '#f3f4f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Zap size={20} color={rule.active ? '#10b981' : '#888'} />
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{rule.name}</h4>
                                            <div style={{ fontSize: '13px', color: '#888' }}>{rule.product}</div>
                                        </div>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <span style={{ fontSize: '13px', color: '#888' }}>{rule.active ? 'Вкл' : 'Выкл'}</span>
                                        <div style={{
                                            width: '44px', height: '24px',
                                            background: rule.active ? '#10b981' : '#ccc',
                                            borderRadius: '12px',
                                            position: 'relative'
                                        }}>
                                            <div style={{
                                                width: '20px', height: '20px',
                                                background: 'white',
                                                borderRadius: '50%',
                                                position: 'absolute',
                                                top: '2px',
                                                left: rule.active ? '22px' : '2px',
                                                transition: '0.3s'
                                            }} />
                                        </div>
                                    </label>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{t('autoorder.uslovie', 'Условие')}</div>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>
                                            <code style={{ background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px', color: '#4f46e5' }}>
                                                {rule.condition}
                                            </code>
                                        </div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{t('autoorder.deystvie', 'Действие')}</div>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{rule.action}</div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{t('autoorder.postavschik', 'Поставщик')}</div>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{rule.supplier}</div>
                                    </div>
                                    <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{t('autoorder.vypolneno', 'Выполнено')}</div>
                                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{rule.executions} раз</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>Послед.: {rule.last_run}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AutoOrder;
