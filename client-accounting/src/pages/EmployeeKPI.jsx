import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, Award, Star, DollarSign, ShoppingCart, Clock, ThumbsUp } from 'lucide-react';
import { employeesAPI } from '../services/api';
import { useI18n } from '../i18n';

function EmployeeKPI() {
    const { t } = useI18n();
    const [employees, setEmployees] = useState([]);
    const [period, setPeriod] = useState('2026-01');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [period]);

    const loadData = async () => {
        try {
            const apiRes = await employeesAPI.getAll();
            const apiData = apiRes.data || apiRes;
            console.log('EmployeeKPI.jsx: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('EmployeeKPI: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('ru-RU').format(value || 0) + " so'm";

    const getScoreColor = (score) => {
        if (score >= 110) return '#10b981';
        if (score >= 100) return '#3b82f6';
        if (score >= 80) return '#f59e0b';
        return '#ef4444';
    };

    const getKPIPercentage = (kpi) => {
        return Math.round((kpi.actual / kpi.target) * 100);
    };

    return (
        <div className="employee-kpi-page fade-in">
            <div className="page-header">
                <div>
                    <h1>{t('employeekpi.sotrudnikov', '🎯 KPI сотрудников')}</h1>
                    <p className="text-muted">{t('employeekpi.klyuchevye_pokazateli_effektivnosti', 'Ключевые показатели эффективности')}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
            </div>

            {/* Карточки сотрудников */}
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>{t('employeekpi.zagruzka', 'Загрузка...')}</div>
            ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                    {employees.map(emp => (
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
                                        <div style={{ color: '#888' }}>{emp.position}</div>
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
                                        background: '#dcfce7',
                                        color: '#166534',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        fontWeight: 500
                                    }}>
                                        Бонус: {formatCurrency(emp.bonus)}
                                    </div>
                                </div>
                            </div>

                            {/* KPI показатели */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {/* Продажи */}
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
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
                                    <div style={{ marginTop: '8px', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
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
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
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
                                    <div style={{ marginTop: '8px', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
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
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
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
                                    <div style={{ marginTop: '8px', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
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
                                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
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
                                    <div style={{ marginTop: '8px', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
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
