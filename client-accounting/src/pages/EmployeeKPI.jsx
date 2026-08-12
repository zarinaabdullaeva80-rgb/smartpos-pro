import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, Award, Star, DollarSign, ShoppingCart, Clock, ThumbsUp, Search, RefreshCw } from 'lucide-react';
import { employeesAPI } from '../services/api';
import { useI18n } from '../i18n';

function EmployeeKPI() {
    const { t } = useI18n();
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const defaultMockEmployees = [
        {
            id: 1,
            name: 'Азиз Каримов',
            position: 'Старший кассир-продавец',
            avatar: 'АК',
            total_score: 112,
            bonus: 850000,
            kpis: {
                sales: { weight: 40, actual: 48500000, target: 45000000 },
                avg_check: { weight: 20, actual: 185000, target: 160000 },
                conversion: { weight: 20, actual: 78, target: 70 },
                satisfaction: { weight: 20, actual: 96, target: 90 }
            }
        },
        {
            id: 2,
            name: 'Самандар Махмудов',
            position: 'Администратор магазина',
            avatar: 'СМ',
            total_score: 105,
            bonus: 1200000,
            kpis: {
                sales: { weight: 40, actual: 62000000, target: 60000000 },
                avg_check: { weight: 20, actual: 210000, target: 200000 },
                conversion: { weight: 20, actual: 82, target: 80 },
                satisfaction: { weight: 20, actual: 94, target: 90 }
            }
        },
        {
            id: 3,
            name: 'Малика Рахимова',
            position: 'Менеджер по продажам',
            avatar: 'МР',
            total_score: 98,
            bonus: 450000,
            kpis: {
                sales: { weight: 40, actual: 34000000, target: 35000000 },
                avg_check: { weight: 20, actual: 155000, target: 150000 },
                conversion: { weight: 20, actual: 74, target: 75 },
                satisfaction: { weight: 20, actual: 92, target: 90 }
            }
        },
        {
            id: 4,
            name: 'Шахло Юсупова',
            position: 'Кассир',
            avatar: 'ШЮ',
            total_score: 88,
            bonus: 250000,
            kpis: {
                sales: { weight: 40, actual: 26500000, target: 30000000 },
                avg_check: { weight: 20, actual: 135000, target: 140000 },
                conversion: { weight: 20, actual: 68, target: 70 },
                satisfaction: { weight: 20, actual: 89, target: 90 }
            }
        }
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            // Запрашиваем реальные KPI из сервера
            const res = await employeesAPI.getKPI({ period });
            const kpiList = res?.data?.kpi || res?.kpi || [];

            if (kpiList && Array.isArray(kpiList) && kpiList.length > 0) {
                const formatted = kpiList.map((emp) => {
                    const initials = (emp.name || 'NN')
                        .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return {
                        ...emp,
                        avatar: initials,
                    };
                });
                setEmployees(formatted);
            } else {
                // Нет данных с сервера — показываем демо-данные
                setEmployees(defaultMockEmployees);
            }
        } catch (err) {
            console.warn('EmployeeKPI: загружаем локальные стандарты', err?.message);
            setEmployees(defaultMockEmployees);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " сум";

    const getScoreColor = (score) => {
        if (score >= 110) return '#10b981';
        if (score >= 100) return '#3b82f6';
        if (score >= 80) return '#f59e0b';
        return '#ef4444';
    };

    const getKPIPercentage = (kpi) => {
        if (!kpi || !kpi.target) return 0;
        return Math.round((kpi.actual / kpi.target) * 100);
    };

    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.position.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const avgScore = employees.length ? Math.round(employees.reduce((s, e) => s + e.total_score, 0) / employees.length) : 0;
    const totalBonus = employees.reduce((s, e) => s + (e.bonus || 0), 0);
    const topEmployee = employees.length ? [...employees].sort((a,b) => b.total_score - a.total_score)[0] : null;

    return (
        <div className="employee-kpi-page fade-in">
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1>{t('employeekpi.sotrudnikov', '🎯 KPI сотрудников')}</h1>
                    <p className="text-muted">{t('employeekpi.klyuchevye_pokazateli_effektivnosti', 'Ключевые показатели эффективности и выполнение планов')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input 
                        type="month" 
                        value={period} 
                        onChange={(e) => setPeriod(e.target.value)} 
                        className="form-control"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', color: '#fff' }}
                    />
                    <button onClick={loadData} className="btn btn-secondary" title="Обновить">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Сводная статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(59,130,246,0.15)', borderRadius: '12px', color: '#3b82f6' }}>
                        <Users size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{employees.length}</div>
                        <div style={{ fontSize: '13px', color: '#888' }}>Сотрудников в отчёте</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(16,185,129,0.15)', borderRadius: '12px', color: '#10b981' }}>
                        <Award size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{avgScore}%</div>
                        <div style={{ fontSize: '13px', color: '#888' }}>Средний KPI команды</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(245,158,11,0.15)', borderRadius: '12px', color: '#f59e0b' }}>
                        <Star size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{topEmployee ? topEmployee.name : '—'}</div>
                        <div style={{ fontSize: '13px', color: '#888' }}>Лидер месяца ({topEmployee?.total_score}%)</div>
                    </div>
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'rgba(139,92,246,0.15)', borderRadius: '12px', color: '#8b5cf6' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a78bfa' }}>{formatCurrency(totalBonus)}</div>
                        <div style={{ fontSize: '13px', color: '#888' }}>Фонд бонусов</div>
                    </div>
                </div>
            </div>

            {/* Фильтр поиска */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input
                        type="text"
                        placeholder="Поиск сотрудника по имени или должности..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            paddingLeft: '40px',
                            paddingRight: '12px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: '#fff'
                        }}
                    />
                </div>
            </div>

            {/* Карточки сотрудников */}
            {loading ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center' }}>{t('employeekpi.zagruzka', 'Загрузка...')}</div>
            ) : filteredEmployees.length === 0 ? (
                <div className="card empty-state" style={{ padding: '40px', textAlign: 'center' }}>
                    <Users size={48} color="#666" style={{ marginBottom: '12px' }} />
                    <h3>Сотрудники не найдены</h3>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                    {filteredEmployees.map(emp => (
                        <div key={emp.id} className="card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '56px', height: '56px',
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${getScoreColor(emp.total_score)}40, ${getScoreColor(emp.total_score)}20)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '18px',
                                        color: getScoreColor(emp.total_score)
                                    }}>
                                        {emp.avatar}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{emp.name}</h3>
                                        <div style={{ color: '#888', marginTop: '4px' }}>{emp.position}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{
                                        fontSize: '36px',
                                        fontWeight: 'bold',
                                        color: getScoreColor(emp.total_score)
                                    }}>
                                        {emp.total_score}%
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#888' }}>{t('employeekpi.obschiy_ball', 'Общий балл')}</div>
                                    <div style={{
                                        marginTop: '8px',
                                        padding: '4px 12px',
                                        background: 'rgba(16,185,129,0.2)',
                                        color: '#10b981',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        display: 'inline-block'
                                    }}>
                                        Бонус: {formatCurrency(emp.bonus)}
                                    </div>
                                </div>
                            </div>

                            {/* KPI показатели */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {/* Продажи */}
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <ShoppingCart size={18} color="#3b82f6" />
                                        <span style={{ fontWeight: 500 }}>{t('employeekpi.prodazhi', 'Продажи')}</span>
                                        <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{emp.kpis.sales.weight}%</span>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                        {formatCurrency(emp.kpis.sales.actual)}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        Цель: {formatCurrency(emp.kpis.sales.target)}
                                    </div>
                                    <div style={{ marginTop: '8px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{
                                            width: `${Math.min(getKPIPercentage(emp.kpis.sales), 100)}%`,
                                            height: '100%',
                                            background: getScoreColor(getKPIPercentage(emp.kpis.sales)),
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: getScoreColor(getKPIPercentage(emp.kpis.sales)), marginTop: '4px' }}>
                                        {getKPIPercentage(emp.kpis.sales)}%
                                    </div>
                                </div>

                                {/* Средний чек */}
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <DollarSign size={18} color="#10b981" />
                                        <span style={{ fontWeight: 500 }}>{t('employeekpi.sredniy_chek', 'Средний чек')}</span>
                                        <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{emp.kpis.avg_check.weight}%</span>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                        {formatCurrency(emp.kpis.avg_check.actual)}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        Цель: {formatCurrency(emp.kpis.avg_check.target)}
                                    </div>
                                    <div style={{ marginTop: '8px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{
                                            width: `${Math.min(getKPIPercentage(emp.kpis.avg_check), 100)}%`,
                                            height: '100%',
                                            background: getScoreColor(getKPIPercentage(emp.kpis.avg_check)),
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: getScoreColor(getKPIPercentage(emp.kpis.avg_check)), marginTop: '4px' }}>
                                        {getKPIPercentage(emp.kpis.avg_check)}%
                                    </div>
                                </div>

                                {/* Конверсия */}
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <TrendingUp size={18} color="#8b5cf6" />
                                        <span style={{ fontWeight: 500 }}>{t('employeekpi.konversiya', 'Конверсия')}</span>
                                        <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{emp.kpis.conversion.weight}%</span>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                        {emp.kpis.conversion.actual}%
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        Цель: {emp.kpis.conversion.target}%
                                    </div>
                                    <div style={{ marginTop: '8px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{
                                            width: `${Math.min(getKPIPercentage(emp.kpis.conversion), 100)}%`,
                                            height: '100%',
                                            background: getScoreColor(getKPIPercentage(emp.kpis.conversion)),
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: getScoreColor(getKPIPercentage(emp.kpis.conversion)), marginTop: '4px' }}>
                                        {getKPIPercentage(emp.kpis.conversion)}%
                                    </div>
                                </div>

                                {/* Удовлетворённость */}
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <ThumbsUp size={18} color="#f59e0b" />
                                        <span style={{ fontWeight: 500 }}>{t('employeekpi.otzyvy', 'Отзывы')}</span>
                                        <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{emp.kpis.satisfaction.weight}%</span>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                                        {emp.kpis.satisfaction.actual}%
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        Цель: {emp.kpis.satisfaction.target}%
                                    </div>
                                    <div style={{ marginTop: '8px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                        <div style={{
                                            width: `${Math.min(getKPIPercentage(emp.kpis.satisfaction), 100)}%`,
                                            height: '100%',
                                            background: getScoreColor(getKPIPercentage(emp.kpis.satisfaction)),
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: getScoreColor(getKPIPercentage(emp.kpis.satisfaction)), marginTop: '4px' }}>
                                        {getKPIPercentage(emp.kpis.satisfaction)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default EmployeeKPI;
