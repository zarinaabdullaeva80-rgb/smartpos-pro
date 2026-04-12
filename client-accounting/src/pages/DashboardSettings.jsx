import React, { useState, useEffect } from 'react';
import { Grid, Move, Eye, EyeOff, Save, RotateCcw, Plus, Settings, BarChart2, DollarSign, Users, Package, TrendingUp, Activity } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DashboardSettings() {
    const { t } = useI18n();
    const toast = useToast();
    const [widgets, setWidgets] = useState([]);
    const [availableWidgets, setAvailableWidgets] = useState([]);
    const [layout, setLayout] = useState('grid');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const apiRes = await settingsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('DashboardSettings.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('DashboardSettings: не удалось загрузить данные', err.message);
        }


        setLoading(false);
    };

    const toggleWidget = (id) => {
        setWidgets(widgets.map(w =>
            w.id === id ? { ...w, visible: !w.visible } : w
        ));
    };

    const changeSize = (id, size) => {
        setWidgets(widgets.map(w =>
            w.id === id ? { ...w, size } : w
        ));
    };

    const getSizeStyle = (size) => {
        const sizes = {
            small: { gridColumn: 'span 1', height: '120px' },
            medium: { gridColumn: 'span 1', height: '180px' },
            large: { gridColumn: 'span 2', height: '250px' }
        };
        return sizes[size] || sizes.medium;
    };

    const visibleWidgets = widgets.filter(w => w.visible);

    return (
        <div className="dashboard-settings-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('dashboardsettings.nastroyka_dashborda', '🎨 Настройка дашборда')}</h1>
                    <p className="text-muted">{t('dashboardsettings.kastomizatsiya_vidzhetov_glavnoy_stranitsy', 'Кастомизация виджетов главной страницы')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => toast.info('Сброс настроек...')}>
                        <RotateCcw size={18} /> Сбросить
                    </button>
                    <button className="btn btn-primary" onClick={() => toast.success('Настройки сохранены!')}>
                        <Save size={18} /> Сохранить
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                {/* Панель виджетов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('dashboardsettings.vidzhety', '🧩 Виджеты')}</h3>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {widgets.map(widget => {
                            const Icon = widget.icon;
                            return (
                                <div key={widget.id} style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    opacity: widget.visible ? 1 : 0.5,
                                    background: widget.visible ? 'transparent' : 'var(--bg-secondary)'
                                }}>
                                    <Move size={16} color="#888" style={{ cursor: 'grab' }} />
                                    <Icon size={20} color={widget.visible ? 'var(--primary)' : '#888'} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{widget.name}</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>
                                            Размер: {widget.size === 'small' ? 'S' : widget.size === 'medium' ? 'M' : 'L'}
                                        </div>
                                    </div>
                                    <select
                                        value={widget.size}
                                        onChange={(e) => changeSize(widget.id, e.target.value)}
                                        style={{ width: '60px', padding: '4px', fontSize: '12px' }}
                                    >
                                        <option value="small">S</option>
                                        <option value="medium">M</option>
                                        <option value="large">L</option>
                                    </select>
                                    <button
                                        onClick={() => toggleWidget(widget.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        {widget.visible ? <Eye size={18} color="#10b981" /> : <EyeOff size={18} color="#888" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ padding: '16px' }}>
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => toast.success('Добавление виджета...')}>
                            <Plus size={16} /> Добавить виджет
                        </button>
                    </div>
                </div>

                {/* Превью */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{t('dashboardsettings.prevyu_dashborda', '👁️ Превью дашборда')}</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setLayout('grid')}
                                className={`btn btn-sm ${layout === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <Grid size={14} /> Сетка
                            </button>
                        </div>
                    </div>
                    <div style={{
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        minHeight: '500px'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '16px'
                        }}>
                            {visibleWidgets.map(widget => {
                                const Icon = widget.icon;
                                const sizeStyle = getSizeStyle(widget.size);
                                return (
                                    <div key={widget.id} style={{
                                        ...sizeStyle,
                                        background: 'white',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Icon size={18} color="var(--primary)" />
                                            <span style={{ fontWeight: 500, fontSize: '14px' }}>{widget.name}</span>
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#888',
                                            fontSize: '12px'
                                        }}>
                                            {widget.size === 'large' ? 'График / Таблица' : 'Данные'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Доступные виджеты */}
            <div className="card" style={{ marginTop: '20px' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>{t('dashboardsettings.dostupnye_vidzhety', '➕ Доступные виджеты')}</h3>
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                    {availableWidgets.map(widget => {
                        const Icon = widget.icon;
                        const isAdded = widgets.some(w => w.type === widget.type);
                        return (
                            <div key={widget.type} style={{
                                padding: '16px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                textAlign: 'center',
                                opacity: isAdded ? 0.5 : 1,
                                cursor: isAdded ? 'default' : 'pointer'
                            }}>
                                <Icon size={28} color="var(--primary)" style={{ marginBottom: '8px' }} />
                                <div style={{ fontWeight: 500, fontSize: '13px' }}>{widget.name}</div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{widget.description}</div>
                                {isAdded && (
                                    <span style={{
                                        fontSize: '10px',
                                        background: '#dcfce7',
                                        color: '#16a34a',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        marginTop: '8px',
                                        display: 'inline-block'
                                    }}>
                                        Добавлен
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default DashboardSettings;
