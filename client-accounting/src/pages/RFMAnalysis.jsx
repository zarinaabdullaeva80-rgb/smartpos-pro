import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, Target, Filter } from 'lucide-react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../styles/Common.css';
import { analyticsAPI, crmAPI } from '../services/api';
import { useI18n } from '../i18n';

const RFMAnalysis = () => {
    const { t } = useI18n();
    const [segments, setSegments] = useState([]);
    const [segmentStats, setSegmentStats] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const apiRes = await analyticsAPI.getAll();
            const apiData = apiRes.data || apiRes;
            setSegments(d.segments || []);
            setSegmentStats(d.segmentStats || d.segment_stats || []);
            setCustomers(d.customers || []);
            setSegments(await segmentsRes.json());
            setSegmentStats(await statsRes.json());
            setCustomers(await customersRes.json());
            setSegments(apiData.segments || []);
            setSegmentStats(apiData.segmentStats || []);
            setCustomers(apiData.customers || []);
        } catch (err) {
            console.warn('RFMAnalysis: не удалось загрузить данные', err.message);
        }
        setLoading(false);
    };

    const COLORS = {
        'champions': '#00B050',
        'loyal': '#92D050',
        'potential': '#00B0F0',
        'new_customers': '#7030A0',
        'promising': '#FFC000',
        'need_attention': '#FF6600',
        'about_to_sleep': '#FF9900',
        'at_risk': '#C00000',
        'cant_lose': '#FF0000',
        'hibernating': '#7F7F7F',
        'lost': '#404040'
    };

    const getTotalCustomers = () => customers.length;
    const getTotalValue = () => segmentStats.reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0);

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1><Target size={32} /> {t('rfmanalysis.analiz_klientov', 'RFM Анализ клиентов')}</h1>
                    <p>{t('rfmanalysis.segmentatsiya_klientov_po', 'Сегментация клиентов по Recency, Frequency, Monetary')}</p>
                </div>
            </div>

            {/* Общая статистика */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#4472C4' }}>
                        <Users size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{getTotalCustomers()}</div>
                        <div className="stat-label">{t('rfmanalysis.vsego_klientov', 'Всего клиентов')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#70AD47' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">
                            {getTotalValue().toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                        </div>
                        <div className="stat-label">{t('rfmanalysis.obschaya_tsennost', 'Общая ценность')}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#FFC000' }}>
                        <Filter size={24} />
                    </div>
                    <div className="stat-details">
                        <div className="stat-value">{segmentStats.length}</div>
                        <div className="stat-label">{t('rfmanalysis.segmentov', 'Сегментов')}</div>
                    </div>
                </div>
            </div>

            {/* Диаграммы */}
            <div className="charts-grid">
                {/* Pie Chart - Распределение клиентов */}
                <div className="card">
                    <h3>{t('rfmanalysis.raspredelenie_klientov_po_segmentam', 'Распределение клиентов по сегментам')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={segmentStats}
                                dataKey="customer_count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={(entry) => `${entry.name}: ${entry.customer_count}`}
                            >
                                {segmentStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.code] || '#8884d8'} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Bar Chart - Ценность сегментов */}
                <div className="card">
                    <h3>{t('rfmanalysis.tsennost_segmentov', 'Ценность сегментов')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={segmentStats}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value) => `${parseFloat(value).toLocaleString('ru-RU')} ₽`} />
                            <Bar dataKey="total_value" fill="#4472C4" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Таблица сегментов */}
            <div className="card">
                <h3>{t('rfmanalysis.detali_po_segmentam', 'Детали по сегментам')}</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('rfmanalysis.segment', 'Сегмент')}</th>
                            <th>{t('rfmanalysis.klientov', 'Клиентов')}</th>
                            <th>{t('rfmanalysis.obschaya_tsennost', 'Общая ценность')}</th>
                            <th>{t('rfmanalysis.sredniy_chek', 'Средний чек')}</th>
                            <th>{t('rfmanalysis.deystviya', 'Действия')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {segmentStats.map(segment => (
                            <tr key={segment.code}>
                                <td>
                                    <span
                                        className="segment-badge"
                                        style={{
                                            background: COLORS[segment.code],
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}
                                    >
                                        {segment.name}
                                    </span>
                                </td>
                                <td>{segment.customer_count}</td>
                                <td>{parseFloat(segment.total_value).toLocaleString('ru-RU')} ₽</td>
                                <td>{parseFloat(segment.avg_value).toLocaleString('ru-RU')} ₽</td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setSelectedSegment(segment.code)}
                                    >
                                        Показать клиентов
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Список клиентов выбранного сегмента */}
            {selectedSegment && (
                <div className="card">
                    <h3>
                        Клиенты сегмента: {segments.find(s => s.code === selectedSegment)?.name}
                        <button
                            className="btn btn-sm btn-secondary"
                            style={{ marginLeft: '16px' }}
                            onClick={() => setSelectedSegment(null)}
                        >
                            Закрыть
                        </button>
                    </h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('rfmanalysis.klient', 'Клиент')}</th>
                                <th>R Score</th>
                                <th>F Score</th>
                                <th>M Score</th>
                                <th>{t('rfmanalysis.dney_s_pokupki', 'Дней с покупки')}</th>
                                <th>{t('rfmanalysis.pokupok', 'Покупок')}</th>
                                <th>{t('rfmanalysis.summa_pokupok', 'Сумма покупок')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers
                                .filter(c => c.segment_code === selectedSegment)
                                .map(customer => (
                                    <tr key={customer.id}>
                                        <td>
                                            <div><strong>{customer.name}</strong></div>
                                            <div style={{ fontSize: '12px', opacity: 0.7 }}>{customer.phone}</div>
                                        </td>
                                        <td>{customer.r_score}/5</td>
                                        <td>{customer.f_score}/5</td>
                                        <td>{customer.m_score}/5</td>
                                        <td>{customer.recency_days}</td>
                                        <td>{customer.frequency}</td>
                                        <td>{parseFloat(customer.monetary).toLocaleString('ru-RU')} ₽</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                    gap: 20px;
                    margin: 20px 0;
                }

                @media (max-width: 768px) {
                    .charts-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default RFMAnalysis;
