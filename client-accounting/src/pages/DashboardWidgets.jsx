import React, { useState } from 'react';
import { LayoutGrid, Plus, GripVertical, Eye, EyeOff, Settings, BarChart3, DollarSign, Package, Users, TrendingUp, ShoppingCart, Clock } from 'lucide-react';
import { settingsAPI } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useI18n } from '../i18n';

function DashboardWidgets() {
    const { t } = useI18n();
    const toast = useToast();
    const [widgets, setWidgets] = useState([
        { id: 1, name: 'Продажи сегодня', type: 'metric', icon: DollarSign, enabled: true, size: 'small', position: 0 },
        { id: 2, name: 'Заказы', type: 'metric', icon: ShoppingCart, enabled: true, size: 'small', position: 1 },
        { id: 3, name: 'Клиенты онлайн', type: 'metric', icon: Users, enabled: true, size: 'small', position: 2 },
        { id: 4, name: 'Остатки склада', type: 'metric', icon: Package, enabled: true, size: 'small', position: 3 },
        { id: 5, name: 'График продаж', type: 'chart', icon: BarChart3, enabled: true, size: 'large', position: 4 },
        { id: 6, name: 'Топ товаров', type: 'list', icon: TrendingUp, enabled: true, size: 'medium', position: 5 },
        { id: 7, name: 'Последние заказы', type: 'list', icon: Clock, enabled: true, size: 'medium', position: 6 },
        { id: 8, name: 'Воронка продаж', type: 'chart', icon: BarChart3, enabled: false, size: 'medium', position: 7 },
        { id: 9, name: 'KPI сотрудников', type: 'list', icon: Users, enabled: false, size: 'medium', position: 8 }
    ]);

    const toggleWidget = (id) => {
        setWidgets(widgets.map(w =>
            w.id === id ? { ...w, enabled: !w.enabled } : w
        ));
    };

    const changeSize = (id, size) => {
        setWidgets(widgets.map(w =>
            w.id === id ? { ...w, size } : w
        ));
    };

    const getSizeStyle = (size) => {
        const sizes = {
            small: { width: '25%', height: '100px' },
            medium: { width: '50%', height: '200px' },
            large: { width: '100%', height: '250px' }
        };
        return sizes[size] || sizes.medium;
    };

    return (
        <div className="dashboard-widgets-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('dashboardwidgets.vidzhety_na_dashborde', '📊 Виджеты на дашборде')}</h1>
                    <p className="text-muted">{t('dashboardwidgets.nastroyka_paneli_upravleni', 'Drag-and-drop настройка панели управления')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => toast.success('Добавление виджета...')}>
                    <Plus size={18} /> Добавить виджет
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                {/* Список виджетов */}
                <div className="card">
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: 0 }}>{t('dashboardwidgets.dostupnye_vidzhety', '📋 Доступные виджеты')}</h3>
                    </div>
                    <div>
                        {widgets.map(widget => {
                            const WidgetIcon = widget.icon;

                            return (
                                <div
                                    key={widget.id}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        opacity: widget.enabled ? 1 : 0.5,
                                        cursor: 'grab'
                                    }}
                                >
                                    <GripVertical size={16} color="#888" style={{ cursor: 'grab' }} />
                                    <div style={{
                                        width: '36px', height: '36px',
                                        borderRadius: '8px',
                                        background: widget.enabled ? '#dbeafe' : '#f3f4f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <WidgetIcon size={18} color={widget.enabled ? '#3b82f6' : '#888'} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{widget.name}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            {widget.type === 'metric' ? 'Метрика' : widget.type === 'chart' ? 'График' : 'Список'}
                                        </div>
                                    </div>
                                    <select
                                        value={widget.size}
                                        onChange={(e) => changeSize(widget.id, e.target.value)}
                                        style={{ fontSize: '12px', padding: '4px' }}
                                    >
                                        <option value="small">S</option>
                                        <option value="medium">M</option>
                                        <option value="large">L</option>
                                    </select>
                                    <button
                                        onClick={() => toggleWidget(widget.id)}
                                        className="btn btn-sm btn-secondary"
                                        style={{ padding: '6px' }}
                                    >
                                        {widget.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Превью дашборда */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <LayoutGrid size={20} color="#3b82f6" />
                        <h3 style={{ margin: 0 }}>{t('dashboardwidgets.predprosmotr_dashborda', 'Предпросмотр дашборда')}</h3>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        background: 'var(--bg-secondary)',
                        padding: '20px',
                        borderRadius: '12px',
                        minHeight: '500px'
                    }}>
                        {widgets.filter(w => w.enabled).map(widget => {
                            const WidgetIcon = widget.icon;
                            const sizeStyle = getSizeStyle(widget.size);

                            return (
                                <div
                                    key={widget.id}
                                    style={{
                                        width: `calc(${sizeStyle.width} - 16px)`,
                                        minHeight: sizeStyle.height,
                                        background: 'white',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        cursor: 'move'
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <WidgetIcon size={16} color="#3b82f6" />
                                            <span style={{ fontWeight: 500, fontSize: '13px' }}>{widget.name}</span>
                                        </div>
                                        <Settings size={14} color="#888" style={{ cursor: 'pointer' }} />
                                    </div>

                                    {/* Заглушка контента */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {widget.type === 'metric' && (
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                                                    {widget.name.includes('Продажи') ? '45.2M' :
                                                        widget.name.includes('Заказы') ? '128' :
                                                            widget.name.includes('Клиенты') ? '23' : '1,245'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#10b981' }}>+12.5%</div>
                                            </div>
                                        )}
                                        {widget.type === 'chart' && (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <BarChart3 size={48} color="#3b82f6" />
                                            </div>
                                        )}
                                        {widget.type === 'list' && (
                                            <div style={{ width: '100%' }}>
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} style={{
                                                        padding: '8px',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '6px',
                                                        marginBottom: '4px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: '12px'
                                                    }}>
                                                        <span>Элемент {i}</span>
                                                        <span style={{ fontWeight: 'bold' }}>123</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardWidgets;
